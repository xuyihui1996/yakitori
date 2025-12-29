-- 为 rounds 表增加成员确认列，用于“本轮确认/自动关轮”
ALTER TABLE rounds
ADD COLUMN IF NOT EXISTS member_confirmations JSONB DEFAULT '{}'::jsonb;

-- 互斥索引确保同一 group 只有 1 个 open 正常轮次（已有则保留）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rounds_one_open_per_group
ON rounds (group_id)
WHERE status = 'open' AND id NOT LIKE '%_Extra';
