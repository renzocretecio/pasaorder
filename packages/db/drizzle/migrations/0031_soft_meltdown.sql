CREATE TYPE "public"."owner_plan" AS ENUM('FREE', 'PRO');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" "owner_plan" DEFAULT 'FREE' NOT NULL;