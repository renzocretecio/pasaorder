CREATE TABLE "meta_oauth_sessions" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"store_id" bigint NOT NULL,
	"owner_id" bigint NOT NULL,
	"pages" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_page_connections" (
	"store_id" bigint PRIMARY KEY NOT NULL,
	"page_id" varchar(64) NOT NULL,
	"page_name" varchar(255) NOT NULL,
	"encrypted_page_access_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_page_connections_page_id_unique" UNIQUE("page_id")
);
--> statement-breakpoint
ALTER TABLE "chat_order_drafts" ADD COLUMN "provider_conversation_id" varchar(255);--> statement-breakpoint
ALTER TABLE "meta_oauth_sessions" ADD CONSTRAINT "meta_oauth_sessions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_oauth_sessions" ADD CONSTRAINT "meta_oauth_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_page_connections" ADD CONSTRAINT "meta_page_connections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_order_drafts_external_active_idx" ON "chat_order_drafts" USING btree ("store_id","provider_conversation_id") WHERE "chat_order_drafts"."provider_conversation_id" IS NOT NULL AND "chat_order_drafts"."status" = 'DRAFT';