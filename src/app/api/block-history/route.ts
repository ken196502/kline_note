import { NextRequest, NextResponse } from "next/server";
import type { DayBlockData, BlockData, StockData } from "@/types/block-data";
import {
  fetchFromApi,
  fetchAndUpsertTimePreview,
  transformBlockData,
  transformStockData,
} from "@/lib/block-api";
import { getPrevTradingDay, isHoliday } from "@/lib/trading-day";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const days = Number.parseInt(searchParams.get("days") || "5", 10);

  // 如果没有提供开始日期，使用今天
  let currentDate = startDate || new Date().toISOString().split("T")[0];

  // 如果当前日期是节假日，往前找最近的交易日
  while (isHoliday(new Date(currentDate))) {
    currentDate = getPrevTradingDay(currentDate);
  }

  const client = getSupabaseClient();
  const result: DayBlockData[] = [];
  let loadedDays = 0;

  // 获取指定天数的数据
  while (loadedDays < days) {
    try {
      // 先尝试从数据库获取板块数据
      const { data: cachedBlocks, error: blockError } = await client
        .from("block_limit_up")
        .select("*")
        .eq("date", currentDate)
        .order("limit_up_num", { ascending: false });

      if (!blockError && cachedBlocks && cachedBlocks.length > 0) {
        // 数据库有板块数据
        const blocks: BlockData[] = cachedBlocks.map((b) => ({
          date: b.date as string,
          code: b.code as string,
          name: b.name as string,
          change: b.change as number,
          limitUpNum: b.limit_up_num as number,
          continuousPlateNum: b.continuous_plate_num as number,
          high: (b.high as string) || "",
          highNum: b.high_num as number,
          days: b.days as number,
        }));

        // 获取个股数据
        const { data: cachedStocks } = await client
          .from("stock_limit_up")
          .select("*")
          .eq("date", currentDate);

        const stocks: StockData[] = (cachedStocks || []).map((s) => ({
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

        result.push({
          date: currentDate,
          blocks,
          stocks,
        });
        loadedDays++;
        currentDate = getPrevTradingDay(currentDate);
        continue;
      }

      // 数据库没有数据，从API获取
      const apiData = await fetchFromApi(currentDate);

      if (apiData.status_code === 0 && apiData.data) {
        for (const block of apiData.data) {
          const blockData = transformBlockData(currentDate, block);

          // 存入数据库
          await client.from("block_limit_up").upsert({
            date: blockData.date,
            code: blockData.code,
            name: blockData.name,
            change: blockData.change,
            limit_up_num: blockData.limitUpNum,
            continuous_plate_num: blockData.continuousPlateNum,
            high: blockData.high,
            high_num: blockData.highNum,
            days: blockData.days,
          }, {
            onConflict: 'date,code'
          });

          if (block.stock_list) {
            for (const stock of block.stock_list) {
              const stockData = transformStockData(currentDate, block, stock);

              // 存入数据库
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
              }, {
                onConflict: 'date,block_code,stock_code'
              });

              // 同步写入 stock_daily_price 表
              await client.from("stock_daily_price").upsert({
                date: stockData.date,
                stock_code: stockData.code,
                stock_name: stockData.name,
                price: stockData.latest,
                change_rate: stockData.changeRate,
              }, {
                onConflict: 'date,stock_code'
              });
            }
          }
        }

        // 获取到板块数据后，立即获取涨停分时数据
        fetchAndUpsertTimePreview(currentDate).catch(err => {
          console.error(`获取 ${currentDate} 分时数据失败:`, err);
        });

        // 重新从数据库获取数据（已排序）
        const { data: sortedBlocks } = await client
          .from("block_limit_up")
          .select("*")
          .eq("date", currentDate)
          .order("limit_up_num", { ascending: false });

        const blocks: BlockData[] = (sortedBlocks || []).map((b) => ({
          date: b.date as string,
          code: b.code as string,
          name: b.name as string,
          change: b.change as number,
          limitUpNum: b.limit_up_num as number,
          continuousPlateNum: b.continuous_plate_num as number,
          high: (b.high as string) || "",
          highNum: b.high_num as number,
          days: b.days as number,
        }));

        const { data: allStocks } = await client
          .from("stock_limit_up")
          .select("*")
          .eq("date", currentDate);

        const stocks: StockData[] = (allStocks || []).map((s) => ({
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

        if (blocks.length > 0) {
          result.push({
            date: currentDate,
            blocks,
            stocks,
          });
          loadedDays++;
        }
      }

      // 移动到上一个交易日
      currentDate = getPrevTradingDay(currentDate);
    } catch (error) {
      console.error(`获取 ${currentDate} 数据失败:`, error);
      currentDate = getPrevTradingDay(currentDate);
    }
  }

  // 判断是否还有更多数据（往前推30天检查）
  const hasMore = result.length === days;
  const nextDate = result.length > 0 ? getPrevTradingDay(result[result.length - 1].date) : null;

  return NextResponse.json({
    data: result,
    hasMore,
    nextDate,
  });
}
