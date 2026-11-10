CREATE TYPE "public"."owner_subscription_payment_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."owner_subscription_status" AS ENUM('PENDING', 'ACTIVE', 'PAST_DUE', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "owner_subscription_payments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "owner_subscription_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" bigint NOT NULL,
	"gcash_reference" varchar(80) NOT NULL,
	"amount_minor" integer NOT NULL,
	"status" "owner_subscription_payment_status" DEFAULT 'PENDING' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" bigint,
	"rejection_reason" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "owner_subscriptions" (
	"owner_id" bigint PRIMARY KEY NOT NULL,
	"status" "owner_subscription_status" DEFAULT 'PENDING' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"grace_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "owner_subscription_payments" ADD CONSTRAINT "owner_subscription_payments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_subscription_payments" ADD CONSTRAINT "owner_subscription_payments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_subscriptions" ADD CONSTRAINT "owner_subscriptions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "owner_subscription_payments_reference_unique" ON "owner_subscription_payments" USING btree ("gcash_reference");--> statement-breakpoint
CREATE INDEX "owner_subscription_payments_status_submitted_idx" ON "owner_subscription_payments" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "owner_subscription_payments_owner_submitted_idx" ON "owner_subscription_payments" USING btree ("owner_id","submitted_at");