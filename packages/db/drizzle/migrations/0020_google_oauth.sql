CREATE TABLE "google_oauth_codes" (
	"code_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_oauth_states" (
	"state_hash" varchar(64) PRIMARY KEY NOT NULL,
	"nonce" varchar(64) NOT NULL,
	"code_verifier" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" varchar(255);--> statement-breakpoint
ALTER TABLE "google_oauth_codes" ADD CONSTRAINT "google_oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "google_oauth_codes_expires_at_idx" ON "google_oauth_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "google_oauth_states_expires_at_idx" ON "google_oauth_states" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub");