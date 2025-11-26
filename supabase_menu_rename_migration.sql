-- ================================================
-- 菜品改名功能数据库迁移脚本
-- 请在 Supabase SQL Editor 中执行
-- ================================================

-- 1) round_items：添加 menu_item_id、user_name_snapshot、审计字段
ALTER TABLE public.round_items
  ADD COLUMN IF NOT EXISTS menu_item_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS user_name_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;

-- 添加外键约束（如果 group_menu_items 表存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_menu_items') THEN
    -- 删除旧约束（如果存在）
    ALTER TABLE public.round_items DROP CONSTRAINT IF EXISTS fk_round_items_menu_item;
    
    -- 添加新约束
    ALTER TABLE public.round_items
      ADD CONSTRAINT fk_round_items_menu_item
      FOREIGN KEY (menu_item_id) REFERENCES public.group_menu_items(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2) group_menu_items：确保有审计字段
ALTER TABLE public.group_menu_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;

-- 3) 清理重复数据：同组内active状态下的重复菜名
-- 策略：保留最早创建的，将其他重复项标记为disabled
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  -- 找出所有重复的菜名（同组内、active状态、相同名称）
  FOR dup_record IN
    SELECT 
      group_id,
      lower(name_display) as normalized_name,
      array_agg(id ORDER BY created_at) as item_ids,
      array_agg(created_at ORDER BY created_at) as created_ats
    FROM public.group_menu_items
    WHERE status = 'active'
    GROUP BY group_id, lower(name_display)
    HAVING count(*) > 1
  LOOP
    -- 保留第一个（最早创建的），禁用其他的
    UPDATE public.group_menu_items
    SET 
      status = 'disabled',
      updated_at = now(),
      updated_by = NULL
    WHERE id = ANY(dup_record.item_ids[2:array_length(dup_record.item_ids, 1)])
      AND status = 'active';
    
    RAISE NOTICE '已处理重复菜名: group_id=%, name=%, 保留最早项: %, 禁用其他 % 项', 
      dup_record.group_id, 
      dup_record.normalized_name,
      dup_record.item_ids[1],
      array_length(dup_record.item_ids, 1) - 1;
  END LOOP;
END $$;

-- 3) 创建"菜名唯一"索引（同组内、active状态，大小写不敏感）
DROP INDEX IF EXISTS uniq_menu_name_active;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_menu_name_active
ON public.group_menu_items (group_id, lower(name_display))
WHERE status = 'active';

-- 4) 回填历史：用 (group_id, lower(name_display), price) 近似回填 menu_item_id
UPDATE public.round_items ri
SET menu_item_id = gmi.id
FROM public.group_menu_items gmi
WHERE ri.group_id = gmi.group_id
  AND ri.menu_item_id IS NULL
  AND gmi.status = 'active'
  AND lower(ri.name_display) = lower(gmi.name_display)
  AND ri.price = gmi.price;

-- 5) 创建触发器函数：结账后禁止修改菜单名
CREATE OR REPLACE FUNCTION block_menu_update_if_settled() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.groups g WHERE g.id = NEW.group_id AND g.settled = true) THEN
    RAISE EXCEPTION 'Group is settled - menu name updates are locked';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trg_menu_update_lock ON public.group_menu_items;

-- 创建触发器
CREATE TRIGGER trg_menu_update_lock
BEFORE UPDATE OF name_display ON public.group_menu_items
FOR EACH ROW EXECUTE FUNCTION block_menu_update_if_settled();

-- 6) RLS 策略：允许本组成员更新菜单项
DROP POLICY IF EXISTS members_update_menu ON public.group_menu_items;
CREATE POLICY members_update_menu
ON public.group_menu_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_menu_items.group_id
      AND (g.members::text[] @> ARRAY[current_setting('app.user_id', true)]::text[]
           OR g.owner_id = current_setting('app.user_id', true))
  )
);

-- 7) RLS 策略：允许本组成员更新订单项（用于统一回写名称快照）
DROP POLICY IF EXISTS members_update_round_items ON public.round_items;
CREATE POLICY members_update_round_items
ON public.round_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = round_items.group_id
      AND (g.members::text[] @> ARRAY[current_setting('app.user_id', true)]::text[]
           OR g.owner_id = current_setting('app.user_id', true))
  )
);

-- 显示成功消息
SELECT '✅ 菜品改名功能数据库迁移完成！' as message;

