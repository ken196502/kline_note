-- 1. 创建自定义板块关联的板块表
CREATE TABLE IF NOT EXISTS custom_block_links (
  id SERIAL PRIMARY KEY,
  custom_block_id INTEGER NOT NULL REFERENCES custom_blocks(id) ON DELETE CASCADE,
  block_code VARCHAR(32) NOT NULL,
  block_name VARCHAR(128) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 创建自定义板块手动添加的股票表
CREATE TABLE IF NOT EXISTS custom_block_stocks (
  id SERIAL PRIMARY KEY,
  custom_block_id INTEGER NOT NULL REFERENCES custom_blocks(id) ON DELETE CASCADE,
  stock_code VARCHAR(32) NOT NULL,
  stock_name VARCHAR(128) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 创建唯一索引（同一板块下不能重复关联/添加）
CREATE UNIQUE INDEX custom_block_links_unique_idx ON custom_block_links USING btree (custom_block_id, block_code);
CREATE UNIQUE INDEX custom_block_stocks_unique_idx ON custom_block_stocks USING btree (custom_block_id, stock_code);

-- 4. 创建查询索引
CREATE INDEX custom_block_links_block_idx ON custom_block_links USING btree (custom_block_id);
CREATE INDEX custom_block_stocks_block_idx ON custom_block_stocks USING btree (custom_block_id);

-- 5. 迁移旧数据：将 JSON 数组拆入关联表
-- 迁移 block_codes
INSERT INTO custom_block_links (custom_block_id, block_code)
SELECT
  cb.id,
  elem::text AS block_code
FROM custom_blocks cb,
     json_array_elements_text(cb.block_codes::json) AS elem
ON CONFLICT DO NOTHING;

-- 迁移 stock_codes
INSERT INTO custom_block_stocks (custom_block_id, stock_code)
SELECT
  cb.id,
  elem::text AS stock_code
FROM custom_blocks cb,
     json_array_elements_text(cb.stock_codes::json) AS elem
ON CONFLICT DO NOTHING;

-- 6. 删除旧字段（可选：先保留一段时间再删，这里直接删）
ALTER TABLE custom_blocks DROP COLUMN IF EXISTS block_codes;
ALTER TABLE custom_blocks DROP COLUMN IF EXISTS stock_codes;