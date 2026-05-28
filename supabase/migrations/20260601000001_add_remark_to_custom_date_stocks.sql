-- 给 custom_date_stocks 表加备注字段
ALTER TABLE custom_date_stocks ADD COLUMN IF NOT EXISTS remark TEXT NOT NULL DEFAULT '';