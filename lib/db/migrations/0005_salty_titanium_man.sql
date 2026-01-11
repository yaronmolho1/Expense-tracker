ALTER TABLE "businesses" ADD COLUMN "approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD COLUMN "total_amount_ils" numeric(12, 2);