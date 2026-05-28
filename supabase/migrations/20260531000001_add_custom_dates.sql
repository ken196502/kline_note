-- 自定义日期表
CREATE TABLE IF NOT EXISTS custom_dates (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  custom_block_id INTEGER NOT NULL REFERENCES custom_blocks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同一用户同一板块同一日期不能重复
CREATE UNIQUE INDEX custom_dates_unique_idx ON custom_dates USING btree (username, custom_block_id, date);
-- 按用户+板块查询索引
CREATE INDEX custom_dates_block_idx ON custom_dates USING btree (custom_block_id);
-- 按用户查询索引
CREATE INDEX custom_dates_username_idx ON custom_dates USING btree (username);

-- 自定义日期内的股票表（支持排序）
CREATE TABLE IF NOT EXISTS custom_date_stocks (
  id SERIAL PRIMARY KEY,
  custom_date_id INTEGER NOT NULL REFERENCES custom_dates(id) ON DELETE CASCADE,
  stock_code VARCHAR(32) NOT NULL,
  stock_name VARCHAR(128) NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同一日期内不能重复添加同一股票
CREATE UNIQUE INDEX custom_date_stocks_unique_idx ON custom_date_stocks USING btree (custom_date_id, stock_code);
-- 按自定义日期查询索引
CREATE INDEX custom_date_stocks_date_idx ON custom_date_stocks USING btree (custom_date_id);
-- 排序索引
CREATE INDEX custom_date_stocks_sort_idx ON custom_date_stocks USING btree (custom_date_id, sort_order);