// Scheduled sweep: settle unanswered M-Pesa attempts, then release expired reservations.
// Call every few minutes with `Authorization: Bearer $CRON_SECRET` (the Vercel Cron convention).
import { timingSafeEqual } from "node:crypto";
import { sweepReservations } from "@repo/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const want = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${want}`);
  if (!want || given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await sweepReservations());
}
