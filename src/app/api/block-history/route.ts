import { NextRequest, NextResponse } from "next/server";
import type { DayBlockData, BlockData, StockData } from "@/types/block-data";
import {
  fetchFromApi,
  transformBlockData,
  transformStockData,
} from "@/lib/block-api";
import { getPrevTradingDay, isHoliday } from "@/lib/trading-day";

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

  const result: DayBlockData[] = [];
  let loadedDays = 0;

  // 获取指定天数的数据
  while (loadedDays < days) {
    try {
      const apiData = await fetchFromApi(currentDate);

      if (apiData.status_code === 0 && apiData.data) {
        const blocks: BlockData[] = [];
        const stocks: StockData[] = [];

        for (const block of apiData.data) {
          blocks.push(transformBlockData(currentDate, block));

          if (block.stock_list) {
            for (const stock of block.stock_list) {
              stocks.push(transformStockData(currentDate, block, stock));
            }
          }
        }

        // 按涨停数排序板块
        blocks.sort((a, b) => b.limitUpNum - a.limitUpNum);

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
