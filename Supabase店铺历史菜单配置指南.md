# Supabase 店铺历史菜单功能配置指南

## 📋 概述

本指南将帮助你在 Supabase 中配置店铺历史菜单功能所需的数据库表和相关设置。

## 🎯 需要添加的表

1. **restaurant_menus** - 店铺菜单模板表
2. **restaurant_menu_items** - 店铺菜单项表
3. **user_restaurant_menu_links** - 用户与店铺菜单关联表

## 📝 操作步骤

### 第一步：打开 Supabase SQL Editor

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**（🗄️ 图标）
4. 点击 **"+ New query"** 创建新查询

### 第二步：执行建表 SQL

1. 复制以下 SQL 代码（或直接使用项目中的 `supabase_restaurant_menu_tables.sql` 文件）：

```sql
-- ================================================
-- 店铺历史菜单相关表创建脚本
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
```

2. 将 SQL 代码粘贴到 SQL Editor 中
3. 点击右上角的 **"Run"** 按钮（或按 `Ctrl+Enter` / `Cmd+Enter`）
4. 等待执行完成，应该看到成功消息：`✅ 店铺历史菜单表创建成功！`

### 第三步：验证表创建成功

执行以下 SQL 查询来验证表是否创建成功：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('restaurant_menus', 'restaurant_menu_items', 'user_restaurant_menu_links')
ORDER BY table_name;

-- 检查表结构
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('restaurant_menus', 'restaurant_menu_items', 'user_restaurant_menu_links')
ORDER BY table_name, ordinal_position;
```

### 第四步：验证 RLS 策略

执行以下 SQL 查询来验证 RLS 策略：

```sql
-- 检查 RLS 是否启用
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('restaurant_menus', 'restaurant_menu_items', 'user_restaurant_menu_links');

-- 检查策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('restaurant_menus', 'restaurant_menu_items', 'user_restaurant_menu_links');
```

## 📊 表结构说明

### 1. restaurant_menus（店铺菜单表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT | 主键，菜单ID（如 "rm_xxx"） |
| created_from_group_id | TEXT | 来源组ID，外键关联 groups 表 |
| created_at | TIMESTAMPTZ | 创建时间 |

### 2. restaurant_menu_items（店铺菜单项表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT | 主键，菜单项ID |
| restaurant_menu_id | TEXT | 外键，关联 restaurant_menus 表 |
| name_display | TEXT | 菜名（日文） |
| price | NUMERIC | 单价（整数，单位日元） |
| note | TEXT | 备注（中文/说明），可选 |
| created_at | TIMESTAMPTZ | 创建时间 |

### 3. user_restaurant_menu_links（用户与店铺菜单关联表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| user_id | TEXT | 用户ID，外键关联 users 表 |
| restaurant_menu_id | TEXT | 店铺菜单ID，外键关联 restaurant_menus 表 |
| display_name | TEXT | 用户起的"店名" |
| created_at | TIMESTAMPTZ | 创建时间 |
| last_used_at | TIMESTAMPTZ | 最近一次导入时间（用于 LRU 策略） |
| PRIMARY KEY | (user_id, restaurant_menu_id) | 复合主键 |

## 🔍 索引说明

为了提高查询性能，创建了以下索引：

1. **idx_restaurant_menus_group** - 按来源组ID查询
2. **idx_restaurant_menu_items_menu** - 按菜单ID查询菜单项
3. **idx_user_restaurant_menu_links_user** - 按用户ID查询关联
4. **idx_user_restaurant_menu_links_menu** - 按菜单ID查询关联
5. **idx_user_restaurant_menu_links_last_used** - 按用户和最后使用时间排序（LRU 用）

## 🔒 安全说明

当前配置使用了宽松的 RLS 策略（允许所有人读写），适合开发和测试环境。

**生产环境建议：**
- 只允许组成员访问相关的 restaurant_menu
- 只允许用户访问自己的 user_restaurant_menu_links
- 根据实际需求调整策略

## ✅ 完成后的验证

配置完成后，重新运行应用，尝试：
1. 结账后保存店铺菜单
2. 创建新组时导入历史菜单

如果不再出现 "店铺历史菜单功能暂未在 Supabase 中实现" 的错误，说明配置成功！

## 🐛 常见问题

### Q: 执行 SQL 时提示表已存在
A: 使用 `CREATE TABLE IF NOT EXISTS` 可以避免此错误，或者先删除旧表：
```sql
DROP TABLE IF EXISTS user_restaurant_menu_links;
DROP TABLE IF EXISTS restaurant_menu_items;
DROP TABLE IF EXISTS restaurant_menus;
```

### Q: 外键约束错误
A: 确保 `groups` 和 `users` 表已经存在，并且有对应的数据。

### Q: RLS 策略冲突
A: 如果策略已存在，先删除旧策略：
```sql
DROP POLICY IF EXISTS "Allow all operations on restaurant_menus" ON restaurant_menus;
DROP POLICY IF EXISTS "Allow all operations on restaurant_menu_items" ON restaurant_menu_items;
DROP POLICY IF EXISTS "Allow all operations on user_restaurant_menu_links" ON user_restaurant_menu_links;
```

## 📚 相关文件

- `supabase_restaurant_menu_tables.sql` - 完整的 SQL 脚本
- `src/api/supabaseService.ts` - 需要实现相关 API 函数
- `src/types/index.ts` - TypeScript 类型定义



