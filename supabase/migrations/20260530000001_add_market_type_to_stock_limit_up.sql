-- 给stock_limit_up表添加market_type列，用于存储市场类型（SH/SZ）
ALTER TABLE stock_limit_up ADD COLUMN IF NOT EXISTS market_type VARCHAR(16) DEFAULT '';