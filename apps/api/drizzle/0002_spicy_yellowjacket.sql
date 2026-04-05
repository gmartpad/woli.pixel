ALTER TABLE "audit_items" ADD COLUMN "s3_key" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "processed_s3_key" text;--> statement-breakpoint
ALTER TABLE "image_uploads" ADD COLUMN "original_s3_key" text;--> statement-breakpoint
ALTER TABLE "image_uploads" ADD COLUMN "processed_s3_key" text;