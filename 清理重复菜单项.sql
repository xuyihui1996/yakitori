-- ================================================
-- 清理重复的菜单项（同名不同价）
-- 保留最早的记录，删除后续的重复项
-- ================================================

-- 查看重复的菜单项
SELECT 
  group_id,
  name_display,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at) as item_ids,
  array_agg(price ORDER BY created_at) as prices,
  array_agg(created_at ORDER BY created_at) as created_dates
FROM group_menu_items
WHERE status = 'active'
GROUP BY group_id, name_display
HAVING COUNT(*) > 1
ORDER BY group_id, name_display;

-- 删除重复项（保留最早的，删除其他的）
-- 注意：执行前请先备份数据！
WITH ranked_items AS (
  SELECT 
    id,
    group_id,
    name_display,
    price,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY group_id, name_display 
      ORDER BY created_at ASC
    ) as rn
  FROM group_menu_items
  WHERE status = 'active'
)
DELETE FROM group_menu_items
WHERE id IN (
  SELECT id FROM ranked_items WHERE rn > 1
);

-- 验证清理结果（应该返回空结果）
SELECT 
  group_id,
  name_display,
  COUNT(*) as count
FROM group_menu_items
WHERE status = 'active'
GROUP BY group_id, name_display
HAVING COUNT(*) > 1;

