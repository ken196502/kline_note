import { NextRequest, NextResponse } from "next/server";

// ============ K线数据 API（支持多数据源） ============

interface KLineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  amount: number;
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
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
    klt: "101",
    fqt: "1",
    secid,
    end: "20500101",
    lmt: String(limit),
  });

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
      };
    });
  } catch {
    return [];
  }
}

// 新浪财经 API（备用）
async function fetchFromSina(
  code: string,
  market: "SH" | "SZ"
): Promise<KLineData[]> {
  const fullCode = market === "SH" ? `sh${code}` : `sz${code}`;
  const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData`;

  try {
    const res = await fetch(`${url}?symbol=${fullCode}&scale=240&datalen=120`, {
      headers: {
        Referer: "https://finance.sina.com.cn/",
        "User-Agent": "Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const text = await res.text();
    // 新浪返回 JSON 数组格式
    if (text.includes("null") || !text.startsWith("[") && !text.startsWith("{")) return [];

    try {
      const json = JSON.parse(text) as Array<{
        day?: string;
        date?: string;
        open?: string;
        close?: string;
        high?: string;
        low?: string;
        volume?: string;
      }>;

      if (!Array.isArray(json)) return [];

      return json.slice(0, 120).map((item) => ({
        date: item.day || item.date || "",
        open: Number(item.open) || 0,
        close: Number(item.close) || 0,
        high: Number(item.high) || 0,
        low: Number(item.low) || 0,
        amount: Number(item.volume) || 0,
      }));
    } catch {
      return [];
    }
  } catch {
    return [];
  }
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
    klines = await fetchFromSina(code, market);
  }

  return NextResponse.json({
    symbol,
    klines,
    count: klines.length,
    source: klines.length > 0 ? "eastmoney" : "none",
  });
}