import { NextRequest, NextResponse } from "next/server";
import {
  fetchFromApi,
  fetchLimitUpPoolFromApi,
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

    const results: { date: string; status: "updated" | "skipped" | "failed"; blocks?: number; stocks?: number }[] = [];

    for (const currentDate of tradingDays) {
      try {
        // 第一步：检查板块数据是否存在
        const { data: existingBlocks, error: checkBlockError } = await client
          .from("block_limit_up")
          .select("code, name")
          .eq("date", currentDate);

        // 第二步：板块数据不存在的话，先获取板块数据
        let blocksToUse: Array<{ code: string; name: string }> = [];
        if (checkBlockError || !existingBlocks || existingBlocks.length === 0) {
          // 获取板块数据
          const blockApiData = await fetchFromApi(currentDate);

          if (blockApiData.status_code === 0 && blockApiData.data) {
            blocksToUse = blockApiData.data.map((b) => ({
              code: b.code,
              name: b.name,
            }));

            // 保存板块数据
            for (const block of blockApiData.data) {
              const transformed = transformBlockData(currentDate, block);
              await client.from("block_limit_up").upsert(transformed, {
                onConflict: "date,code",
              });
            }
          }
        } else {
          blocksToUse = existingBlocks;
        }

        // 第三步：获取涨停池数据
        const poolData = await fetchLimitUpPoolFromApi(currentDate);

        if (poolData.status_code === 0 && poolData.data?.info) {
          const stocks = poolData.data.info;

          // 保存所有股票数据（使用板块数据关联）
          let savedStocks = 0;

          for (const stock of stocks) {
            // 默认 unknown 板块
            let blockCode = "unknown";
            let blockName = "其它";

            // 如果有 reason_type（板块标识），尝试匹配板块
            if (stock.reason_type) {
              // 先找完全匹配的板块名称
              const matchedBlock = blocksToUse.find(
                (b) => b.name === stock.reason_type
              );
              if (matchedBlock) {
                blockCode = matchedBlock.code;
                blockName = matchedBlock.name;
              } else if (blocksToUse.length > 0) {
                // 没有匹配到的话，随便用一个板块
                blockCode = blocksToUse[0].code;
                blockName = blocksToUse[0].name;
              }
            } else if (blocksToUse.length > 0) {
              // 没有 reason_type 的话，随便用一个板块
              blockCode = blocksToUse[0].code;
              blockName = blocksToUse[0].name;
            }

            // 保存股票数据
            const transformed = transformStockData(
              currentDate,
              blockCode,
              blockName,
              stock
            );
            await client.from("stock_limit_up").upsert(transformed, {
              onConflict: "date,block_code,stock_code",
            });

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

            savedStocks++;
          }

          // 获取分时数据（不阻塞）
          fetchAndUpsertTimePreview(currentDate).catch((err) => {
            console.error(`获取 ${currentDate} 分时数据失败:`, err);
          });

          results.push({
            date: currentDate,
            status: "updated",
            blocks: blocksToUse.length,
            stocks: savedStocks,
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
