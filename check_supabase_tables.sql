-- Comprehensive Supabase Schema Check
-- Run this in the Supabase SQL Editor

-- 1. Table Existence Check
SELECT 'Tables' as check_type, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'users', 'groups', 'group_menu_items', 'rounds', 'round_items',
    'restaurant_menus', 'restaurant_menu_items', 'user_restaurant_menu_links'
)
ORDER BY table_name;

-- 2. Column Definition Check (Type & Nullability)
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
    'users', 'groups', 'group_menu_items', 'rounds', 'round_items',
    'restaurant_menus', 'restaurant_menu_items', 'user_restaurant_menu_links'
)
ORDER BY table_name, ordinal_position;

-- 3. Foreign Key Constraints Check
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
ORDER BY tc.table_name;

-- 4. RLS Policy Check (Should be true for all)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'groups', 'group_menu_items', 'rounds', 'round_items',
    'restaurant_menus', 'restaurant_menu_items', 'user_restaurant_menu_links'
);
