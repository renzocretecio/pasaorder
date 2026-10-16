CREATE TABLE "payment_proofs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"object_key" text NOT NULL,
	"file_name" varchar(160) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_proofs_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "payment_proofs_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_proofs_order_id_idx" ON "payment_proofs" USING btree ("order_id");