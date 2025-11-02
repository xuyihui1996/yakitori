-- 结账确认流程数据库迁移脚本
-- 为groups表添加结账确认相关字段

-- 添加checkout_confirming字段（布尔值，表示是否在结账确认流程中）
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS checkout_confirming BOOLEAN DEFAULT false;

-- 添加member_confirmations字段（JSONB对象，存储每个成员的确认状态）
-- 格式：{"userId1": true, "userId2": false}
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS member_confirmations JSONB DEFAULT '{}'::jsonb;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_groups_checkout_confirming 
ON groups(checkout_confirming) 
WHERE checkout_confirming = true;

-- 更新现有数据，确保字段有默认值
UPDATE groups 
SET 
  checkout_confirming = COALESCE(checkout_confirming, false),
  member_confirmations = COALESCE(member_confirmations, '{}'::jsonb)
WHERE checkout_confirming IS NULL OR member_confirmations IS NULL;

-- 添加注释说明字段用途
COMMENT ON COLUMN groups.checkout_confirming IS '是否在结账确认流程中';
COMMENT ON COLUMN groups.member_confirmations IS '成员确认状态，JSONB格式：{"userId": true/false}';

