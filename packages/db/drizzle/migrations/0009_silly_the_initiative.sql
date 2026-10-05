ALTER TABLE "orders" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_name" varchar(255);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "option_label" varchar(80);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "special_instructions" varchar(500);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_name" varchar(120);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_phone" varchar(40);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_token" varchar(36);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" varchar(36);--> statement-breakpoint
UPDATE "orders" o SET "customer_name" = COALESCE(u."name", 'Customer'), "customer_phone" = '', "tracking_token" = gen_random_uuid()::text, "idempotency_key" = 'legacy-' || o."id"::text FROM "users" u WHERE u."id" = o."customer_id";--> statement-breakpoint
UPDATE "order_items" oi SET "product_name" = p."name" FROM "products" p WHERE p."id" = oi."product_id";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "tracking_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tracking_token_unique" UNIQUE("tracking_token");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key");
