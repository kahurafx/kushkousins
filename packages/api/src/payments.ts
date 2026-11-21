import { TRPCError } from "@trpc/server";
import { and, db, desc, eq, lt, or, isNull, schema, sql } from "@repo/db";
import { RESERVATION_MINUTES, parseStkCallback, StkCallbackSchema, toMsisdn } from "@repo/types";
import { DarajaError, mpesaConfig, stkPush, stkQuery, type MpesaConfig } from "./mpesa";
import { markPaid, PROMPT_WINDOW_MS, releaseStaleReservations, type Tx } from "./stock";

const { orders, payments } = schema;
type Payment = typeof payments.$inferSelect;

/** Wait this long after a push before asking Safaricom (the callback usually wins), and between queries. */
const QUERY_AFTER_MS = 20_000;
const QUERY_EVERY_MS = 15_000;

export type StkResult = { resultCode: number; resultDesc: string; receipt?: string; amountKes?: number };

/**
 * Apply a final STK result (from the callback or STK Query) to one attempt. Idempotent: Safaricom retries
 * callbacks and the query can race the callback. Never throws for business reasons: the money may
 * already be taken, so the attempt is always recorded.
 */
export async function applyStkResult(tx: Tx, checkoutRequestId: string, result: StkResult) {
  const [attempt] = await tx.select().from(payments).where(eq(payments.checkoutRequestId, checkoutRequestId)).for("update");
  if (!attempt) return { outcome: "unknown" as const };

  if (attempt.status !== "pending") {
    // A query confirmed success first; the callback brings the receipt.
    if (attempt.status === "succeeded" && !attempt.receipt && result.receipt) {
      await tx.update(payments).set({ receipt: result.receipt }).where(eq(payments.id, attempt.id));
      if (attempt.applied) {
        await tx.update(orders).set({ mpesaReceiptNumber: result.receipt }).where(and(eq(orders.id, attempt.orderId), isNull(orders.mpesaReceiptNumber)));
      }
    }
    return { outcome: "duplicate" as const };
  }

  if (result.resultCode !== 0) {
    await tx.update(payments).set({ status: "failed", resultCode: result.resultCode, resultDesc: result.resultDesc }).where(eq(payments.id, attempt.id));
    return { outcome: "failed" as const };
  }

  // Daraja doesn't sign callbacks: the amount must be exactly what we asked for.
  if (result.amountKes !== undefined && result.amountKes * 100 !== attempt.amountCents) {
    console.error(`M-Pesa amount mismatch on ${checkoutRequestId}: got KES ${result.amountKes}, expected ${attempt.amountCents / 100}`);
    await tx
      .update(payments)
      .set({ status: "failed", resultCode: result.resultCode, resultDesc: `Amount mismatch: KES ${result.amountKes}` })
      .where(eq(payments.id, attempt.id));
    return { outcome: "mismatch" as const };
  }

  await tx
    .update(payments)
    .set({ status: "succeeded", resultCode: 0, resultDesc: result.resultDesc, receipt: result.receipt ?? null })
    .where(eq(payments.id, attempt.id));

  try {
    const paid = await markPaid(tx, attempt.orderId, { receipt: result.receipt, phone: attempt.phone });
    if (!paid.alreadyPaid) {
      await tx.update(payments).set({ applied: true }).where(eq(payments.id, attempt.id));
      return { outcome: "paid" as const };
    }
  } catch (e) {
    if (!(e instanceof TRPCError && e.code === "CONFLICT")) throw e;
  }
  // Paid after the reservation was released, or paid twice: an admin must refund (see admin.payments).
  console.error(`M-Pesa payment ${checkoutRequestId} could not be applied to order ${attempt.orderId}: needs a refund`);
  return { outcome: "needs_refund" as const };
}

/** The webhook body Safaricom POSTs. Returns what happened; the route always answers 200 "Accepted". */
export async function handleStkCallback(body: unknown) {
  const parsed = StkCallbackSchema.safeParse(body);
  if (!parsed.success) return { outcome: "invalid" as const };
  const r = parseStkCallback(parsed.data);
  return db.transaction((tx) => applyStkResult(tx, r.checkoutRequestId, r));
}

/** Ask Safaricom about a pending attempt whose callback hasn't arrived. Throttled per attempt. */
export async function reconcile(cfg: MpesaConfig, attempt: Payment) {
  const now = Date.now();
  if (attempt.status !== "pending" || now - attempt.createdAt.getTime() < QUERY_AFTER_MS) return;
  // Claim the query slot atomically so concurrent polls don't all hit Daraja's rate limit.
  const [claimed] = await db
    .update(payments)
    .set({ queriedAt: new Date() })
    .where(
      and(
        eq(payments.id, attempt.id),
        eq(payments.status, "pending"),
        or(isNull(payments.queriedAt), lt(payments.queriedAt, new Date(now - QUERY_EVERY_MS))),
      ),
    )
    .returning({ id: payments.id });
  if (!claimed) return;
  try {
    const q = await stkQuery(cfg, attempt.checkoutRequestId);
    if (q.state === "done") await db.transaction((tx) => applyStkResult(tx, attempt.checkoutRequestId, q));
  } catch (e) {
    console.error(`STK query for ${attempt.checkoutRequestId} failed:`, e instanceof Error ? e.message : e);
  }
}

/** Start an STK Push for the customer's own pending order. One live prompt per order at a time. */
export async function startPayment(userId: string, orderId: string, phone: string) {
  // DEV ONLY: explicit flag, and never in a production build.
  if (process.env.MOCK_PAYMENTS === "true" && process.env.NODE_ENV !== "production") {
    return db.transaction(async (tx) => {
      const [mine] = await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
      if (!mine) throw new TRPCError({ code: "NOT_FOUND" });
      const { status } = await markPaid(tx, mine.id, { phone: toMsisdn(phone) });
      return { status, mock: true };
    });
  }
  const cfg = mpesaConfig();
  if (!cfg) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "M-Pesa payments aren't set up yet. Your pieces are reserved; we'll be in touch." });

  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
  if (!order) throw new TRPCError({ code: "NOT_FOUND" });
  if (order.status !== "pending_payment") {
    if (order.status === "cancelled") throw new TRPCError({ code: "CONFLICT", message: "This order's reservation was released. Please return to your bag and order again." });
    return { status: order.status, mock: false };
  }

  // Settle an earlier unanswered prompt first, so the customer can't be charged twice.
  const [last] = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt)).limit(1);
  if (last?.status === "pending") {
    await reconcile(cfg, last);
    const [now] = await db.select({ status: payments.status }).from(payments).where(eq(payments.id, last.id));
    // Past the window the prompt has expired on the phone; if its callback was lost and it was paid,
    // the sweep finds it later and flags the duplicate for refund (never silently lost).
    if (now?.status === "pending" && Date.now() - last.createdAt.getTime() < PROMPT_WINDOW_MS) {
      throw new TRPCError({ code: "CONFLICT", message: "An M-Pesa prompt is already on your phone. Enter your PIN there, or wait a minute and try again." });
    }
    const [after] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
    if (after?.status !== "pending_payment") return { status: after!.status, mock: false };
  }

  return db.transaction(async (tx) => {
    // Lock the order across the push so a double-click can't send two prompts, and the sweep skips it.
    const [locked] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).for("update");
    if (locked?.status !== "pending_payment") throw new TRPCError({ code: "CONFLICT", message: "This order can no longer be paid." });
    const [live] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, "pending"), sql`${payments.createdAt} > now() - make_interval(secs => ${PROMPT_WINDOW_MS / 1000})`));
    if (live) throw new TRPCError({ code: "CONFLICT", message: "An M-Pesa prompt is already on your phone. Enter your PIN there, or wait a minute and try again." });

    let pushed;
    try {
      pushed = await stkPush(cfg, {
        phone,
        amountKes: order.totalCents / 100,
        reference: order.id.slice(0, 8).toUpperCase(),
        description: "kushkousins",
      });
    } catch (e) {
      if (e instanceof DarajaError) throw new TRPCError({ code: "BAD_GATEWAY", message: `We couldn't reach M-Pesa: ${e.message}. Please try again.`, cause: e });
      throw new TRPCError({ code: "BAD_GATEWAY", message: "We couldn't reach M-Pesa. Please try again.", cause: e });
    }
    await tx.insert(payments).values({ orderId, checkoutRequestId: pushed.checkoutRequestId, phone: pushed.msisdn, amountCents: order.totalCents });
    return { status: "pending_payment" as const, mock: false };
  });
}

/** What the checkout polls: the order's status and its latest attempt, reconciling a lost callback. */
export async function paymentStatus(userId: string, orderId: string) {
  const load = async () => {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      columns: { id: true, status: true, totalCents: true },
      with: { payments: { orderBy: [desc(payments.createdAt)], limit: 1 } },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND" });
    return order;
  };
  let order = await load();
  const cfg = mpesaConfig();
  const last = order.payments[0];
  if (cfg && last?.status === "pending" && order.status === "pending_payment") {
    await reconcile(cfg, last);
    order = await load();
  }
  const p = order.payments[0];
  return {
    status: order.status,
    payment: p ? { status: p.status, resultCode: p.resultCode, resultDesc: p.resultDesc } : null,
  };
}

/**
 * Scheduled job: settle pending attempts whose callback never came, then release expired reservations.
 * Reconciling first matters: releasing an order that was actually paid would sell stock twice.
 */
export async function sweepReservations() {
  const cfg = mpesaConfig();
  if (cfg) {
    const stuck = await db
      .select()
      .from(payments)
      .where(and(eq(payments.status, "pending"), lt(payments.createdAt, new Date(Date.now() - QUERY_AFTER_MS))))
      .orderBy(payments.createdAt)
      .limit(20); // shortcut: 20 per run stays under Daraja's query rate limit; a backlog clears over several runs.
    for (const p of stuck) await reconcile(cfg, p);
  }
  const released = await db.transaction((tx) => releaseStaleReservations(tx, new Date(Date.now() - RESERVATION_MINUTES * 60_000)));
  return { released };
}
