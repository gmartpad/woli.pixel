CREATE TABLE "custom_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"style" varchar(20) DEFAULT 'auto' NOT NULL,
	"output_format" varchar(10) DEFAULT 'png' NOT NULL,
	"max_file_size_kb" integer DEFAULT 500 NOT NULL,
	"requires_transparency" boolean DEFAULT false NOT NULL,
	"prompt_context" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ALTER COLUMN "image_type_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "custom_preset_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_presets" ADD CONSTRAINT "custom_presets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custom_presets_user" ON "custom_presets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_custom_presets_user_name" ON "custom_presets" USING btree ("user_id","name");--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_custom_preset_id_custom_presets_id_fk" FOREIGN KEY ("custom_preset_id") REFERENCES "public"."custom_presets"("id") ON DELETE no action ON UPDATE no action;