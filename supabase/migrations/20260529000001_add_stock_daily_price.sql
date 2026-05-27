-- 创建股票每日价格表（用于自定义板块获取当天价格和涨跌幅）
CREATE TABLE IF NOT EXISTS stock_daily_price (
  id SERIAL PRIMARY KEY,
  date VARCHAR(16) NOT NULL,
  stock_code VARCHAR(32) NOT NULL,
  stock_name VARCHAR(128) NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  change_rate REAL NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 唯一索引：同一天同一股票只有一条记录
CREATE UNIQUE INDEX stock_daily_price_unique_idx ON stock_daily_price USING btree (date, stock_code);

-- 日期索引：按日期查询
CREATE INDEX stock_daily_price_date_idx ON stock_daily_price USING btree (date);