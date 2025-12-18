-- 共享条目（混合式共享）相关字段
-- 在 Supabase SQL Editor 执行（对已有表增量升级）

ALTER TABLE public.round_items
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS share_mode TEXT,
  ADD COLUMN IF NOT EXISTS share_status TEXT,
  ADD COLUMN IF NOT EXISTS shares JSONB,
  ADD COLUMN IF NOT EXISTS allow_self_join BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_claim_units BOOLEAN DEFAULT TRUE;

