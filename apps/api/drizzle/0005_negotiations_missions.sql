CREATE TABLE "custom_missions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"mission_id" text NOT NULL,
	"mission_version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"status" text NOT NULL,
	"responses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"debrief" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negotiation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"negotiation_id" text NOT NULL,
	"negotiation_version" integer NOT NULL,
	"status" text NOT NULL,
	"round" integer DEFAULT 0 NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preparation" jsonb DEFAULT '{"interests":"","batna":"","walkaway":null,"plan":""}'::jsonb NOT NULL,
	"outcome" jsonb,
	"evaluation" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_missions" ADD CONSTRAINT "custom_missions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_sessions" ADD CONSTRAINT "mission_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_sessions" ADD CONSTRAINT "negotiation_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_sessions_user_idx" ON "mission_sessions" USING btree ("user_id","status","last_activity_at");--> statement-breakpoint
CREATE INDEX "negotiation_sessions_user_idx" ON "negotiation_sessions" USING btree ("user_id","status","last_activity_at");