-- Migration: Add secondary indexes for other tables
-- Date: 2026-01-10
-- Purpose: Improve performance for dashboard, suggestions, and upload tracking

-- ============================================
-- UPLOADED_FILES TABLE INDEXES
-- ============================================

-- Index on status for filtering pending/processing/completed files
-- Used in: /api/upload/[batchId] GET endpoint (check file processing status)
CREATE INDEX IF NOT EXISTS "idx_uploaded_files_status" ON "uploaded_files" ("status");

-- Index on upload_batch_id already exists via foreign key (no action needed)

-- ============================================
-- UPLOAD_BATCHES TABLE INDEXES
-- ============================================

-- Index on status for dashboard queries (show recent uploads, failed batches)
-- Used in: Dashboard homepage, upload history page
CREATE INDEX IF NOT EXISTS "idx_upload_batches_status" ON "upload_batches" ("status");

-- Index on uploaded_at for sorting recent uploads
-- Used in: Dashboard homepage (ORDER BY uploaded_at DESC)
CREATE INDEX IF NOT EXISTS "idx_upload_batches_uploaded_at" ON "upload_batches" ("uploaded_at" DESC);

-- ============================================
-- BUSINESSES TABLE INDEXES
-- ============================================

-- Index on normalized_name already exists via UNIQUE constraint (no action needed)

-- Index on approved for filtering unapproved businesses
-- Used in: /manage/businesses page (filter by approved status)
CREATE INDEX IF NOT EXISTS "idx_businesses_approved" ON "businesses" ("approved");

-- Index on merged_to_id for finding merged businesses
-- Used in: /manage/businesses/merged page
CREATE INDEX IF NOT EXISTS "idx_businesses_merged_to" ON "businesses" ("merged_to_id") WHERE "merged_to_id" IS NOT NULL;

-- Composite index for category lookups (frequent joins in reports)
-- Used in: Dashboard, time-flow, category analysis
CREATE INDEX IF NOT EXISTS "idx_businesses_categories" ON "businesses" ("primary_category_id", "child_category_id");

-- ============================================
-- SUBSCRIPTIONS TABLE INDEXES
-- ============================================

-- Composite index for duplicate subscription detection
-- Used in: Subscription creation (check if subscription already exists for business+card)
CREATE INDEX IF NOT EXISTS "idx_subscriptions_business_card" ON "subscriptions" ("business_id", "card_id");

-- Index on status for filtering active/cancelled subscriptions
-- Used in: /manage/subscriptions page, /api/subscriptions GET endpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "subscriptions" ("status");

-- Index on card_id already exists via foreign key (no action needed)

-- ============================================
-- CATEGORIES TABLE INDEXES
-- ============================================

-- Index on parent_id for tree queries (fetch children of parent category)
-- Used in: Category tree display, category hierarchy lookups
CREATE INDEX IF NOT EXISTS "idx_categories_parent" ON "categories" ("parent_id");

-- Index on level for filtering parent/child categories
-- Used in: Category selector dropdowns (fetch only level=0 parents)
CREATE INDEX IF NOT EXISTS "idx_categories_level" ON "categories" ("level");

-- ============================================
-- BUSINESS_MERGE_SUGGESTIONS TABLE INDEXES
-- ============================================

-- Index on status for pending suggestion queries
-- Used in: /manage/businesses/suggestions page
CREATE INDEX IF NOT EXISTS "idx_merge_suggestions_status" ON "business_merge_suggestions" ("status");

-- Composite unique index to prevent duplicate suggestion pairs
-- Ensures business_id_1 < business_id_2 constraint at database level
CREATE UNIQUE INDEX IF NOT EXISTS "idx_merge_suggestions_pair" ON "business_merge_suggestions" ("business_id_1", "business_id_2");

-- ============================================
-- SUBSCRIPTION_SUGGESTIONS TABLE INDEXES
-- ============================================

-- Index on status for pending subscription suggestion queries
-- Used in: /manage/subscriptions/suggestions page
CREATE INDEX IF NOT EXISTS "idx_subscription_suggestions_status" ON "subscription_suggestions" ("status");

-- Composite index for duplicate detection (business + card combination)
CREATE INDEX IF NOT EXISTS "idx_subscription_suggestions_business_card" ON "subscription_suggestions" ("business_name", "card_id");

-- ============================================
-- CATEGORY_BUDGET_HISTORY TABLE INDEXES
-- ============================================

-- Index on category_id for budget history lookups
-- Used in: Time-flow table (fetch budget for each category/month)
CREATE INDEX IF NOT EXISTS "idx_budget_history_category" ON "category_budget_history" ("category_id");

-- Composite index for time-based budget lookups
-- Used in: Finding active budget for specific month
CREATE INDEX IF NOT EXISTS "idx_budget_history_dates" ON "category_budget_history" ("category_id", "effective_from", "effective_to");
