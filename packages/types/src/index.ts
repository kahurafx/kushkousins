import { z } from "zod";

export const orderStatus = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
export const OrderStatusSchema = z.enum(orderStatus);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const ProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("KES"),
  imageUrl: z.string().url().nullable(),
  stock: z.number().int().nonnegative(),
  categoryId: z.string().nullable(),
});
export type Product = z.infer<typeof ProductSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CreateOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: OrderStatusSchema,
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: z.coerce.date(),
});
export type Order = z.infer<typeof OrderSchema>;
