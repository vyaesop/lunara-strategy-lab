CREATE TABLE "council_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"brief" text NOT NULL,
	"tree_id" text,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"depth" text DEFAULT 'concise' NOT NULL,
	"status" text NOT NULL,
	"analyses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"critiques" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exchanges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision" jsonb,
	"usage" jsonb DEFAULT '{"calls":0,"estimatedCostUsd":0,"latencyMs":0}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"simulation_id" text NOT NULL,
	"simulation_version" integer NOT NULL,
	"status" text NOT NULL,
	"current_turn_id" text,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revealed_evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hint_level" integer DEFAULT 0 NOT NULL,
	"evaluation" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "council_sessions" ADD CONSTRAINT "council_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_sessions" ADD CONSTRAINT "simulation_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "council_sessions_user_idx" ON "council_sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "simulation_sessions_user_idx" ON "simulation_sessions" USING btree ("user_id","status","last_activity_at");