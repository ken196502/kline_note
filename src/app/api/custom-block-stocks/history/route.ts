import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";
import { getRecentTradingDays } from "@/lib/trading-day";

interface StockDayData {
  code: string;
  name: string;
  latest: number;
  changeRate: number;
  marketType: string;
  source: "limitUp" | "nonLimitUp";
  sourceBlockName?: string;
  timePreview?: number[];
  hasPrice: boolean;
}

interface DayGroup {
  date: string;
  stocks: StockDayData[];
}

// 获取自定义板块过往行情（最多10个交易日）
// 只使用 stock_daily_price 和 stock_limit_up 中的真实历史数据
// 不使用腾讯实时行情补充，避免历史日期显示错误价格
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const blockId = searchParams.get("blockId");

  if (!blockId) {
    return NextResponse.json(
      { error: "Missing blockId" },
      { status: 400 }
    );
  }

  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 验证自定义板块归属
  const { data: customBlock, error: blockError } = await client
    .from("custom_blocks")
    .select("id")
    .eq("id", Number(blockId))
    .eq("username", username)
    .single();

  if (blockError || !customBlock) {
    return NextResponse.json(
      { error: "自定义板块不存在" },
      { status: 404 }
    );
  }

  // 从关联表获取所有股票代码和名称（保持固定顺序）
  const { data: manualStocks } = await client
    .from("custom_block_stocks")
    .select("stock_code, stock_name")
    .eq("custom_block_id", Number(blockId));

  const stockEntries: { code: string; name: string }[] = (
    manualStocks || []
  ).map((s) => ({
    code: s.stock_code as string,
    name: (s.stock_name as string) || "",
  }));

  const stockCodes = stockEntries.map((s) => s.code);
  const nameMap = new Map<string, string>();
  for (const entry of stockEntries) {
    nameMap.set(entry.code, entry.name);
  }

  if (stockCodes.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // 获取最近10个交易日
  const today = new Date().toISOString().split("T")[0];
  const recentDays = getRecentTradingDays(today, 10);

  // 查询 stock_limit_up 中这些股票在这些日期的数据
  const { data: limitUpData } = await client
    .from("stock_limit_up")
    .select("date, stock_code, stock_name, latest, change_rate, block_code, block_name, market_type, time_preview")
    .in("date", recentDays)
    .in("stock_code", stockCodes);

  // 找出有涨停记录的日期
  const datesWithActivity = new Set<string>();
  const limitUpByDateAndCode = new Map<
    string,
    Map<
      string,
      {
        latest: number;
        changeRate: number;
        blockCode: string;
        blockName: string;
        marketType: string;
        timePreview: number[] | undefined;
      }
    >
  >();

  for (const item of limitUpData || []) {
    const date = item.date as string;
    const code = item.stock_code as string;
    datesWithActivity.add(date);

    if (!limitUpByDateAndCode.has(date)) {
      limitUpByDateAndCode.set(date, new Map());
    }
    const codeMap = limitUpByDateAndCode.get(date)!;
    // 同一股票同一天可能在多个板块涨停，只取第一条
    if (!codeMap.has(code)) {
      codeMap.set(code, {
        latest: (item.latest as number) || 0,
        changeRate: (item.change_rate as number) || 0,
        blockCode: (item.block_code as string) || "",
        blockName: (item.block_name as string) || "",
        marketType: (item.market_type as string) || "",
        timePreview: item.time_preview
          ? typeof item.time_preview === "string"
            ? (JSON.parse(item.time_preview) as number[])
            : undefined
          : undefined,
      });
    }
  }

  // 如果没有任何有行情的日期，使用最近交易日
  if (datesWithActivity.size === 0) {
    if (recentDays.length > 0) {
      datesWithActivity.add(recentDays[0]);
    } else {
      return NextResponse.json({ data: [] });
    }
  }

  // 按日期降序排列
  const sortedDates = Array.from(datesWithActivity).sort(
    (a, b) => b.localeCompare(a)
  );

  // 查询 stock_daily_price 获取各日期的价格（只取真实历史数据）
  const { data: dailyPrices } = await client
    .from("stock_daily_price")
    .select("date, stock_code, stock_name, price, change_rate")
    .in("date", sortedDates)
    .in("stock_code", stockCodes);

  // 构建 date -> code -> price data 映射
  const dailyPriceByDateAndCode = new Map<
    string,
    Map<string, { price: number; changeRate: number; name: string }>
  >();

  for (const dp of dailyPrices || []) {
    const date = dp.date as string;
    const code = dp.stock_code as string;

    if (!dailyPriceByDateAndCode.has(date)) {
      dailyPriceByDateAndCode.set(date, new Map());
    }
    dailyPriceByDateAndCode.get(date)!.set(code, {
      price: dp.price as number,
      changeRate: dp.change_rate as number,
      name: (dp.stock_name as string) || "",
    });
  }

  // 组装返回数据
  // 排序规则：涨停股在前（按 stockEntries 顺序），非涨停股在后（按 stockEntries 顺序）
  const result: DayGroup[] = [];

  for (const date of sortedDates) {
    const limitUpCodeMap = limitUpByDateAndCode.get(date);
    const dailyMap = dailyPriceByDateAndCode.get(date);
    const limitUpCodesForDate = new Set(limitUpCodeMap?.keys() || []);

    const limitUpStocks: StockDayData[] = [];
    const nonLimitUpStocks: StockDayData[] = [];

    for (const entry of stockEntries) {
      const dailyPrice = dailyMap?.get(entry.code);
      const limitUpInfo = limitUpCodeMap?.get(entry.code);

      if (limitUpCodesForDate.has(entry.code) && limitUpInfo) {
        // 涨停股：优先用 stock_daily_price 的价格，其次用 stock_limit_up 的
        const hasPrice = dailyPrice?.price != null || limitUpInfo.latest != null;
        limitUpStocks.push({
          code: entry.code,
          name: nameMap.get(entry.code) || dailyPrice?.name || entry.code,
          latest: dailyPrice?.price ?? limitUpInfo.latest ?? 0,
          changeRate: dailyPrice?.changeRate ?? limitUpInfo.changeRate ?? 0,
          marketType: limitUpInfo.marketType || (entry.code.startsWith("6") ? "SH" : "SZ"),
          source: "limitUp",
          sourceBlockName: limitUpInfo.blockName,
          timePreview: limitUpInfo.timePreview,
          hasPrice,
        });
      } else {
        // 非涨停股：只用 stock_daily_price 的价格
        const hasPrice = dailyPrice?.price != null;
        nonLimitUpStocks.push({
          code: entry.code,
          name: nameMap.get(entry.code) || dailyPrice?.name || entry.code,
          latest: dailyPrice?.price ?? 0,
          changeRate: dailyPrice?.changeRate ?? 0,
          marketType: entry.code.startsWith("6") ? "SH" : "SZ",
          source: "nonLimitUp",
          hasPrice,
        });
      }
    }

    result.push({ date, stocks: [...limitUpStocks, ...nonLimitUpStocks] });
  }

  return NextResponse.json({ data: result });
}