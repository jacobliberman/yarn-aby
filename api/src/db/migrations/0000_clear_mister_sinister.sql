CREATE TABLE "patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"designer" text,
	"craft_type" text NOT NULL,
	"difficulty" text,
	"yarn_weight" text,
	"yardage_needed" integer,
	"source_url" text,
	"pdf_url" text,
	"notes" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_yarn" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"yarn_id" integer,
	"skeins_used" numeric(14, 4)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_id" integer,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"photo_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "yarn" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"colorway" text NOT NULL,
	"weight" text NOT NULL,
	"fiber" text,
	"yardage" integer,
	"skeins" numeric(14, 4) NOT NULL,
	"color_code" text,
	"photo_url" text,
	"notes" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "project_yarn" ADD CONSTRAINT "project_yarn_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_yarn" ADD CONSTRAINT "project_yarn_yarn_id_yarn_id_fk" FOREIGN KEY ("yarn_id") REFERENCES "public"."yarn"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_pattern_id_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."patterns"("id") ON DELETE no action ON UPDATE no action;