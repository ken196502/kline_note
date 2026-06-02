import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// ============ K线数据 API（支持多数据源） ============

interface KLineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  amount: number;
  changeRate?: number;
}

// 东方财富 API
async function fetchFromEastMoney(
  code: string,
  market: "SH" | "SZ",
  limit: number
): Promise<KLineData[]> {
  const secid = market === "SH" ? `1.${code}` : `0.${code}`;
  const url = "https://push2his.eastmoney.com/api/qt/stock/kline/get";

  const params = new URLSearchParams({
    fields1: "f1,f2,f3,f4,f5,f6",
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116",
    ut: "7eea3edcaed734bea9cbfc24409ed989",
    klt: "101",
    fqt: "1",
    secid,
    beg: "19700101",
    end: "20500101",
    lmt: String(limit),
  });

  // 东方财富 fields2 说明:
  // f51=日期, f52=开盘, f53=收盘, f54=最高, f55=最低,
  // f56=成交量, f57=成交额, f58=涨跌幅, f59=涨跌额, f60=换手率

  try {
    const res = await fetch(`${url}?${params}`, {
      headers: {
        Referer: "https://quote.eastmoney.com/",
        "User-Agent": "Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const json = (await res.json()) as { data?: { klines?: string[] } };
    const klines = json.data?.klines;
    if (!klines) return [];

    return klines.map((item) => {
      const arr = item.split(",");
      return {
        date: arr[0]!,
        open: Number(arr[1]),
        close: Number(arr[2]),
        high: Number(arr[3]),
        low: Number(arr[4]),
        amount: Number(arr[5]),
        changeRate: Number(arr[8]) || 0, // f58=涨跌幅百分比
      };
    });
  } catch {
    return [];
  }
}

// 新浪前复权因子
interface SinaQfqFactor {
  d: string; // 日期 YYYY-MM-DD
  f: string; // 前复权因子
}

// 获取新浪前复权因子
async function fetchSinaQfqFactor(
  code: string,
  market: "SH" | "SZ"
): Promise<Map<string, number>> {
  const fullCode = market === "SH" ? `sh${code}` : `sz${code}`;
  const url = `https://finance.sina.com.cn/realstock/company/${fullCode}/qfq.js`;
  const factorMap = new Map<string, number>();

  const res = await fetch(url, {
    headers: {
      Referer: "https://finance.sina.com.cn/",
      "User-Agent": "Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return factorMap;

  const text = await res.text();
  // 格式: var sh600519qfq={"total":32,"data":[{"d":"2025-12-19","f":"1.0000000000000000"},...]}
  const jsonMatch = text.match(/=\s*(\{.*?\})\s*;/);
  if (!jsonMatch?.[1]) return factorMap;

  const jsonObj = JSON.parse(jsonMatch[1]) as {
    total: number;
    data: SinaQfqFactor[];
  };
  if (!jsonObj.data) return factorMap;

  for (const item of jsonObj.data) {
    factorMap.set(item.d, parseFloat(item.f));
  }

  return factorMap;
}

// 新浪财经 API（备用，前复权）
async function fetchFromSina(
  code: string,
  market: "SH" | "SZ",
  limit: number
): Promise<KLineData[]> {
  const fullCode = market === "SH" ? `sh${code}` : `sz${code}`;
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData`;

  const [klineRes, factorMap] = await Promise.all([
    fetch(`${url}?symbol=${fullCode}&scale=240&ma=no&datalen=${limit}`, {
      headers: {
        Referer: "https://finance.sina.com.cn/",
        "User-Agent": "Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    }),
    fetchSinaQfqFactor(code, market),
  ]);

  if (!klineRes.ok) return [];

  const text = await klineRes.text();
  if (text.includes("null") || (!text.startsWith("[") && !text.startsWith("{"))) {
    return [];
  }

  const json = JSON.parse(text) as Array<{
    day?: string;
    date?: string;
    open?: string;
    close?: string;
    high?: string;
    low?: string;
    volume?: string;
  }>;

  if (!Array.isArray(json) || json.length === 0) return [];

  // 没有前复权因子，直接返回不复权数据
  if (factorMap.size === 0) {
    return json.slice(0, limit).map((item) => ({
      date: item.day || item.date || "",
      open: Number(item.open) || 0,
      close: Number(item.close) || 0,
      high: Number(item.high) || 0,
      low: Number(item.low) || 0,
      amount: Number(item.volume) || 0,
    }));
  }

  // 将前复权因子按日期升序排列（最早日期在前）
  // 每个因子代表从该日期起（含）生效的复权因子
  const sortedFactors = [...factorMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b));

  // 为每条K线找到对应的前复权因子
  // 前向填充：找到 <= 当天日期的最大因子日期
  function getQfqFactor(date: string): number {
    let result = 1;
    for (const [factorDate, factor] of sortedFactors) {
      if (factorDate <= date) {
        result = factor;
      } else {
        break; // 升序排列，遇到 > date 的就可以停止
      }
    }
    return result;
  }

  return json.slice(0, limit).map((item) => {
    const date = item.day || item.date || "";
    const factor = getQfqFactor(date);
    return {
      date,
      open: Math.round((Number(item.open) / factor) * 100) / 100,
      close: Math.round((Number(item.close) / factor) * 100) / 100,
      high: Math.round((Number(item.high) / factor) * 100) / 100,
      low: Math.round((Number(item.low) / factor) * 100) / 100,
      amount: Number(item.volume) || 0,
    };
  });
}

/**
 * 将近一个月的K线收盘价 upsert 到 stock_daily_price 表
 * 使用收盘价作为 price，涨跌幅从K线数据中获取或计算
 * 已有记录只更新 price 和 change_rate，保留已有的 stock_name
 */
async function upsertRecentPrices(stockCode: string, klines: KLineData[]): Promise<void> {
  // 取近30个交易日的数据
  const recentKlines = klines.slice(-30);
  if (recentKlines.length === 0) return;

  const client = getSupabaseClient();

  // 查询已有记录，获取已有的 stock_name
  const dates = recentKlines.map((k) => k.date);
  const { data: existing } = await client
    .from("stock_daily_price")
    .select("date, stock_name")
    .eq("stock_code", stockCode)
    .in("date", dates);

  const existingMap = new Map(
    (existing || []).map((r) => [r.date, r.stock_name as string])
  );

  // 构建要 upsert 的行数据
  const rows = recentKlines.map((kline, i) => {
    // 计算涨跌幅：优先使用API返回的changeRate，否则用前一天收盘价计算
    let changeRate = kline.changeRate;
    if ((changeRate === undefined || changeRate === 0) && i > 0) {
      const prevClose = recentKlines[i - 1].close;
      if (prevClose > 0) {
        changeRate = ((kline.close - prevClose) / prevClose) * 100;
      }
    }

    // 保留已有的 stock_name
    const existingName = existingMap.get(kline.date);
    return {
      date: kline.date,
      stock_code: stockCode,
      stock_name: existingName || "",
      price: kline.close,
      change_rate: changeRate ?? 0,
    };
  });

  await client.from("stock_daily_price").upsert(rows, {
    onConflict: "date,stock_code",
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 120;

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const market: "SH" | "SZ" = symbol.startsWith("sh") ? "SH" : "SZ";
  const code = symbol.replace(/^(sh|sz)/, "");

  // 尝试多个数据源
  let klines = await fetchFromEastMoney(code, market, limit);

  // 如果东方财富失败，尝试新浪
  if (klines.length === 0) {
    klines = await fetchFromSina(code, market, limit);
  }

  // 获取K线成功后，异步更新近一个月的价格到 stock_daily_price 表
  if (klines.length > 0) {
    upsertRecentPrices(code, klines).catch((err) => {
      console.error("更新日K价格到stock_daily_price失败:", err);
    });
  }

  return NextResponse.json({
    symbol,
    klines,
    count: klines.length,
    source: klines.length > 0 ? "eastmoney" : "none",
  });
}