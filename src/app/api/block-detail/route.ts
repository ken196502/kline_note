import { NextRequest, NextResponse } from "next/server";
import type { BlockData, StockData } from "@/types/block-data";
import {
  fetchFromApi,
  transformBlockData,
  transformStockData,
} from "@/lib/block-api";
import { getPrevTradingDay, isHoliday, getRecentTradingDays } from "@/lib/trading-day";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const startDate = searchParams.get("startDate");
  const days = Number.parseInt(searchParams.get("days") || "3", 10);

  if (!code) {
    return NextResponse.json({ error: "Missing block code" }, { status: 400 });
  }

  // 计算起始日期（跳过节假日）
  let startFromDate = startDate || new Date().toISOString().split("T")[0];
  while (isHoliday(new Date(startFromDate))) {
    startFromDate = getPrevTradingDay(startFromDate);
  }

  // 生成工作日序列（排除节假日）
  const tradingDays = getRecentTradingDays(startFromDate, days * 2);

  const client = getSupabaseClient();

  // 批量查询数据库中该板块已有的日期数据
  const { data: existingBlocks } = await client
    .from("block_limit_up")
    .select("date")
    .eq("code", code)
    .in("date", tradingDays);

  const existingDatesSet = new Set(
    (existingBlocks || []).map((row) => row.date as string)
  );

  // 分类：已有数据的日期 vs 需要抓取的日期
  const datesWithData: string[] = [];
  const datesToFetch: string[] = [];

  for (const date of tradingDays) {
    if (existingDatesSet.has(date)) {
      datesWithData.push(date);
    } else {
      datesToFetch.push(date);
    }
  }

  // 限制抓取数量，最多抓取 days 个缺失日期
  const datesToFetchLimited = datesToFetch.slice(0, days);

  const result: { date: string; block: BlockData; stocks: StockData[] }[] = [];

  // 批量从数据库读取已有数据
  if (datesWithData.length > 0) {
    // 批量查询板块数据
    const { data: cachedBlocks } = await client
      .from("block_limit_up")
      .select("*")
      .eq("code", code)
      .in("date", datesWithData);

    // 批量查询股票数据
    const { data: cachedStocks } = await client
      .from("stock_limit_up")
      .select("*")
      .eq("block_code", code)
      .in("date", datesWithData);

    // 按日期组织数据
    for (const date of datesWithData) {
      const block = cachedBlocks?.find((b) => b.date === date);
      if (!block) continue;

      const blockData: BlockData = {
        date: block.date as string,
        code: block.code as string,
        name: block.name as string,
        change: block.change as number,
        limitUpNum: block.limit_up_num as number,
        continuousPlateNum: block.continuous_plate_num as number,
        high: (block.high as string) || "",
        highNum: block.high_num as number,
        days: block.days as number,
      };

      const stocks: StockData[] = (cachedStocks || [])
        .filter((s) => s.date === date)
        .map((s) => ({
          date: s.date as string,
          blockCode: s.block_code as string,
          blockName: s.block_name as string,
          code: s.stock_code as string,
          name: s.stock_name as string,
          latest: s.latest as number,
          changeRate: s.change_rate as number,
          continueNum: s.continue_num as number,
          high: (s.high as string) || "",
          highDays: s.high_days as number,
          firstLimitUpTime: (s.first_limit_up_time as string) || "",
          lastLimitUpTime: (s.last_limit_up_time as string) || "",
          reasonType: (s.reason_type as string) || "",
          reasonInfo: (s.reason_info as string) || "",
          isNew: (s.is_new as number) || 0,
          isSt: (s.is_st as number) || 0,
          marketType: (s.market_type as string) || "",
          timePreview: typeof s.time_preview === 'string' ? JSON.parse(s.time_preview) as number[] : s.time_preview as number[] | undefined,
        }));

      result.push({ date, block: blockData, stocks });
    }
  }

  // 抓取缺失的日期数据（逐日抓取，避免被封）
  for (const date of datesToFetchLimited) {
    try {
      const apiData = await fetchFromApi(date);

      if (apiData.status_code === 0 && apiData.data) {
        const targetBlock = apiData.data.find((b) => b.code === code);

        if (targetBlock) {
          const block = transformBlockData(date, targetBlock);

          // 存储板块数据
          await client.from("block_limit_up").upsert({
            date: block.date,
            code: block.code,
            name: block.name,
            change: block.change,
            limit_up_num: block.limitUpNum,
            continuous_plate_num: block.continuousPlateNum,
            high: block.high,
            high_num: block.highNum,
            days: block.days,
          }, { onConflict: 'date,code' });

          const stocks: StockData[] = [];

          if (targetBlock.stock_list) {
            for (const stock of targetBlock.stock_list) {
              const stockData = transformStockData(date, targetBlock, stock);
              stocks.push(stockData);

              // 存储个股数据
              await client.from("stock_limit_up").upsert({
                date: stockData.date,
                block_code: stockData.blockCode,
                block_name: stockData.blockName,
                stock_code: stockData.code,
                stock_name: stockData.name,
                latest: stockData.latest,
                change_rate: stockData.changeRate,
                continue_num: stockData.continueNum,
                high: stockData.high,
                high_days: stockData.highDays,
                first_limit_up_time: stockData.firstLimitUpTime,
                last_limit_up_time: stockData.lastLimitUpTime,
                reason_type: stockData.reasonType,
                market_type: stockData.marketType,
                time_preview: stockData.timePreview ? JSON.stringify(stockData.timePreview) : null,
              }, { onConflict: 'date,block_code,stock_code' });
            }
          }

          result.push({ date, block, stocks });
        }
      }
    } catch (error) {
      console.error(`抓取 ${date} 数据失败:`, error);
    }
  }

  // 按日期排序（从新到旧）
  result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 只返回 days 个结果
  const finalResult = result.slice(0, days);

  const hasMore = datesToFetch.length > days || datesWithData.length > days;
  const nextDate = finalResult.length > 0 
    ? getPrevTradingDay(finalResult[finalResult.length - 1].date) 
    : null;

  return NextResponse.json({
    data: finalResult,
    hasMore,
    nextDate,
  });
}