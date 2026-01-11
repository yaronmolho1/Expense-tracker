-- Migration: Add critical performance indexes to transactions table
-- Date: 2026-01-10
-- Purpose: Optimize query performance for transaction filtering, sorting, and joins

-- Composite index for duplicate detection queries (most critical)
-- Used in: process-batch-job.ts duplicate detection logic
CREATE INDEX IF NOT EXISTS "idx_transactions_business_date" ON "transactions" ("business_id", "deal_date");

-- Composite index for card filtering with date ranges
-- Used in: /api/transactions GET endpoint with card_ids + date filters
CREATE INDEX IF NOT EXISTS "idx_transactions_card_date" ON "transactions" ("card_id", "deal_date");

-- Index on status for filtering (completed, projected, cancelled)
-- Used in: All transaction queries with status filters
CREATE INDEX IF NOT EXISTS "idx_transactions_status" ON "transactions" ("status");

-- Index on bank_charge_date for sorting (default sort field in UI)
-- Used in: /api/transactions GET endpoint ORDER BY bank_charge_date DESC
CREATE INDEX IF NOT EXISTS "idx_transactions_bank_charge_date" ON "transactions" ("bank_charge_date");

-- Index on installment_group_id for installment queries
-- Used in: /api/transactions/[id]/installments endpoint (fetch all payments in group)
CREATE INDEX IF NOT EXISTS "idx_transactions_installment_group" ON "transactions" ("installment_group_id") WHERE "installment_group_id" IS NOT NULL;

-- Index on subscription_id for subscription transaction lookups
-- Used in: /api/subscriptions/[id]/transactions endpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_subscription" ON "transactions" ("subscription_id") WHERE "subscription_id" IS NOT NULL;

-- Index on upload_batch_id for batch status queries
-- Used in: /api/upload/[batchId] GET endpoint (count transactions in batch)
CREATE INDEX IF NOT EXISTS "idx_transactions_upload_batch" ON "transactions" ("upload_batch_id");

-- Index on transaction_hash already exists via UNIQUE constraint (no action needed)
-- Index on business_id already exists via foreign key (PostgreSQL auto-creates)
-- Index on card_id already exists via foreign key (PostgreSQL auto-creates)
