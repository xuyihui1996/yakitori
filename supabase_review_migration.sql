-- Add review status columns to rounds table
-- Run this in Supabase SQL Editor

ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS merchant_confirmed_at TIMESTAMPTZ;

-- Optional: Create index for review_status if needed for filtering
CREATE INDEX IF NOT EXISTS idx_rounds_review_status ON rounds(review_status);
