-- 自定义板块表加排序字段
ALTER TABLE custom_blocks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- 创建排序索引
CREATE INDEX IF NOT EXISTS custom_blocks_sort_idx ON custom_blocks (username, sort_order);