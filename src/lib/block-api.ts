import type { ApiBlock, ApiResponse, ApiStock } from "@/types/block-data";
import { formatTime } from "./trading-day";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 腾讯实时行情返回的单条数据结构
interface TencentQuoteItem {
  code: string;       // 股票代码（腾讯格式 sh600519）
  name: string;       // 股票名称
  price: number;      // 当前价格
  changeRate: number;  // 涨跌幅百分比
}

/**
 * 将股票代码转换为腾讯格式
 * 上证: sh600519, 深证: sz000001
 */
function convertToTencentCode(code: string, marketType?: string): string {
  if (marketType === "SH" || code.startsWith("6")) {
    return `sh${code}`;
  }
  return `sz${code}`;
}

/**
 * 从腾讯实时行情接口批量获取股票价格和涨跌幅
 * 接口: https://qt.gtimg.cn/q=sh600519,sz000001
 * 返回格式: 每行一个 v_sh600519="1~贵州茅台~600519~...~当前价~...~涨跌幅~..."
 * 字段说明（以~分隔）: 第1位市场标识, 第2位名称, 第3位代码, 第4位当前价, 第5位昨收, ...
 * 涨跌幅在第33位（索引32）
 */
export async function fetchTencentQuotes(
  stockCodes: string[],
  marketTypeMap?: Map<string, string>
): Promise<Map<string, TencentQuoteItem>> {
  const result = new Map<string, TencentQuoteItem>();

  if (stockCodes.length === 0) return result;

  // 转换为腾讯格式的代码
  const tencentCodes = stockCodes.map((code) =>
    convertToTencentCode(code, marketTypeMap?.get(code))
  );

  // 腾讯接口支持批量查询，用逗号分隔
  const url = `https://qt.gtimg.cn/q=${tencentCodes.join(",")}`;

  const response = await fetch(url, {
    headers: {
      Referer: "https://gu.qq.com/",
      "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    console.error("腾讯行情接口请求失败:", response.status);
    return result;
  }

  const text = await response.text();
  const lines = text.split(";").filter((line) => line.trim().length > 0);

  for (const line of lines) {
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const content = line.substring(eqIndex + 1).replace(/^"|"$/g, "");
    if (!content) continue;

    const fields = content.split("~");
    if (fields.length < 33) continue;

    const rawCode = fields[2] || "";   // 纯数字代码
    const name = fields[1] || "";
    const price = parseFloat(fields[3]);
    const changeRate = parseFloat(fields[32]);

    if (!rawCode || Number.isNaN(price)) continue;

    result.set(rawCode, {
      code: rawCode,
      name,
      price,
      changeRate: Number.isNaN(changeRate) ? 0 : changeRate,
    });
  }

  return result;
}

/**
 * 批量从腾讯实时行情获取数据，并 upsert 到 stock_daily_price 表
 * 返回成功获取的股票代码集合
 */
export async function fetchAndUpsertDailyPrices(
  date: string,
  stockCodes: string[],
  marketTypeMap?: Map<string, string>
): Promise<Map<string, { price: number; changeRate: number }>> {
  const result = new Map<string, { price: number; changeRate: number }>();

  if (stockCodes.length === 0) return result;

  const quotes = await fetchTencentQuotes(stockCodes, marketTypeMap);

  if (quotes.size === 0) return result;

  const client = getSupabaseClient();

  for (const [code, quote] of quotes) {
    // upsert 到 stock_daily_price
    await client.from("stock_daily_price").upsert(
      {
        date,
        stock_code: code,
        stock_name: quote.name,
        price: quote.price,
        change_rate: quote.changeRate,
      },
      { onConflict: "date,stock_code" }
    );

    result.set(code, { price: quote.price, changeRate: quote.changeRate });
  }

  return result;
}

// 从同花顺API获取涨停池数据（含分时缩略图）
export async function fetchLimitUpPoolFromApi(date: string) {
  const apiDate = date.replace(/-/g, "");
  const url = `https://data.10jqka.com.cn/dataapi/limit_up/limit_up_pool?page=1&limit=200&field=199112,10,9001,330323,330324,330325,9002,330329,133971,133970,1968584,3475914,9003,9004&filter=HS,GEM2STAR&order_field=330324&order_type=0&date=${apiDate}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer:
          "https://data.10jqka.com.cn/datacenterph/limitup/limtupInfo.html?client_userid=nM9Y3&back_source=hyperlink&share_hxapp=isc&fontzoom=no",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
    });

    const text = await response.text();
    if (text.includes("<h1>") || text.includes("<!DOCTYPE")) {
      console.error("涨停池API返回HTML错误:", text.substring(0, 200));
      return { status_code: -1 };
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("获取涨停池数据失败:", error);
    return { status_code: -1 };
  }
}

// 格式化时间戳为 HH:mm:ss
function formatTimeFromTimestamp(timestamp: string): string {
  if (!timestamp) return "";
  const ts = Number.parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return timestamp;
  const date = new Date(ts * 1000);
  const timeStr = date.toTimeString().split(" ")[0];
  return timeStr ?? "";
}

// 从API获取数据
export async function fetchFromApi(date: string): Promise<ApiResponse> {
  // 将日期格式从 YYYY-MM-DD 转换为 YYYYMMDD
  const apiDate = date.replace(/-/g, "");
  const url = `https://data.10jqka.com.cn/dataapi/limit_up/block_top?filter=HS,GEM2STAR&date=${apiDate}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer:
          "https://data.10jqka.com.cn/datacenterph/limitup/limtupInfo.html?client_userid=nM9Y3&back_source=hyperlink&share_hxapp=isc&fontzoom=no",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
    });

    const text = await response.text();

    // 检查是否是HTML错误页面
    if (text.includes("<h1>") || text.includes("<!DOCTYPE")) {
      console.error("API返回HTML错误页面:", text.substring(0, 200));
      return { status_code: -1 };
    }

    const result = JSON.parse(text) as ApiResponse;
    return result;
  } catch (error) {
    console.error("获取API数据失败:", error);
    return { status_code: -1 };
  }
}

// 转换板块数据
export function transformBlockData(date: string, block: ApiBlock) {
  return {
    date,
    code: block.code,
    name: block.name,
    change: block.change,
    limitUpNum: block.limit_up_num,
    continuousPlateNum: block.continuous_plate_num,
    high: block.high,
    highNum: block.high_num,
    days: block.days,
  };
}

// 获取指定日期的涨停分时数据并 upsert 到数据库
// forceRefresh: 是否强制刷新（盘中场景），为 false 时只更新缺少 time_preview 的记录
export async function fetchAndUpsertTimePreview(date: string, forceRefresh: boolean = false): Promise<void> {
  const client = getSupabaseClient();

  // 查询该日期的个股数据
  let query = client
    .from("stock_limit_up")
    .select("date, block_code, stock_code, time_preview")
    .eq("date", date);

  // 非强制刷新时，只处理缺少 time_preview 的记录
  if (!forceRefresh) {
    query = query.is("time_preview", null);
  }

  const { data: stocks, error } = await query;

  if (error || !stocks || stocks.length === 0) {
    return;
  }

  // 从涨停池API获取分时数据
  const poolData = await fetchLimitUpPoolFromApi(date);

  if (poolData.status_code !== 0 || !poolData.data?.info) {
    return;
  }

  const timePreviewMap = new Map<string, number[]>();
  for (const stockInfo of poolData.data.info) {
    if (stockInfo.time_preview && stockInfo.time_preview.length > 0) {
      timePreviewMap.set(stockInfo.code, stockInfo.time_preview);
    }
  }

  // 批量 upsert 分时数据
  for (const stock of stocks) {
    const timePreview = timePreviewMap.get(stock.stock_code as string);
    if (timePreview) {
      await client.from("stock_limit_up")
        .update({ time_preview: JSON.stringify(timePreview) })
        .eq("date", stock.date as string)
        .eq("block_code", stock.block_code as string)
        .eq("stock_code", stock.stock_code as string);
    }
  }
}

// 转换股票数据（支持两种调用方式）
export function transformStockData(
  date: string,
  blockOrCode: ApiBlock | string,
  stockOrName: ApiStock | string,
  stock?: ApiStock
) {
  let blockCode: string;
  let blockName: string;
  let targetStock: ApiStock;

  if (typeof blockOrCode === "object" && blockOrCode !== null) {
    // 方式一：(date, block, stock)
    blockCode = blockOrCode.code;
    blockName = blockOrCode.name;
    targetStock = stockOrName as ApiStock;
  } else if (stock !== undefined) {
    // 方式二：(date, blockCode, blockName, stock)
    blockCode = blockOrCode as string;
    blockName = stockOrName as string;
    targetStock = stock;
  } else {
    // 错误情况
    blockCode = "unknown";
    blockName = "其它";
    targetStock = stockOrName as ApiStock;
  }

  return {
    date,
    blockCode,
    blockName,
    code: targetStock.code,
    name: targetStock.name,
    latest: targetStock.latest,
    changeRate: targetStock.change_rate,
    continueNum: targetStock.continue_num,
    high: targetStock.high,
    highDays: targetStock.high_days,
    firstLimitUpTime: formatTime(targetStock.first_limit_up_time),
    lastLimitUpTime: formatTime(targetStock.last_limit_up_time),
    reasonType: targetStock.reason_type,
    reasonInfo: "",
    isNew: 0,
    isSt: 0,
    marketType: targetStock.code.startsWith("6") ? "SH" : "SZ",
    timePreview: (targetStock as any).time_preview as number[] | undefined,
  };
}
