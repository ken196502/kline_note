-- 给 custom_date_stocks 表加股票名称颜色字段
ALTER TABLE custom_date_stocks ADD COLUMN IF NOT EXISTS stock_name_color VARCHAR(32) NOT NULL DEFAULT '';