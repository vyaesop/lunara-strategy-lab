CREATE TABLE "knowledge_concepts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"provenance" jsonb NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"kind" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"provenance" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"project_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"source_url" text,
	"content" text DEFAULT '' NOT NULL,
	"page_starts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"length" integer DEFAULT 0 NOT NULL,
	"page_count" integer,
	"progress" real DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"document_id" text,
	"project_id" text,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"locator" text,
	"range" jsonb,
	"concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origin" text DEFAULT 'typed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"kind" text NOT NULL,
	"prompt" text NOT NULL,
	"answer" text NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"source" jsonb NOT NULL,
	"concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skill" text,
	"card" jsonb NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_concepts" ADD CONSTRAINT "knowledge_concepts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_from_id_knowledge_concepts_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."knowledge_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_to_id_knowledge_concepts_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."knowledge_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_documents" ADD CONSTRAINT "reading_documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_documents" ADD CONSTRAINT "reading_documents_project_id_reading_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."reading_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_notes" ADD CONSTRAINT "reading_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_notes" ADD CONSTRAINT "reading_notes_document_id_reading_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."reading_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_notes" ADD CONSTRAINT "reading_notes_project_id_reading_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."reading_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_projects" ADD CONSTRAINT "reading_projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_concepts_user_slug_idx" ON "knowledge_concepts" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "knowledge_relations_user_idx" ON "knowledge_relations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reading_documents_user_idx" ON "reading_documents" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "reading_notes_user_doc_idx" ON "reading_notes" USING btree ("user_id","document_id","created_at");--> statement-breakpoint
CREATE INDEX "review_items_user_due_idx" ON "review_items" USING btree ("user_id","suspended","due");