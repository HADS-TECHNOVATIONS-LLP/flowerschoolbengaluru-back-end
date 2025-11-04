-- Migration: add discount columns to products table
-- Run this against your development/production DB (psql or preferred migration tool)

ALTER TABLE bouquetbar.products
  ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

-- Backfill existing rows (ensure price and original_price exist before running)
UPDATE bouquetbar.products
SET discount_percentage = COALESCE(discount_percentage, 0),
    discount_amount = COALESCE(discount_amount, 0)
WHERE discount_percentage IS NULL OR discount_amount IS NULL;
