-- 自定义板块表
CREATE TABLE IF NOT EXISTS custom_blocks (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  block_codes TEXT NOT NULL DEFAULT '[]',
  stock_codes TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE UNIQUE INDEX custom_blocks_unique_idx ON custom_blocks USING btree (username, name);
CREATE INDEX custom_blocks_username_idx ON custom_blocks USING btree (username);