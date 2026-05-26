import { NextRequest, NextResponse } from "next/server";
import type { BlockData, StockData } from "@/types/block-data";
import {
  fetchFromApi,
  fetchLimitUpPoolFromApi,
  transformBlockData,
  transformStockData,
} from "@/lib/block-api";
import { getPrevTradingDay, isHoliday } from "@/lib/trading-day";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 异步更新分时图数据（带延迟防封）
async function asyncUpdateTimePreview(stocks: StockData[], date: string) {
  // 只处理没有timePreview的股票
  const stocksWithoutPreview = stocks.filter(s => !s.timePreview);
  if (stocksWithoutPreview.length === 0) return;

  // 异步执行，不阻塞响应
  (async () => {
    try {
      // 获取该日期涨停池数据（含分时图）
      const poolData = await fetchLimitUpPoolFromApi(date);
      
      if (poolData.status_code === 0 && poolData.data?.info) {
        const client = getSupabaseClient();
        
        // 创建股票代码到分时数据的映射
        const timePreviewMap = new Map<string, number[]>();
        for (const stockInfo of poolData.data.info) {
          if (stockInfo.time_preview && stockInfo.time_preview.length > 0) {
            timePreviewMap.set(stockInfo.code, stockInfo.time_preview);
          }
        }

        // 批量更新数据库
        for (const stock of stocksWithoutPreview) {
          const timePreview = timePreviewMap.get(stock.code);
          if (timePreview) {
            await client.from("stock_limit_up")
              .update({ time_preview: timePreview })
              .eq("date", stock.date)
              .eq("block_code", stock.blockCode)
              .eq("stock_code", stock.code);
            
            // 延迟防封，每次更新后等待1-2秒
            const delay = 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    } catch (error) {
      console.error("异步更新分时图失败:", error);
    }
  })();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const startDate = searchParams.get("startDate");
  const days = Number.parseInt(searchParams.get("days") || "3", 10);

  if (!code) {
    return NextResponse.json({ error: "Missing block code" }, { status: 400 });
  }

  let currentDate = startDate || new Date().toISOString().split("T")[0];

  // 如果当前日期是节假日，往前找最近的交易日
  while (isHoliday(new Date(currentDate))) {
    currentDate = getPrevTradingDay(currentDate);
  }

  const client = getSupabaseClient();
  const result: { date: string; block: BlockData; stocks: StockData[] }[] = [];
  let loadedDays = 0;
  let totalScanned = 0;
  const maxScan = days * 3; // 最多扫描3倍天数，防止空数据日过多

  while (loadedDays < days && totalScanned < maxScan) {
    totalScanned++;
    try {
      // 先尝试从数据库获取该板块在该日期的数据
      const { data: cachedBlock } = await client
        .from("block_limit_up")
        .select("*")
        .eq("date", currentDate)
        .eq("code", code)
        .limit(1);

      if (cachedBlock && cachedBlock.length > 0) {
        // 数据库有数据
        const b = cachedBlock[0];
        const blockData: BlockData = {
          date: b.date as string,
          code: b.code as string,
          name: b.name as string,
          change: b.change as number,
          limitUpNum: b.limit_up_num as number,
          continuousPlateNum: b.continuous_plate_num as number,
          high: (b.high as string) || "",
          highNum: b.high_num as number,
          days: b.days as number,
        };

        const { data: cachedStocks } = await client
          .from("stock_limit_up")
          .select("*")
          .eq("date", currentDate)
          .eq("block_code", code);

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
          timePreview: s.time_preview as number[] | undefined,
        }));

        result.push({ date: currentDate, block: blockData, stocks });
        loadedDays++;
        currentDate = getPrevTradingDay(currentDate);
        continue;
      }

      // 数据库没有数据，从API获取
      const apiData = await fetchFromApi(currentDate);

      if (apiData.status_code === 0 && apiData.data) {
        const targetBlock = apiData.data.find((b) => b.code === code);

        if (targetBlock) {
          const block = transformBlockData(currentDate, targetBlock);

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
          }, {
            onConflict: 'date,code'
          });

          const stocks: StockData[] = [];

          if (targetBlock.stock_list) {
            for (const stock of targetBlock.stock_list) {
              const stockData = transformStockData(currentDate, targetBlock, stock);
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
                time_preview: stockData.timePreview,
              }, {
                onConflict: 'date,block_code,stock_code'
              });
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

  // 异步更新分时图（不阻塞响应）
  for (const dayResult of result) {
    await asyncUpdateTimePreview(dayResult.stocks, dayResult.date);
  }

  return NextResponse.json({
    data: result,
    hasMore,
    nextDate,
  });
}
