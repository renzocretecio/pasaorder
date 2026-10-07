ALTER TYPE "public"."order_source" ADD VALUE 'WEB_CHAT';--> statement-breakpoint
ALTER TABLE "chat_order_drafts" ADD COLUMN "access_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "chat_order_drafts" ADD COLUMN "chat_messages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_order_drafts" ADD CONSTRAINT "chat_order_drafts_access_token_hash_unique" UNIQUE("access_token_hash");