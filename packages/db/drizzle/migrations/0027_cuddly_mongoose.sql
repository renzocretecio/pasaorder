CREATE TABLE "order_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"order_item_id" bigint,
	"question_id" varchar(36) NOT NULL,
	"question_label" varchar(100) NOT NULL,
	"object_key" text NOT NULL,
	"file_name" varchar(160) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_attachments_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_attachments_order_id_idx" ON "order_attachments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_attachments_order_item_id_idx" ON "order_attachments" USING btree ("order_item_id");