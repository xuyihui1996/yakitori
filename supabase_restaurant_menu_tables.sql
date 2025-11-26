-- ================================================
-- 店铺历史菜单相关表创建脚本
-- 请在 Supabase SQL Editor 中执行
-- ================================================

-- 1. 店铺菜单表（restaurant_menus）
CREATE TABLE IF NOT EXISTS restaurant_menus (
  id TEXT PRIMARY KEY,
  created_from_group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 店铺菜单项表（restaurant_menu_items）
CREATE TABLE IF NOT EXISTS restaurant_menu_items (
  id TEXT PRIMARY KEY,
  restaurant_menu_id TEXT NOT NULL REFERENCES restaurant_menus(id) ON DELETE CASCADE,
  name_display TEXT NOT NULL,
  price NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 用户与店铺菜单关联表（user_restaurant_menu_links）
CREATE TABLE IF NOT EXISTS user_restaurant_menu_links (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_menu_id TEXT NOT NULL REFERENCES restaurant_menus(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, restaurant_menu_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_restaurant_menus_group ON restaurant_menus(created_from_group_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_menu ON restaurant_menu_items(restaurant_menu_id);
CREATE INDEX IF NOT EXISTS idx_user_restaurant_menu_links_user ON user_restaurant_menu_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_restaurant_menu_links_menu ON user_restaurant_menu_links(restaurant_menu_id);
CREATE INDEX IF NOT EXISTS idx_user_restaurant_menu_links_last_used ON user_restaurant_menu_links(user_id, last_used_at);

-- 启用 Row Level Security (RLS)
ALTER TABLE restaurant_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restaurant_menu_links ENABLE ROW LEVEL SECURITY;

-- 设置 RLS 策略（允许所有人读写，生产环境需要更严格的控制）
CREATE POLICY "Allow all operations on restaurant_menus" 
  ON restaurant_menus FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on restaurant_menu_items" 
  ON restaurant_menu_items FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on user_restaurant_menu_links" 
  ON user_restaurant_menu_links FOR ALL 
  USING (true) WITH CHECK (true);

-- 显示成功消息
SELECT '✅ 店铺历史菜单表创建成功！' as message;



