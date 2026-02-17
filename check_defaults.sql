-- Check column defaults for critical tables to ensure compatibility with old code
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name IN ('rounds', 'round_items', 'groups')
  AND column_name IN ('review_status', 'served', 'table_no', 'checkout_confirming')
ORDER BY table_name, column_name;
