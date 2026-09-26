CREATE TABLE "daily_briefings" (
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"payload" jsonb NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_briefings_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "decision_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"context" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"objective" text NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chosen_action" text NOT NULL,
	"rationale" text NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real NOT NULL,
	"predictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actual_outcome" text DEFAULT '' NOT NULL,
	"lessons" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"review_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategic_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"links" jsonb DEFAULT '{"treeIds":[],"councilIds":[],"documentIds":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_briefings" ADD CONSTRAINT "daily_briefings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_project_id_strategic_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."strategic_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_projects" ADD CONSTRAINT "strategic_projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_records_user_idx" ON "decision_records" USING btree ("user_id","status","review_at");--> statement-breakpoint
CREATE INDEX "strategic_projects_user_idx" ON "strategic_projects" USING btree ("user_id","updated_at");