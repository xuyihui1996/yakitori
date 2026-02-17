-- Add served column to round_items
ALTER TABLE round_items 
ADD COLUMN IF NOT EXISTS served BOOLEAN DEFAULT FALSE;

-- Notify user to run this
SELECT '✅ Migration successful: Added served column to round_items' as message;
