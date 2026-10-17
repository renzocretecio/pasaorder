ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "quantity_unit" varchar(8) DEFAULT 'EACH' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "quantity_unit" varchar(8) DEFAULT 'EACH' NOT NULL;