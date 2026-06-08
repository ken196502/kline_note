import { NextRequest, NextResponse } from "next/server";

// ============ 股票异动 API（东方财富数据源） ============

// 异动类型映射（对应东财 type 参数与中文含义）
const TYPE_MAPPING: Record<string, string> = {
  "1": "火箭发射",
  "2": "快速反弹",
  "3": "大笔买入",
  "4": "封涨停板",
  "5": "打开涨停",
  "6": "快速下跌",
  "7": "加速下跌",
  "8": "大笔卖出",
  "9": "封跌停板",
  "10": "打开跌停",
  "11": "高位跳水",
  "12": "低位反弹",
};

interface StockChangeItem {
  code: string;
  name: string;
  time: string;
  type: string;
  changeRate: number;
  market: number;
}

// 解析 JSONP 响应
function parseJsonp(jsonpStr: string): unknown {
  if (!jsonpStr || typeof jsonpStr !== "string") return null;
  const match = jsonpStr.match(/^[a-zA-Z0-9_]+\s*\(\s*(.*)\s*\)\s*;?\s*$/);
  if (match) {
    return JSON.parse(match[1]);
  }
  return JSON.parse(jsonpStr);
}

// 格式化时间戳为 HH:MM
function formatTime(tm: number | string): string {
  const tmStr = String(tm).padStart(6, "0");
  return `${tmStr.slice(0, 2)}:${tmStr.slice(2, 4)}`;
}

// 判断当前是否在A股交易时段（9:25 - 15:15）
function isInTradingSession(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  return timeInMinutes >= 565 && timeInMinutes <= 915;
}

async function fetchStockChanges(): Promise<StockChangeItem[]> {
  const typeKeys = Object.keys(TYPE_MAPPING).join(",");
  const cb = `jQuery_${Date.now()}_${Math.random().toString().slice(2, 8)}`;
  const _ = Date.now();
  const url = `https://push2ex.eastmoney.com/getAllStockChanges?type=${typeKeys}&cb=${cb}&ut=7eea3edcaed734bea9cbfc24409ed989&pageindex=0&pagesize=1000&dpt=wzchanges&_=${_}`;

  const res = await fetch(url, {
    headers: {
      Accept: "*/*",
      Referer: "https://quote.eastmoney.com/changes/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];

  const text = await res.text();
  const data = parseJsonp(text) as {
    data?: { allstock?: Array<Record<string, unknown>> };
  };

  if (!data?.data?.allstock) return [];

  const items = data.data.allstock;

  return items
    .map((item) => {
      const code = String(item.c || "");
      const name = String(item.n || "");
      const tm = item.tm as number;
      const market = Number(item.m || 0);
      const type = String(item.t || "");
      const info = String(item.i || "");

      // 解析涨跌幅
      const infoParts = info.split(",");
      let changeRate = infoParts[0] ? parseFloat(infoParts[0]) : 0;

      // 涨停板使用固定涨跌幅
      if (type === "4") {
        if (code.startsWith("8")) changeRate = 0.3;
        else if (code.startsWith("300") || code.startsWith("688")) changeRate = 0.2;
        else changeRate = 0.1;
      }

      // 过滤条件：涨幅 < 100% 且 (涨幅 >= 5% 或 跌幅 <= -5%)
      if (changeRate >= 1) return null;
      if (changeRate < 0.05 && changeRate > -0.05) return null;

      // 过滤 ST
      if (name.includes("ST")) return null;

      const typeName = TYPE_MAPPING[type] || "未知";

      return {
        code,
        name,
        time: formatTime(tm),
        type: typeName,
        changeRate,
        market,
      };
    })
    .filter((item): item is StockChangeItem => item !== null);
}

export const dynamic = "force-dynamic";

// 共享缓存：多客户端共享同一份异动数据，避免重复请求东财 API
interface CacheData {
  data: StockChangeItem[];
  trading: boolean;
  fetchTime: number;
}
let sharedCache: CacheData | null = null;
const CACHE_TTL = 3000; // 缓存有效期 3 秒

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const codesParam = searchParams.get("codes");

  const now = Date.now();
  const trading = isInTradingSession();

  // 如果缓存有效（未过期），直接使用缓存数据
  if (sharedCache && now - sharedCache.fetchTime < CACHE_TTL) {
    // 按用户请求的股票代码过滤缓存数据
    let filteredData = sharedCache.data;
    if (codesParam) {
      const codes = new Set(codesParam.split(","));
      filteredData = filteredData.filter((item) => codes.has(item.code));
    }
    return NextResponse.json({ data: filteredData, trading: sharedCache.trading });
  }

  // 缓存过期或不存在，重新请求东财 API
  let allChanges: StockChangeItem[];
  try {
    allChanges = await fetchStockChanges();
  } catch {
    return NextResponse.json({ data: [], trading, error: "fetch_failed" });
  }

  // 按股票代码+类型去重，同一只股票同一种异动只保留最新一条
  const seen = new Map<string, StockChangeItem>();
  for (const item of allChanges) {
    const key = `${item.code}_${item.type}`;
    seen.set(key, item); // 后出现的覆盖先出现的（数据按时间倒序则保留最新）
  }

  const result = [...seen.values()].sort((a, b) => {
    // 按时间倒序
    return b.time.localeCompare(a.time);
  });

  // 更新共享缓存
  sharedCache = {
    data: result,
    trading,
    fetchTime: now,
  };

  // 按用户请求的股票代码过滤
  let filteredData = result;
  if (codesParam) {
    const codes = new Set(codesParam.split(","));
    filteredData = filteredData.filter((item) => codes.has(item.code));
  }

  return NextResponse.json({ data: filteredData, trading });
}