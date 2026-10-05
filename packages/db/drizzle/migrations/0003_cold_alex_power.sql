ALTER TABLE "stores" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "accent_color" varchar(7) DEFAULT '#244d35' NOT NULL;