CREATE TYPE "public"."categorization_source" AS ENUM('user', 'llm', 'imported', 'suggested');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('one_time', 'installments');--> statement-breakpoint
CREATE TYPE "public"."subscription_frequency" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'ended');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'approved', 'rejected', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('completed', 'projected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('one_time', 'installment', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "business_merge_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id_1" integer NOT NULL,
	"business_id_2" integer NOT NULL,
	"similarity_score" numeric(3, 2) NOT NULL,
	"suggestion_reason" text,
	"status" "suggestion_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user" boolean
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"primary_category_id" integer,
	"child_category_id" integer,
	"categorization_source" "categorization_source",
	"confidence_score" numeric(3, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_4_digits" varchar(4) NOT NULL,
	"nickname" varchar(100),
	"bank_or_company" varchar(100) NOT NULL,
	"file_format_handler" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"owner" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"parent_id" integer,
	"level" integer NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"date" date NOT NULL,
	"currency" varchar(3) NOT NULL,
	"rate_to_ils" numeric(10, 6) NOT NULL,
	"source" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_batch_id" integer,
	"uploaded_file_id" integer,
	"log_level" "log_level" NOT NULL,
	"message" text NOT NULL,
	"context" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"card_id" integer NOT NULL,
	"detected_amount" numeric(12, 2) NOT NULL,
	"frequency" "subscription_frequency" NOT NULL,
	"first_occurrence" date NOT NULL,
	"last_occurrence" date NOT NULL,
	"occurrence_count" integer NOT NULL,
	"detection_reason" text,
	"status" "suggestion_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"card_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"frequency" "subscription_frequency" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "subscription_status" NOT NULL,
	"created_from_suggestion" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"transaction_hash" varchar(64) NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"business_id" integer NOT NULL,
	"card_id" integer NOT NULL,
	"deal_date" date NOT NULL,
	"bank_charge_date" date,
	"original_amount" numeric(12, 2) NOT NULL,
	"original_currency" varchar(3) NOT NULL,
	"exchange_rate_used" numeric(10, 6),
	"charged_amount_ils" numeric(12, 2) NOT NULL,
	"payment_type" "payment_type" NOT NULL,
	"installment_group_id" uuid,
	"installment_index" integer,
	"installment_total" integer,
	"installment_amount" numeric(12, 2),
	"subscription_id" integer,
	"status" "transaction_status" NOT NULL,
	"projected_charge_date" date,
	"actual_charge_date" date,
	"is_refund" boolean DEFAULT false NOT NULL,
	"parent_transaction_id" integer,
	"source_file" varchar(255) NOT NULL,
	"upload_batch_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE TABLE "upload_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"total_transactions" integer,
	"new_transactions" integer,
	"updated_transactions" integer,
	"status" "upload_status" NOT NULL,
	"error_message" text,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_batch_id" integer NOT NULL,
	"card_id" integer,
	"filename" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer NOT NULL,
	"status" "upload_status" NOT NULL,
	"transactions_found" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "business_merge_suggestions" ADD CONSTRAINT "business_merge_suggestions_business_id_1_businesses_id_fk" FOREIGN KEY ("business_id_1") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_merge_suggestions" ADD CONSTRAINT "business_merge_suggestions_business_id_2_businesses_id_fk" FOREIGN KEY ("business_id_2") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_child_category_id_categories_id_fk" FOREIGN KEY ("child_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_logs" ADD CONSTRAINT "processing_logs_upload_batch_id_upload_batches_id_fk" FOREIGN KEY ("upload_batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_logs" ADD CONSTRAINT "processing_logs_uploaded_file_id_uploaded_files_id_fk" FOREIGN KEY ("uploaded_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_suggestions" ADD CONSTRAINT "subscription_suggestions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_transaction_id_transactions_id_fk" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_upload_batch_id_upload_batches_id_fk" FOREIGN KEY ("upload_batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_upload_batch_id_upload_batches_id_fk" FOREIGN KEY ("upload_batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;