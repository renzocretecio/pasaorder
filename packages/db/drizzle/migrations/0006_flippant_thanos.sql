ALTER TABLE "stores" ADD COLUMN "contact_phone" varchar(40);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "operating_hours" jsonb;