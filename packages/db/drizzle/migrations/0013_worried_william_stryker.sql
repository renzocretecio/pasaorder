CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'GCASH');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('UNPAID', 'PAID');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" "payment_method" DEFAULT 'CASH' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" "payment_status" DEFAULT 'UNPAID' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_instructions" jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "payment_methods" jsonb DEFAULT '["CASH"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "gcash_account_name" varchar(120);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "gcash_number" varchar(40);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "gcash_qr_url" text;