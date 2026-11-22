import { z } from "zod";

// Const tuples feed both zod and the Drizzle pgEnums in packages/db.
export const inventoryMode = ["NEW", "UPCYCLED"] as const;
export const InventoryModeSchema = z.enum(inventoryMode);
export type InventoryMode = z.infer<typeof InventoryModeSchema>;

export const productStatus = ["active", "archived", "sold"] as const;
export const ProductStatusSchema = z.enum(productStatus);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const orderStatus = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"] as const;
export const OrderStatusSchema = z.enum(orderStatus);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/** The only allowed order status moves. Paid orders can't be cancelled here (that's a refund: out of scope). */
export const orderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => orderTransitions[from].includes(to);

/** Orders that count as revenue. */
export const revenueStatuses = ["paid", "processing", "shipped", "delivered"] as const satisfies readonly OrderStatus[];

// Better Auth admin plugin stores role as a string; these are the only values we assign.
export const roles = ["CUSTOMER", "ADMIN"] as const;
export const RoleSchema = z.enum(roles);
export type Role = z.infer<typeof RoleSchema>;

const cents = z.number().int().nonnegative();

export const CategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const ProductVariantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  size: z.string(),
  color: z.string(),
  stock: z.number().int().nonnegative(),
});
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

/** One product photo. `color` ties it to a variant colour; null shows for every colour. */
export const ProductImageSchema = z.object({
  url: z.string().trim().url().startsWith("https://", "Image URLs must use https"),
  color: z.string().trim().min(1).max(40).nullable(),
  label: z.string().trim().min(1).max(60).nullable(),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

/**
 * The photos to show for a selected colour: that colour's own first, then the untagged ones.
 * If nothing is tagged for the colour (or none is selected) every photo is shown, in order.
 * Shared by web, mobile and the bag so they can't drift apart.
 */
export function imagesForColor(images: ProductImage[], color: string | null | undefined): ProductImage[] {
  if (!color) return images;
  const key = color.trim().toLowerCase();
  const matches = (i: ProductImage) => i.color?.trim().toLowerCase() === key;
  const own = images.filter(matches);
  return own.length ? [...own, ...images.filter((i) => !i.color)] : images;
}

/**
 * Admin save check: a tagged colour must be one of the product's variant colours (so renaming a
 * colour can't silently strand its photos). Tags are rewritten to the variant's exact spelling.
 */
export function alignImageColors(
  images: ProductImage[],
  variantColors: string[],
): { ok: true; images: ProductImage[] } | { ok: false; message: string } {
  const byKey = new Map(variantColors.map((c) => [c.trim().toLowerCase(), c]));
  const out: ProductImage[] = [];
  for (const i of images) {
    if (!i.color) {
      out.push(i);
      continue;
    }
    const exact = byKey.get(i.color.trim().toLowerCase());
    if (!exact) return { ok: false, message: `A photo is tagged "${i.color}", which isn't one of this product's colours. Pick a current colour or clear the tag.` };
    out.push({ ...i, color: exact });
  }
  return { ok: true, images: out };
}

export const ProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  mode: InventoryModeSchema,
  status: ProductStatusSchema,
  priceCents: cents,
  discountPercent: z.number().int().min(0).max(90).nullable(),
  currency: z.string().length(3),
  images: z.array(ProductImageSchema),
  categoryId: z.string().nullable(),
  originalMaterial: z.string().nullable(), // UPCYCLED only
  artisanNotes: z.string().nullable(), // UPCYCLED only
  hangingLinePosition: z.number().int().nullable(),
  fanFavoritePosition: z.number().int().nullable(),
});
export type Product = z.infer<typeof ProductSchema>;

export const SimilarProductsInputSchema = z.object({
  productId: z.string().uuid(),
  limit: z.number().int().min(1).max(12).default(4),
});

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
/** Garment sizes in wearing order (XS < S < M …); unknown sizes sort after, alphabetically. */
export const compareSizes = (a: string, b: string) => {
  const [ra, rb] = [SIZE_ORDER.indexOf(a), SIZE_ORDER.indexOf(b)];
  return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb) || a.localeCompare(b, undefined, { numeric: true });
};

/**
 * Shopper-facing availability. sold = paid 1-of-1; reserved = active but no stock left (held by an
 * unpaid order, or a NEW item sold out). Shared by web and mobile.
 */
export type Availability = "in_stock" | "reserved" | "sold";
export const availabilityOf = (p: { status: string; variants: { stock: number }[] }): Availability =>
  p.status === "sold" ? "sold" : p.variants.some((v) => v.stock > 0) ? "in_stock" : "reserved";
export const availabilityLabel = (p: { availability: Availability; mode: InventoryMode }) =>
  p.availability === "sold" ? "Sold" : p.availability === "reserved" ? (p.mode === "UPCYCLED" ? "Reserved" : "Sold out") : null;

/** Price after the product's discount, in cents, rounded to whole shillings (M-Pesa charges whole KES only). */
export const salePriceCents = (p: Pick<Product, "priceCents" | "discountPercent">) =>
  Math.round((p.priceCents * (100 - (p.discountPercent ?? 0))) / 10_000) * 100;

/** Kenyan mobile number: 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX or +2547XXXXXXXX (spaces allowed). */
export const KenyanPhoneSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^(?:\+?254|0)[17]\d{8}$/, "Enter a Kenyan mobile number, e.g. 0712 345 678"));

/** M-Pesa (Daraja) wants 2547XXXXXXXX. Input must already pass KenyanPhoneSchema. */
export const toMsisdn = (phone: string) => `254${phone.replace(/\s+/g, "").replace(/^(?:\+?254|0)/, "")}`;

// shortcut: flat shipping guess (KES 400, free from KES 10,000). Confirm with the business; move to admin settings in Phase 4.
export const FREE_SHIPPING_FROM_CENTS = 1_000_000;
export const SHIPPING_CENTS = 40_000;
export const shippingCents = (subtotalCents: number) =>
  subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_FROM_CENTS ? 0 : SHIPPING_CENTS;

export const CartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(20),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const AddressSchema = z.object({
  label: z.string().max(40).optional(),
  recipientName: z.string().min(1).max(120),
  phone: KenyanPhoneSchema,
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(80),
  county: z.string().min(1).max(80),
  postalCode: z.string().max(20).optional(),
});
export type AddressInput = z.infer<typeof AddressSchema>;

export const CreateOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1).max(50),
  shippingAddress: AddressSchema,
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: OrderStatusSchema,
  subtotalCents: cents,
  shippingCents: cents,
  totalCents: cents,
  currency: z.string().length(3),
  mpesaReceiptNumber: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type Order = z.infer<typeof OrderSchema>;

// ---- Admin inventory

export const SlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only");

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const VariantLabel = z.string().trim().min(1).max(40);

const ProductBase = z.object({
  name: z.string().trim().min(2).max(120),
  slug: SlugSchema,
  description: z.string().trim().max(4000).nullable(),
  priceCents: z.number().int().min(0).max(100_000_000).multipleOf(100, "Prices are whole shillings"),
  discountPercent: z.number().int().min(0).max(90).nullable(),
  categoryId: z.string().uuid().nullable(),
  images: z.array(ProductImageSchema).max(12),
});

const uniquePairs = (rows: { size: string; color: string }[]) =>
  new Set(rows.map((r) => `${r.size.trim().toLowerCase()}|${r.color.trim().toLowerCase()}`)).size === rows.length;
const pairMessage = { message: "Each size + colour combination can appear only once", path: ["variants"] };

const NewVariantInput = z.object({ size: VariantLabel, color: VariantLabel, stock: z.number().int().min(0).max(100_000) });
const UpcycledFields = z.object({
  size: VariantLabel,
  color: VariantLabel,
  originalMaterial: z.string().trim().min(2).max(300),
  artisanNotes: z.string().trim().min(2).max(1000),
});

export const AdminProductCreateSchema = z.discriminatedUnion("mode", [
  ProductBase.extend({ mode: z.literal("NEW"), variants: z.array(NewVariantInput).min(1).max(60).refine(uniquePairs, pairMessage) }),
  ProductBase.extend({ mode: z.literal("UPCYCLED") }).merge(UpcycledFields),
]);
export type AdminProductCreate = z.infer<typeof AdminProductCreateSchema>;

/**
 * Existing NEW variants carry `expectedStock` (the value the editor loaded): the write is
 * compare-and-set, so a reservation made while the form was open is never overwritten.
 */
export const AdminProductUpdateSchema = z.discriminatedUnion("mode", [
  ProductBase.extend({
    id: z.string().uuid(),
    mode: z.literal("NEW"),
    variants: z
      .array(NewVariantInput.extend({ id: z.string().uuid().optional(), expectedStock: z.number().int().min(0).optional() }))
      .min(1)
      .max(60)
      .refine(uniquePairs, pairMessage),
  }),
  ProductBase.extend({ id: z.string().uuid(), mode: z.literal("UPCYCLED") }).merge(UpcycledFields),
]);
export type AdminProductUpdate = z.infer<typeof AdminProductUpdateSchema>;

/** M-Pesa receipt numbers are 10 uppercase letters/digits, e.g. QK4XYZ12AB. */
export const MpesaReceiptSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{10}$/, "M-Pesa receipts are 10 letters/numbers, e.g. QK4XYZ12AB");

// ---- M-Pesa (Daraja STK Push)

/** Unpaid orders hold their stock this long after the last payment attempt (or creation). */
export const RESERVATION_MINUTES = 20;

const CallbackItem = z.object({ Name: z.string(), Value: z.union([z.string(), z.number()]).optional() });

/** The JSON Safaricom POSTs to the STK callback URL. Unsigned: only trust it after matching the attempt and amount. */
export const StkCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string().min(1),
      ResultCode: z.coerce.number().int(),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({ Item: z.array(CallbackItem) }).optional(),
    }),
  }),
});
export type StkCallback = z.infer<typeof StkCallbackSchema>;

/** Flatten the callback into the fields we use. */
export function parseStkCallback(body: StkCallback) {
  const cb = body.Body.stkCallback;
  const item = (name: string) => cb.CallbackMetadata?.Item.find((i) => i.Name === name)?.Value;
  const amount = item("Amount");
  const receipt = item("MpesaReceiptNumber");
  const phone = item("PhoneNumber");
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    amountKes: amount === undefined ? undefined : Number(amount),
    receipt: receipt === undefined ? undefined : String(receipt),
    phone: phone === undefined ? undefined : String(phone),
  };
}

/** Customer-facing reason for a failed STK attempt. Codes beyond these vary across Safaricom docs, so fall back to their text. */
export const stkFailureMessage = (resultCode: number | null, resultDesc: string | null) =>
  resultCode === 1032
    ? "You cancelled the M-Pesa prompt."
    : resultCode === 1037
      ? "The M-Pesa prompt timed out before a PIN was entered. Check your phone is on and try again."
      : `M-Pesa didn't complete the payment${resultDesc ? `: ${resultDesc}` : "."}`;
