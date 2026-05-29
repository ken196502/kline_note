import { NextRequest, NextResponse } from "next/server";
import {
  fetchLimitUpPoolFromApi,
  fetchAndUpsertTimePreview,
} from "@/lib/block-api";
import { formatTime } from "@/lib/trading-day";
import { getRecentTradingDays } from "@/lib/trading-day";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 刷新最近 N 个交易日的市场行情数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const days = body.days ?? 2; // 默认刷新最近 2 个交易日

    const client = getSupabaseClient();
    const tradingDays = getRecentTradingDays(days); // 获取最近 N 个交易日

    const results: { date: string; status: "updated" | "skipped" | "failed"; stocks?: number }[] = [];

    for (const currentDate of tradingDays) {
      try {
        // 先检查数据库是否已有股票数据
        const { data: existingStocks, error: checkError } = await client
          .from("stock_limit_up")
          .select("id")
          .eq("date", currentDate)
          .limit(1);

        if (!checkError && existingStocks && existingStocks.length > 0) {
          // 已有数据，跳过（不强制刷新）
          results.push({ date: currentDate, status: "skipped" });
          continue;
        }

        // 没有数据，从涨停池 API 获取
        const apiData = await fetchLimitUpPoolFromApi(currentDate);

        if (apiData.status_code === 0 && apiData.data?.info) {
          const stocks = apiData.data.info;

          // 保存所有股票数据
          for (const stock of stocks) {
            // 保存股票数据 - block_code 和 block_name 暂时用 unknown/其它，后续可以通过其他方式补充
            await client.from("stock_limit_up").upsert(
              {
                date: currentDate,
                block_code: "unknown",
                block_name: "其它",
                stock_code: stock.code,
                stock_name: stock.name,
                latest: stock.latest,
                change_rate: stock.change_rate,
                continue_num: Number.parseInt(stock.high_days || "0", 10),
                high: stock.high_days || "",
                high_days: Number.parseInt(stock.high_days || "0", 10),
                first_limit_up_time: formatTime(stock.first_limit_up_time),
                last_limit_up_time: formatTime(stock.last_limit_up_time),
                reason_type: stock.reason_type || "",
                time_preview: stock.time_preview ? JSON.stringify(stock.time_preview) : null,
              },
              { onConflict: "date,block_code,stock_code" }
            );

            // 同步写入 stock_daily_price 表
            await client.from("stock_daily_price").upsert(
              {
                date: currentDate,
                stock_code: stock.code,
                stock_name: stock.name,
                price: stock.latest,
                change_rate: stock.change_rate,
              },
              { onConflict: "date,stock_code" }
            );
          }

          // 获取分时数据（不阻塞）
          fetchAndUpsertTimePreview(currentDate).catch((err) => {
            console.error(`获取 ${currentDate} 分时数据失败:`, err);
          });

          results.push({
            date: currentDate,
            status: "updated",
            stocks: stocks.length,
          });
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
