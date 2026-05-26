import { NextRequest, NextResponse } from "next/server";

// ============ 东方财富 K线数据 API ============

interface KLineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  amount: number;
}

async function fetchDailyKLineFromEastMoney(
  code: string,
  market: "SH" | "SZ" = "SH",
  limit: number = 120
): Promise<KLineData[]> {
  const secid = market === "SH" ? `1.${code}` : `0.${code}`;
  const url = "https://push2his.eastmoney.com/api/qt/stock/kline/get";

  const params = new URLSearchParams({
    fields1: "f1,f2,f3,f4,f5,f6",
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
    klt: "101", // 日K
    fqt: "1", // 前复权
    secid,
    end: "20500101",
    lmt: String(limit),
  });

  const res = await fetch(`${url}?${params}`, {
    headers: {
      Referer: "https://quote.eastmoney.com/",
      Origin: "https://quote.eastmoney.com",
      "User-Agent":
        "Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36",
    },
  });

  const json = (await res.json()) as {
    data?: { klines?: string[] };
  };
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
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 120;

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol is required" },
      { status: 400 }
    );
  }

  // 解析 symbol: "sz000001" -> code="000001", market="SZ"
  const market: "SH" | "SZ" = symbol.startsWith("sh") ? "SH" : "SZ";
  const code = symbol.replace(/^(sh|sz)/, "");

  const klines = await fetchDailyKLineFromEastMoney(code, market, limit);

  return NextResponse.json({ symbol, klines });
}