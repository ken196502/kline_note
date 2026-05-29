import { NextRequest, NextResponse } from "next/server";
import {
  fetchFromApi,
  fetchAndUpsertTimePreview,
  transformBlockData,
  transformStockData,
} from "@/lib/block-api";
import { getRecentTradingDays } from "@/lib/trading-day";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 刷新最近 N 个交易日的市场行情数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const days = body.days ?? 2; // 默认刷新最近 2 个交易日

    const client = getSupabaseClient();
    const tradingDays = getRecentTradingDays(days); // 获取最近 N 个交易日

    const results: { date: string; status: "updated" | "skipped" | "failed" }[] = [];

    for (const currentDate of tradingDays) {
      try {
        // 先检查数据库是否已有数据
        const { data: existingBlocks, error: checkError } = await client
          .from("block_limit_up")
          .select("id")
          .eq("date", currentDate)
          .limit(1);

        if (!checkError && existingBlocks && existingBlocks.length > 0) {
          // 已有数据，跳过（不强制刷新）
          results.push({ date: currentDate, status: "skipped" });
          continue;
        }

        // 没有数据，从 API 获取
        const apiData = await fetchFromApi(currentDate);

        if (apiData.status_code === 0 && apiData.data) {
          for (const block of apiData.data) {
            const blockData = transformBlockData(currentDate, block);

            // 存入数据库
            await client.from("block_limit_up").upsert(
              {
                date: blockData.date,
                code: blockData.code,
                name: blockData.name,
                change: blockData.change,
                limit_up_num: blockData.limitUpNum,
                continuous_plate_num: blockData.continuousPlateNum,
                high: blockData.high,
                high_num: blockData.highNum,
                days: blockData.days,
              },
              { onConflict: "date,code" }
            );

            if (block.stock_list) {
              for (const stock of block.stock_list) {
                const stockData = transformStockData(currentDate, block, stock);

                // 存入数据库
                await client.from("stock_limit_up").upsert(
                  {
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
                    time_preview: stockData.timePreview ? JSON.stringify(stockData.timePreview) : null,
                  },
                  { onConflict: "date,block_code,stock_code" }
                );

                // 同步写入 stock_daily_price 表
                await client.from("stock_daily_price").upsert(
                  {
                    date: stockData.date,
                    stock_code: stockData.code,
                    stock_name: stockData.name,
                    price: stockData.latest,
                    change_rate: stockData.changeRate,
                  },
                  { onConflict: "date,stock_code" }
                );
              }
            }
          }

          // 获取分时数据（不阻塞）
          fetchAndUpsertTimePreview(currentDate).catch((err) => {
            console.error(`获取 ${currentDate} 分时数据失败:`, err);
          });

          results.push({ date: currentDate, status: "updated" });
        } else {
          results.push({ date: currentDate, status: "failed" });
        }
      } catch (dateError) {
        console.error(`处理 ${currentDate} 失败:`, dateError);
        results.push({ date: currentDate, status: "failed" });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("刷新市场行情失败:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
