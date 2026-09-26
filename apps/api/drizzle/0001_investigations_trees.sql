CREATE TABLE "investigation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"investigation_id" text NOT NULL,
	"investigation_version" integer NOT NULL,
	"status" text NOT NULL,
	"points_remaining" integer NOT NULL,
	"revealed_evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions_taken" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hypotheses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hint_level" integer DEFAULT 0 NOT NULL,
	"conclusion" jsonb,
	"evaluation" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_trees" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"context" jsonb DEFAULT '{"kind":"free","refId":null}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"graph" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"critiques" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investigation_sessions" ADD CONSTRAINT "investigation_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_trees" ADD CONSTRAINT "scenario_trees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investigation_sessions_user_idx" ON "investigation_sessions" USING btree ("user_id","status","last_activity_at");--> statement-breakpoint
CREATE INDEX "scenario_trees_user_idx" ON "scenario_trees" USING btree ("user_id","updated_at");