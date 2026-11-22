-- images: text[] of URLs -> jsonb [{ url, color, label }]. A plain type change can't convert the
-- elements, so: add the new column, copy each URL across untagged, drop the old one, rename.
ALTER TABLE "products" ADD COLUMN "images_v2" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "products" SET "images_v2" = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('url', u.url, 'color', NULL, 'label', NULL) ORDER BY u.n)
     FROM unnest("products"."images") WITH ORDINALITY AS u(url, n)),
  '[]'::jsonb
);--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "images";--> statement-breakpoint
ALTER TABLE "products" RENAME COLUMN "images_v2" TO "images";
