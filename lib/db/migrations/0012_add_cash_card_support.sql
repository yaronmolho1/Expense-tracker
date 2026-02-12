-- Migration: Add cash card support
-- Adds card_type enum, isSystem flag, and inserts the system Cash card

CREATE TYPE "card_type" AS ENUM('credit', 'debit', 'cash');--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "type" "card_type" NOT NULL DEFAULT 'credit';--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "is_system" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "last_4_digits" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "file_format_handler" DROP NOT NULL;--> statement-breakpoint

-- Insert the system Cash card (idempotent)
INSERT INTO "cards" ("last_4_digits", "nickname", "bank_or_company", "file_format_handler", "is_active", "owner", "type", "is_system")
VALUES (NULL, 'Cash', 'Cash', NULL, true, 'system', 'cash', true)
ON CONFLICT DO NOTHING;
