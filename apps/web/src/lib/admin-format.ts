import type { OrderStatus } from "@repo/types";

/** Server renders must not depend on the host's time zone (production hosts run UTC). */
export const TZ = "Africa/Nairobi";

export const statusLabel: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const orderRef = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;
export const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
