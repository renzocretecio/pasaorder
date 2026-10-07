CREATE TYPE "public"."order_source" AS ENUM('MENU', 'MESSENGER', 'INSTAGRAM');--> statement-breakpoint
CREATE TABLE "chat_order_drafts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_order_drafts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"store_id" bigint NOT NULL,
	"source" "order_source" NOT NULL,
	"conversation_text" text NOT NULL,
	"draft_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"order_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" "order_source" DEFAULT 'MENU' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_order_drafts" ADD CONSTRAINT "chat_order_drafts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_order_drafts" ADD CONSTRAINT "chat_order_drafts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_order_drafts_store_status_idx" ON "chat_order_drafts" USING btree ("store_id","status");