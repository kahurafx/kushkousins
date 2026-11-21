// Safaricom Daraja (M-Pesa Express / STK Push) client. Plain fetch: no SDK dependency.
import { toMsisdn } from "@repo/types";

export type MpesaConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string; // BusinessShortCode (paybill, or the store number for Buy Goods)
  partyB: string; // paybill, or the till number for Buy Goods
  passkey: string;
  transactionType: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
  callbackUrl: string;
};

/** null when Daraja isn't configured: callers must fail closed, never fall back to mock payments. */
export function mpesaConfig(env: NodeJS.ProcessEnv = process.env): MpesaConfig | null {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL, MPESA_CALLBACK_SECRET } = env;
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY || !MPESA_CALLBACK_URL || !MPESA_CALLBACK_SECRET) return null;
  return {
    baseUrl: env.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey: MPESA_CONSUMER_KEY,
    consumerSecret: MPESA_CONSUMER_SECRET,
    shortcode: MPESA_SHORTCODE,
    partyB: env.MPESA_PARTY_B || MPESA_SHORTCODE,
    passkey: MPESA_PASSKEY,
    transactionType: env.MPESA_TRANSACTION_TYPE === "CustomerBuyGoodsOnline" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
    // The secret is a path segment: Daraja doesn't sign callbacks, so the URL is the shared secret.
    callbackUrl: `${MPESA_CALLBACK_URL.replace(/\/+$/, "")}/api/payments/callback/${MPESA_CALLBACK_SECRET}`,
  };
}

/** yyyyMMddHHmmss in Nairobi time, as Daraja expects. */
export function darajaTimestamp(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
}

export const stkPassword = (shortcode: string, passkey: string, timestamp: string) =>
  Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

export class DarajaError extends Error {}

let token: { value: string; expiresAt: number; key: string } | null = null;

async function call<T>(cfg: MpesaConfig, path: string, init: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${cfg.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    throw new DarajaError(`Daraja ${path} returned ${res.status} (not JSON)`);
  }
  return { status: res.status, body };
}

async function accessToken(cfg: MpesaConfig) {
  if (token && token.key === cfg.consumerKey && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64");
  const { status, body } = await call<{ access_token?: string; expires_in?: string | number }>(cfg, "/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (status !== 200 || !body.access_token) throw new DarajaError(`Daraja auth failed (${status})`);
  token = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 3599) * 1000, key: cfg.consumerKey };
  return token.value;
}

async function post<T>(cfg: MpesaConfig, path: string, payload: object) {
  const auth = await accessToken(cfg);
  return call<T>(cfg, path, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Send the PIN prompt. Resolves with the CheckoutRequestID once Safaricom accepts the request (not the payment). */
export async function stkPush(cfg: MpesaConfig, input: { phone: string; amountKes: number; reference: string; description: string }) {
  const timestamp = darajaTimestamp();
  const msisdn = toMsisdn(input.phone);
  const { body } = await post<{ ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string; CustomerMessage?: string }>(
    cfg,
    "/mpesa/stkpush/v1/processrequest",
    {
      BusinessShortCode: cfg.shortcode,
      Password: stkPassword(cfg.shortcode, cfg.passkey, timestamp),
      Timestamp: timestamp,
      TransactionType: cfg.transactionType,
      Amount: input.amountKes,
      PartyA: msisdn,
      PartyB: cfg.partyB,
      PhoneNumber: msisdn,
      CallBackURL: cfg.callbackUrl,
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    },
  );
  if (body.ResponseCode !== "0" || !body.CheckoutRequestID) throw new DarajaError(body.errorMessage ?? body.CustomerMessage ?? "M-Pesa didn't accept the request");
  return { checkoutRequestId: body.CheckoutRequestID, msisdn };
}

/**
 * Ask Safaricom how an STK attempt ended. `pending` while the customer still has the prompt open
 * (Daraja answers with an error body, not a ResultCode, until the transaction settles).
 * Note: the query result carries no receipt number; the callback does.
 */
export async function stkQuery(cfg: MpesaConfig, checkoutRequestId: string): Promise<{ state: "pending" } | { state: "done"; resultCode: number; resultDesc: string }> {
  const timestamp = darajaTimestamp();
  const { body } = await post<{ ResultCode?: string | number; ResultDesc?: string }>(cfg, "/mpesa/stkpushquery/v1/query", {
    BusinessShortCode: cfg.shortcode,
    Password: stkPassword(cfg.shortcode, cfg.passkey, timestamp),
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  });
  if (body.ResultCode === undefined || body.ResultCode === "") return { state: "pending" };
  return { state: "done", resultCode: Number(body.ResultCode), resultDesc: body.ResultDesc ?? "" };
}

/** Test hook: forget the cached token. */
export const resetMpesaToken = () => {
  token = null;
};
