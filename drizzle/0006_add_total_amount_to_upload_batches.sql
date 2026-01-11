-- Add total_amount_ils column to upload_batches table
-- This tracks the sum of transaction amounts from the actual uploaded files only
-- Excludes backfilled past installments and projected future installments

ALTER TABLE upload_batches
ADD COLUMN total_amount_ils DECIMAL(12, 2);
