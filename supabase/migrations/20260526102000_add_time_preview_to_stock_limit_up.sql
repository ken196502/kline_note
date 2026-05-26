-- 给stock_limit_up表添加time_preview列，用于存储分时缩略图数据
ALTER TABLE stock_limit_up ADD COLUMN IF NOT EXISTS time_preview TEXT;