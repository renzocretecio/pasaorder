ALTER TABLE "stores" ADD COLUMN "owner_id" bigint;--> statement-breakpoint
UPDATE "stores" AS s SET "owner_id" = b."owner_id" FROM "businesses" AS b WHERE s."business_id" = b."id";--> statement-breakpoint
ALTER TABLE "stores" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" DROP CONSTRAINT "stores_business_id_businesses_id_fk";--> statement-breakpoint
ALTER TABLE "stores" DROP COLUMN "business_id";--> statement-breakpoint
DROP TABLE "businesses";
