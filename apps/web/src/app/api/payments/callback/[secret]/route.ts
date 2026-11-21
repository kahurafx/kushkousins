// Safaricom Daraja STK callback. Not tRPC: Safaricom POSTs raw JSON. The path avoids the word "mpesa",
// which Daraja is reported to reject in callback URLs.
import { timingSafeEqual } from "node:crypto";
import { handleStkCallback } from "@repo/api";

const accepted = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });

const secretMatches = (given: string) => {
  const want = process.env.MPESA_CALLBACK_SECRET;
  if (!want) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  // Daraja doesn't sign callbacks; the secret URL is the authentication.
  if (!secretMatches((await params).secret)) return new Response("Not found", { status: 404 });
  const body = await req.json().catch(() => null);
  try {
    const { outcome } = await handleStkCallback(body);
    if (outcome === "invalid" || outcome === "unknown" || outcome === "mismatch" || outcome === "needs_refund") {
      console.error(`M-Pesa callback: ${outcome}`, JSON.stringify(body));
    }
  } catch (e) {
    // A 5xx invites a retry; the checkout poll and the sweep also reconcile through STK Query.
    console.error("M-Pesa callback failed", e);
    return new Response("Error", { status: 500 });
  }
  return accepted(); // duplicates and unknown IDs too: Safaricom only needs to know we received it
}
