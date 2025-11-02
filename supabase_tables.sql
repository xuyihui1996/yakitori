-- ================================================
-- Supabase 数据表创建脚本
-- 请在 Supabase SQL Editor 中执行
-- ================================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 组表
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  settled BOOLEAN DEFAULT FALSE,
  members TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- 3. 菜单项表
CREATE TABLE IF NOT EXISTS group_menu_items (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name_display TEXT NOT NULL,
  price NUMERIC NOT NULL,
  note TEXT,
  status TEXT DEFAULT 'active',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  updated_by TEXT
);

-- 4. 轮次表
CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'open',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- 5. 订单项表
CREATE TABLE IF NOT EXISTS round_items (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  name_display TEXT NOT NULL,
  price NUMERIC NOT NULL,
  qty INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_by TEXT
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_group ON group_menu_items(group_id);
CREATE INDEX IF NOT EXISTS idx_rounds_group ON rounds(group_id);
CREATE INDEX IF NOT EXISTS idx_round_items_group ON round_items(group_id);
CREATE INDEX IF NOT EXISTS idx_round_items_round ON round_items(round_id);
CREATE INDEX IF NOT EXISTS idx_round_items_user ON round_items(user_id);

-- 显示成功消息
SELECT '✅ 所有表创建成功！' as message;

