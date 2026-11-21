CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"checkout_request_id" text NOT NULL,
	"phone" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"result_code" integer,
	"result_desc" text,
	"receipt" text,
	"applied" boolean DEFAULT false NOT NULL,
	"queried_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_checkout_request_id_unique" UNIQUE("checkout_request_id"),
	CONSTRAINT "payments_receipt_unique" UNIQUE("receipt")
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_mpesa_checkout_request_id_unique";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "mpesa_checkout_request_id";