CREATE TABLE "avatar_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"s3_key" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "avatar_history" ADD CONSTRAINT "avatar_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avatar_history_user_id_idx" ON "avatar_history" USING btree ("user_id");