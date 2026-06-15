import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";

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
  remark?: string;
  nameColor?: string;
  daysInBlock?: number;
}

interface DayGroup {
  date: string;
  customDateId: number;
  stocks: StockDayData[];
}

// 获取自定义板块过往行情（基于自定义日期）
// 日期来源于 custom_dates 表，而非涨停表
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

  // 从 custom_dates 获取该板块下所有自定义日期
  const { data: customDates, error: datesError } = await client
    .from("custom_dates")
    .select("id, date")
    .eq("username", username)
    .eq("custom_block_id", Number(blockId))
    .order("date", { ascending: false });

  if (datesError) {
    return NextResponse.json({ error: datesError.message }, { status: 500 });
  }

  if (!customDates || customDates.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // 从 custom_date_stocks 获取每个日期内的股票（按 sort_order 排序）
  const dateIds = customDates.map((d: any) => d.id);
  const { data: dateStocks, error: stocksError } = await client
    .from("custom_date_stocks")
    .select("id, custom_date_id, stock_code, stock_name, sort_order, remark, stock_name_color")
    .in("custom_date_id", dateIds)
    .order("sort_order", { ascending: true });

  if (stocksError) {
    return NextResponse.json({ error: stocksError.message }, { status: 500 });
  }

  // 构建 dateId -> stocks 映射
  const stocksByDateId = new Map<number, { code: string; name: string; sortOrder: number; remark: string; nameColor: string }[]>();
  for (const s of dateStocks || []) {
    const dateId = s.custom_date_id as number;
    if (!stocksByDateId.has(dateId)) stocksByDateId.set(dateId, []);
    stocksByDateId.get(dateId)!.push({
      code: s.stock_code as string,
      name: (s.stock_name as string) || "",
      sortOrder: s.sort_order as number,
      remark: (s.remark as string) || "",
      nameColor: (s.stock_name_color as string) || "",
    });
  }

  // 收集所有股票代码
  const allStockCodes = Array.from(stocksByDateId.values())
    .flat()
    .map((s) => s.code);
  const uniqueStockCodes = [...new Set(allStockCodes)];

  if (uniqueStockCodes.length === 0) {
    // 有日期但日期内没股票
    const result: DayGroup[] = customDates.map((d: any) => ({
      date: d.date as string,
      customDateId: d.id as number,
      stocks: [],
    }));
    return NextResponse.json({ data: result });
  }

  // 收集所有日期
  const allDates = customDates.map((d: any) => d.date as string);

  // 查询 stock_limit_up 中这些股票在这些日期的数据
  const { data: limitUpData } = await client
    .from("stock_limit_up")
    .select("date, stock_code, stock_name, latest, change_rate, block_code, block_name, market_type, time_preview")
    .in("date", allDates)
    .in("stock_code", uniqueStockCodes);

  // 同时查询 stock_daily_price 中这些股票在最新交易日的数据（用于非涨停日期的补充价格）
  // 先获取所有不在 stock_limit_up 中的 stock_code，用最新交易日价格补充
  const { data: latestDailyPrices } = await client
    .from("stock_daily_price")
    .select("stock_code, stock_name, price, change_rate, date")
    .in("stock_code", uniqueStockCodes)
    .order("date", { ascending: false });

  // 构建 code -> 最新日价格数据映射
  const latestDailyByCode = new Map<string, { price: number; changeRate: number; name: string; date: string }>();
  const seenDailyCodes = new Set<string>();
  for (const dp of latestDailyPrices || []) {
    const code = dp.stock_code as string;
    if (seenDailyCodes.has(code)) continue;
    seenDailyCodes.add(code);
    latestDailyByCode.set(code, {
      price: dp.price as number,
      changeRate: dp.change_rate as number,
      name: (dp.stock_name as string) || "",
      date: dp.date as string,
    });
  }

  // 找出有涨停记录的数据
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

  // 计算每只股票在板块中出现的日期数
  const stockDaysCount = new Map<string, number>();
  for (const [, dateStocksList] of stocksByDateId) {
    const seenInDate = new Set<string>();
    for (const entry of dateStocksList) {
      if (!seenInDate.has(entry.code)) {
        seenInDate.add(entry.code);
        stockDaysCount.set(entry.code, (stockDaysCount.get(entry.code) || 0) + 1);
      }
    }
  }

  // 组装返回数据（按 custom_date_stocks.sort_order 排序）
  const result: DayGroup[] = [];

  for (const customDate of customDates) {
    const dateStr = customDate.date as string;
    const dateId = customDate.id as number;
    const dateStocksList = stocksByDateId.get(dateId) || [];

    const limitUpCodeMap = limitUpByDateAndCode.get(dateStr);
    const stocks: StockDayData[] = [];

    for (const entry of dateStocksList) {
      const limitUpInfo = limitUpCodeMap?.get(entry.code);
      const latestDaily = latestDailyByCode.get(entry.code);
      const hasPrice = latestDaily?.price != null && latestDaily.price > 0;

      stocks.push({
        code: entry.code,
        name: entry.name || latestDaily?.name || entry.code,
        latest: latestDaily?.price ?? 0,
        changeRate: latestDaily?.changeRate ?? 0,
        marketType: limitUpInfo?.marketType || (entry.code.startsWith("6") ? "SH" : "SZ"),
        source: limitUpInfo ? "limitUp" : "nonLimitUp",
        sourceBlockName: limitUpInfo?.blockName,
        timePreview: limitUpInfo?.timePreview,
        hasPrice,
        remark: entry.remark,
        nameColor: entry.nameColor,
        daysInBlock: stockDaysCount.get(entry.code) || 1,
      });
    }

    result.push({
      date: dateStr,
      customDateId: dateId,
      stocks,
    });
  }

  return NextResponse.json({ data: result });
}