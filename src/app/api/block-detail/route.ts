import { NextRequest, NextResponse } from "next/server";
import type { BlockData, StockData } from "@/types/block-data";
import {
  fetchFromApi,
  transformBlockData,
  transformStockData,
} from "@/lib/block-api";
import { getPrevTradingDay, isHoliday } from "@/lib/trading-day";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const startDate = searchParams.get("startDate");
  const days = Number.parseInt(searchParams.get("days") || "10", 10);

  if (!code) {
    return NextResponse.json({ error: "Missing block code" }, { status: 400 });
  }

  let currentDate = startDate || new Date().toISOString().split("T")[0];

  // 如果当前日期是节假日，往前找最近的交易日
  while (isHoliday(new Date(currentDate))) {
    currentDate = getPrevTradingDay(currentDate);
  }

  const result: { date: string; block: BlockData; stocks: StockData[] }[] = [];
  let loadedDays = 0;
  let totalScanned = 0;
  const maxScan = days * 3; // 最多扫描3倍天数，防止空数据日过多

  while (loadedDays < days && totalScanned < maxScan) {
    totalScanned++;
    try {
      const apiData = await fetchFromApi(currentDate);

      if (apiData.status_code === 0 && apiData.data) {
        const targetBlock = apiData.data.find((b) => b.code === code);

        if (targetBlock) {
          const block = transformBlockData(currentDate, targetBlock);
          const stocks: StockData[] = [];

          if (targetBlock.stock_list) {
            for (const stock of targetBlock.stock_list) {
              stocks.push(transformStockData(currentDate, targetBlock, stock));
            }
          }

          result.push({ date: currentDate, block, stocks });
          loadedDays++;
        }
      }

      currentDate = getPrevTradingDay(currentDate);
    } catch (error) {
      console.error(`获取 ${currentDate} 数据失败:`, error);
      currentDate = getPrevTradingDay(currentDate);
    }
  }

  const hasMore = totalScanned >= maxScan;
  const nextDate = result.length > 0 ? getPrevTradingDay(result[result.length - 1].date) : null;

  return NextResponse.json({
    data: result,
    hasMore,
    nextDate,
  });
}
