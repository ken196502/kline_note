import { NextResponse } from "next/server";
import {
  fetchFromApi,
  fetchAndUpsertTimePreview,
  transformBlockData,
  transformStockData,
} from "@/lib/block-api";
import { isHoliday, getPrevTradingDay, isInTradingSession } from "@/lib/trading-day";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function POST() {
  // 仅在交易时段内允许刷新
  if (!isInTradingSession()) {
    return NextResponse.json({ message: "非交易时段，无需刷新" });
  }

  // 获取当前最近的交易日
  let today = new Date().toISOString().split("T")[0];
  while (isHoliday(new Date(today))) {
    today = getPrevTradingDay(today);
  }

  const client = getSupabaseClient();

  // 从 API 重新获取当天板块数据并 upsert
  const apiData = await fetchFromApi(today);

  if (apiData.status_code !== 0 || !apiData.data) {
    return NextResponse.json(
      { error: "获取当天板块数据失败" },
      { status: 500 }
    );
  }

  for (const block of apiData.data) {
    const blockData = transformBlockData(today, block);

    // upsert 板块数据
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
        const stockData = transformStockData(today, block, stock);

        // upsert 个股数据
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
            market_type: stockData.marketType,
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

  // 获取并更新分时数据（强制刷新，因为盘中数据会变化）
  await fetchAndUpsertTimePreview(today, true);

  return NextResponse.json({
    message: "刷新成功",
    date: today,
    blockCount: apiData.data.length,
  });
}