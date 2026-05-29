-- 在 stock_limit_up 表中按代码或名称模糊搜索，返回去重后的股票列表
CREATE OR REPLACE FUNCTION search_stocks(search_query TEXT)
RETURNS TABLE(stock_code VARCHAR, stock_name VARCHAR)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (slu.stock_code) slu.stock_code, slu.stock_name
  FROM stock_limit_up slu
  WHERE slu.stock_code ILIKE search_query || '%'
     OR slu.stock_name ILIKE '%' || search_query || '%'
  ORDER BY slu.stock_code, slu.stock_name
  LIMIT 50;
$$;