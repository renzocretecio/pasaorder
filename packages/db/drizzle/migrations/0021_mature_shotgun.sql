CREATE TABLE "meta_instagram_connections" (
	"store_id" bigint PRIMARY KEY NOT NULL,
	"instagram_id" varchar(64) NOT NULL,
	"instagram_username" varchar(255) NOT NULL,
	"page_id" varchar(64) NOT NULL,
	"encrypted_page_access_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_instagram_connections_instagram_id_unique" UNIQUE("instagram_id")
);
--> statement-breakpoint
ALTER TABLE "meta_instagram_connections" ADD CONSTRAINT "meta_instagram_connections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;