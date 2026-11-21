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
  images: z.array(z.string()),
  categoryId: z.string().nullable(),
  originalMaterial: z.string().nullable(), // UPCYCLED only
  artisanNotes: z.string().nullable(), // UPCYCLED only
  hangingLinePosition: z.number().int().nullable(),
  fanFavoritePosition: z.number().int().nullable(),
});
export type Product = z.infer<typeof ProductSchema>;

/** Price after the product's discount, in cents. */
export const salePriceCents = (p: Pick<Product, "priceCents" | "discountPercent">) =>
  Math.round((p.priceCents * (100 - (p.discountPercent ?? 0))) / 100);

export const CartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(20),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const AddressSchema = z.object({
  label: z.string().max(40).optional(),
  recipientName: z.string().min(1).max(120),
  phone: z.string().regex(/^(?:\+?254|0)[17]\d{8}$/, "Kenyan phone number"),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(80),
  county: z.string().min(1).max(80),
  postalCode: z.string().max(20).optional(),
});
export type AddressInput = z.infer<typeof AddressSchema>;

export const CreateOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1),
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
