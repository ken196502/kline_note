-- 股票笔记表
CREATE TABLE IF NOT EXISTS stock_notes (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  stock_code VARCHAR(32) NOT NULL,
  stock_date VARCHAR(16) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX stock_notes_stock_code_idx ON stock_notes USING btree (stock_code);
CREATE UNIQUE INDEX stock_notes_unique_idx ON stock_notes USING btree (username, stock_code, stock_date);
CREATE INDEX stock_notes_username_idx ON stock_notes USING btree (username);

-- 板块涨停汇总数据表
CREATE TABLE IF NOT EXISTS block_limit_up (
  id SERIAL PRIMARY KEY,
  date VARCHAR(16) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  change REAL NOT NULL DEFAULT 0,
  limit_up_num INTEGER NOT NULL DEFAULT 0,
  continuous_plate_num INTEGER NOT NULL DEFAULT 0,
  high VARCHAR(64) DEFAULT '',
  high_num INTEGER NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE UNIQUE INDEX block_limit_up_unique_idx ON block_limit_up USING btree (date, code);
CREATE INDEX block_limit_up_date_idx ON block_limit_up USING btree (date);

-- 个股涨停数据表
CREATE TABLE IF NOT EXISTS stock_limit_up (
  id SERIAL PRIMARY KEY,
  date VARCHAR(16) NOT NULL,
  block_code VARCHAR(32) NOT NULL,
  block_name VARCHAR(128) NOT NULL,
  stock_code VARCHAR(32) NOT NULL,
  stock_name VARCHAR(128) NOT NULL,
  latest REAL NOT NULL DEFAULT 0,
  change_rate REAL NOT NULL DEFAULT 0,
  continue_num INTEGER NOT NULL DEFAULT 0,
  high VARCHAR(64) DEFAULT '',
  high_days INTEGER NOT NULL DEFAULT 0,
  first_limit_up_time VARCHAR(16) DEFAULT '',
  last_limit_up_time VARCHAR(16) DEFAULT '',
  reason_type VARCHAR(256) DEFAULT '',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE UNIQUE INDEX stock_limit_up_unique_idx ON stock_limit_up USING btree (date, block_code, stock_code);
CREATE INDEX stock_limit_up_block_date_idx ON stock_limit_up USING btree (block_code, date);
CREATE INDEX stock_limit_up_date_idx ON stock_limit_up USING btree (date);

-- 股票分时预览数据表
CREATE TABLE IF NOT EXISTS stock_time_preview (
  id SERIAL PRIMARY KEY,
  date VARCHAR(16) NOT NULL,
  stock_code VARCHAR(32) NOT NULL,
  time_preview TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE UNIQUE INDEX stock_time_preview_unique_idx ON stock_time_preview USING btree (date, stock_code);
CREATE INDEX stock_time_preview_date_idx ON stock_time_preview USING btree (date);

-- 健康检查表
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);