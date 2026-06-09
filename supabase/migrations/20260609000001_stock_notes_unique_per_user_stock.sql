-- 将 stock_notes 的唯一约束从 (username, stock_code, stock_date) 改为 (username, stock_code)
-- 即每个用户每只股票只有一条备注，不区分日期和板块

-- 1. 删除旧的唯一索引
DROP INDEX IF EXISTS stock_notes_unique_idx;

-- 2. 合并同一用户同一股票的不同日期备注内容
-- 将旧备注合并到 id 最大的那条记录中（以换行分隔，标注原日期），然后删除旧记录
UPDATE stock_notes target
SET content = sub.merged_content
FROM (
  SELECT
    MAX(a.id) AS keep_id,
    string_agg(
      CASE WHEN b.content IS NOT NULL AND b.content != '' THEN
        CASE WHEN a.stock_date IS NOT NULL THEN a.stock_date || ': ' || a.content ELSE a.content END
      ELSE a.content END,
      E'\n'
      ORDER BY a.id
    ) AS merged_content
  FROM stock_notes a
  JOIN stock_notes b ON a.username = b.username AND a.stock_code = b.stock_code
  GROUP BY a.username, a.stock_code
  HAVING COUNT(*) > 1
) sub
WHERE target.id = sub.keep_id;

-- 3. 删除重复记录（保留 id 最大的那条）
DELETE FROM stock_notes a USING stock_notes b
WHERE a.username = b.username
  AND a.stock_code = b.stock_code
  AND a.id < b.id;

-- 4. 删除 stock_date 列
ALTER TABLE stock_notes DROP COLUMN IF EXISTS stock_date;

-- 5. 创建新的唯一索引
CREATE UNIQUE INDEX stock_notes_unique_idx ON stock_notes USING btree (username, stock_code);