ALTER TABLE "patterns" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "yarn" ADD COLUMN "user_id" text NOT NULL;