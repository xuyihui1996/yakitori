-- 轮次并发保护迁移脚本
-- 目标：确保每个 group 同一时间最多只有一个 “open 的正常轮次”（排除 _Extra）

-- 注意：如果你历史数据里已经出现了多个 open 轮次，需要先手动处理为只保留一个 open（其余改为 closed）
-- 示例检查：
--   select group_id, array_agg(id) as open_round_ids
--   from rounds
--   where status = 'open' and id not like '%_Extra'
--   group by group_id
--   having count(*) > 1;

-- 互斥约束（部分唯一索引）：同一 group 只能有一个 open 的正常轮次
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rounds_one_open_per_group
ON rounds (group_id)
WHERE status = 'open' AND id NOT LIKE '%_Extra';

