ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_fee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "order_types" jsonb DEFAULT '["DINE_IN","PICKUP","DELIVERY"]'::jsonb NOT NULL;
