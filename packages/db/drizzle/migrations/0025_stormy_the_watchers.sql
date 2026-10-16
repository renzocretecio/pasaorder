ALTER TABLE "order_items" ADD COLUMN "product_type" varchar(32) DEFAULT 'PHYSICAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_type" varchar(32) DEFAULT 'PHYSICAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "business_category" varchar(32) DEFAULT 'OTHER' NOT NULL;