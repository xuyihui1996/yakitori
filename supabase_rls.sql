-- ================================================
-- Supabase RLS (Row Level Security) 策略设置
-- 在创建表之后执行此脚本
-- ================================================

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_items ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Allow all operations" ON users;
DROP POLICY IF EXISTS "Allow all operations" ON groups;
DROP POLICY IF EXISTS "Allow all operations" ON group_menu_items;
DROP POLICY IF EXISTS "Allow all operations" ON rounds;
DROP POLICY IF EXISTS "Allow all operations" ON round_items;

-- 允许所有操作（开发环境使用，生产环境需要更严格的控制）
CREATE POLICY "Allow all operations" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON group_menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON rounds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON round_items FOR ALL USING (true) WITH CHECK (true);

-- 显示成功消息
SELECT '✅ RLS 策略设置成功！' as message;

