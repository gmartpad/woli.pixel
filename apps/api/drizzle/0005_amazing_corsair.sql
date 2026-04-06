CREATE TABLE "image_crops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"original_format" varchar(10) NOT NULL,
	"original_width" integer NOT NULL,
	"original_height" integer NOT NULL,
	"original_size_kb" integer NOT NULL,
	"original_s3_key" text,
	"cropped_width" integer NOT NULL,
	"cropped_height" integer NOT NULL,
	"cropped_format" varchar(10) NOT NULL,
	"cropped_size_kb" integer NOT NULL,
	"cropped_s3_key" text,
	"crop_x" integer NOT NULL,
	"crop_y" integer NOT NULL,
	"crop_w" integer NOT NULL,
	"crop_h" integer NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_crops_created" ON "image_crops" USING btree ("created_at");