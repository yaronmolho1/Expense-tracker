ALTER TABLE "cards" ALTER COLUMN "bank_or_company" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_suggestions" ADD COLUMN "rejected_until" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "name" text;