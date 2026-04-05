CREATE TABLE "audit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_job_id" uuid NOT NULL,
	"source_url" text,
	"original_filename" varchar(255) NOT NULL,
	"original_width" integer,
	"original_height" integer,
	"original_size_kb" integer,
	"original_format" varchar(10),
	"file_path" text,
	"quality_score" integer,
	"content_type" varchar(50),
	"quality_issues" text[],
	"suggested_type_key" varchar(50),
	"suggestion_confidence" integer,
	"dominant_colors" text[],
	"analysis_json" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"source_type" varchar(20) DEFAULT 'folder_upload' NOT NULL,
	"total_images" integer DEFAULT 0 NOT NULL,
	"scanned_images" integer DEFAULT 0 NOT NULL,
	"passed_images" integer DEFAULT 0 NOT NULL,
	"failed_images" integer DEFAULT 0 NOT NULL,
	"error_images" integer DEFAULT 0 NOT NULL,
	"avg_quality_score" numeric(4, 1),
	"pass_threshold" integer DEFAULT 7 NOT NULL,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"report_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "batch_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100),
	"total_images" integer DEFAULT 0 NOT NULL,
	"completed_images" integer DEFAULT 0 NOT NULL,
	"failed_images" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"primary_color" varchar(7) NOT NULL,
	"secondary_color" varchar(7),
	"accent_color" varchar(7),
	"neutral_color" varchar(7),
	"forbidden_colors" text[],
	"logo_upload_id" uuid,
	"tolerance" integer DEFAULT 25 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gate_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_config_id" uuid NOT NULL,
	"image_upload_id" uuid NOT NULL,
	"verdict" varchar(10) NOT NULL,
	"quality_score" integer NOT NULL,
	"failures" text[],
	"warnings" text[],
	"metadata_json" jsonb,
	"source" varchar(50) NOT NULL,
	"source_reference" varchar(200),
	"checked_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "image_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(20) NOT NULL,
	"type_key" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"width" integer,
	"height" integer,
	"aspect_ratio" varchar(20),
	"max_file_size_kb" integer NOT NULL,
	"allowed_formats" text[] NOT NULL,
	"recommended_format" varchar(10) NOT NULL,
	"requires_transparency" boolean DEFAULT false,
	"min_width" integer,
	"preview_context" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "image_types_type_key_unique" UNIQUE("type_key")
);
--> statement-breakpoint
CREATE TABLE "image_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"original_format" varchar(10) NOT NULL,
	"original_width" integer NOT NULL,
	"original_height" integer NOT NULL,
	"original_size_kb" integer NOT NULL,
	"ai_quality_score" integer,
	"ai_content_type" varchar(50),
	"ai_quality_issues" text[],
	"ai_suggested_type_id" uuid,
	"ai_suggestion_confidence" integer,
	"ai_analysis_json" jsonb,
	"target_image_type_id" uuid,
	"processed_width" integer,
	"processed_height" integer,
	"processed_format" varchar(10),
	"processed_size_kb" integer,
	"adjustments_made" text[],
	"ai_explanation" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"original_path" text,
	"processed_path" text,
	"batch_id" uuid,
	"batch_index" integer,
	"brand_profile_id" uuid,
	"brand_score" integer,
	"brand_issues" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quality_gate_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"min_quality_score" integer DEFAULT 6 NOT NULL,
	"max_file_size_kb" integer,
	"require_no_blur" boolean DEFAULT true NOT NULL,
	"require_no_low_resolution" boolean DEFAULT true NOT NULL,
	"require_min_width" integer,
	"require_min_height" integer,
	"allowed_content_types" text[],
	"blocked_content_types" text[],
	"brand_profile_id" uuid,
	"webhook_secret" varchar(64),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_items" ADD CONSTRAINT "audit_items_audit_job_id_audit_jobs_id_fk" FOREIGN KEY ("audit_job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_results" ADD CONSTRAINT "gate_results_gate_config_id_quality_gate_configs_id_fk" FOREIGN KEY ("gate_config_id") REFERENCES "public"."quality_gate_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_results" ADD CONSTRAINT "gate_results_image_upload_id_image_uploads_id_fk" FOREIGN KEY ("image_upload_id") REFERENCES "public"."image_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_uploads" ADD CONSTRAINT "image_uploads_ai_suggested_type_id_image_types_id_fk" FOREIGN KEY ("ai_suggested_type_id") REFERENCES "public"."image_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_uploads" ADD CONSTRAINT "image_uploads_target_image_type_id_image_types_id_fk" FOREIGN KEY ("target_image_type_id") REFERENCES "public"."image_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_uploads" ADD CONSTRAINT "image_uploads_batch_id_batch_jobs_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batch_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_uploads" ADD CONSTRAINT "image_uploads_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_gate_configs" ADD CONSTRAINT "quality_gate_configs_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_items_job" ON "audit_items" USING btree ("audit_job_id");--> statement-breakpoint
CREATE INDEX "idx_audit_items_score" ON "audit_items" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "idx_gate_results_verdict" ON "gate_results" USING btree ("verdict");--> statement-breakpoint
CREATE INDEX "idx_gate_results_config" ON "gate_results" USING btree ("gate_config_id");--> statement-breakpoint
CREATE INDEX "idx_gate_results_source" ON "gate_results" USING btree ("source","source_reference");--> statement-breakpoint
CREATE INDEX "idx_uploads_status" ON "image_uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_uploads_created" ON "image_uploads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_uploads_batch" ON "image_uploads" USING btree ("batch_id");