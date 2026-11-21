import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { inventoryMode, orderStatus, productStatus, type AddressInput } from "@repo/types";
import { user } from "./auth";

export const inventoryModeEnum = pgEnum("inventory_mode", inventoryMode);
export const productStatusEnum = pgEnum("product_status", productStatus);
export const orderStatusEnum = pgEnum("order_status", orderStatus);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "succeeded", "failed"]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    mode: inventoryModeEnum("mode").notNull(),
    status: productStatusEnum("status").notNull().default("active"),
    priceCents: integer("price_cents").notNull(),
    discountPercent: integer("discount_percent"),
    currency: text("currency").notNull().default("KES"),
    images: text("images").array().notNull().default(sql`'{}'::text[]`),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    // UPCYCLED provenance
    originalMaterial: text("original_material"),
    artisanNotes: text("artisan_notes"),
    // Landing curation: null = not shown; lower = earlier
    hangingLinePosition: integer("hanging_line_position"),
    fanFavoritePosition: integer("fan_favorite_position"),
    featured: boolean("featured").notNull().default(false), // editor's pick: star badge
    soldAt: timestamp("sold_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_mode_status_idx").on(t.mode, t.status),
    check("products_price_nonneg", sql`${t.priceCents} >= 0`),
    check("products_discount_range", sql`${t.discountPercent} IS NULL OR ${t.discountPercent} BETWEEN 0 AND 90`),
  ],
);

// All stock lives here. NEW: size × color matrix. UPCYCLED: exactly one variant with stock 1.
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    size: text("size").notNull(),
    color: text("color").notNull(),
    stock: integer("stock").notNull().default(0),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    check("variants_stock_nonneg", sql`${t.stock} >= 0`),
  ],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    label: text("label"),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    county: text("county").notNull(),
    postalCode: text("postal_code"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("KES"),
    shippingAddress: jsonb("shipping_address").$type<AddressInput>().notNull(), // snapshot
    mpesaPhone: text("mpesa_phone"),
    mpesaReceiptNumber: text("mpesa_receipt_number").unique(),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    // Snapshot at purchase so history survives product edits/deletes
    productName: text("product_name").notNull(),
    size: text("size").notNull(),
    color: text("color").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_qty_pos", sql`${t.quantity} > 0`)],
);

/**
 * One row per STK Push. An order can have several (cancelled prompt, wrong PIN, timeout → retry), and a late
 * success for an earlier attempt must still find its order. A succeeded payment on a cancelled order needs a
 * manual refund (as does a second success on an already-paid order): succeeded && !applied. `refundedAt` records
 * that an admin handled it.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    checkoutRequestId: text("checkout_request_id").notNull().unique(),
    phone: text("phone").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    resultCode: integer("result_code"),
    resultDesc: text("result_desc"),
    receipt: text("receipt").unique(),
    applied: boolean("applied").notNull().default(false), // this payment marked the order paid
    queriedAt: timestamp("queried_at"), // last STK Query, to throttle reconciliation
    refundedAt: timestamp("refunded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_status_idx").on(t.status)],
);

export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
}));
export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));
export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(user, { fields: [addresses.userId], references: [user.id] }),
}));
export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  user: one(user, { fields: [wishlistItems.userId], references: [user.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  items: many(orderItems),
  payments: many(payments),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
