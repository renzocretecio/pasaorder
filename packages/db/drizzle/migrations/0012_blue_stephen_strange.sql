CREATE TABLE "owner_preferences" (
	"owner_id" bigint PRIMARY KEY NOT NULL,
	"default_store_id" bigint
);
--> statement-breakpoint
ALTER TABLE "owner_preferences" ADD CONSTRAINT "owner_preferences_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_preferences" ADD CONSTRAINT "owner_preferences_default_store_id_stores_id_fk" FOREIGN KEY ("default_store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "owner_preferences" ("owner_id", "default_store_id") SELECT DISTINCT ON ("owner_id") "owner_id", "id" FROM "stores" ORDER BY "owner_id", "created_at" DESC, "id" DESC;
