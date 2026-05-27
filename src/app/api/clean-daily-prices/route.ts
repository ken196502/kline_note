import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getRecentTradingDays } from "@/lib/trading-day";

// 清理 stock_daily_price 中被腾讯实时行情污染的数据
// 污染特征：某条记录的 (date, stock_code) 在 stock_limit_up 中没有对应记录
// stock_limit_up 同步写入的价格是真实历史数据，不应删除
// 而 fetchAndUpsertDailyPrices 写入的实时行情不是该日期的真实价格，应删除
// 行情数据是用户无关的，此接口无需登录
export async function POST() {
  const client = getSupabaseClient();
  const today = new Date().toISOString().split("T")[0];
  const recentDays = getRecentTradingDays(today, 10);

  if (recentDays.length === 0) {
    return NextResponse.json({ deleted: 0, message: "无需清理" });
  }

  // 获取 stock_daily_price 中最近10个交易日的记录
  const { data: suspectPrices } = await client
    .from("stock_daily_price")
    .select("date, stock_code")
    .in("date", recentDays);

  if (!suspectPrices || suspectPrices.length === 0) {
    return NextResponse.json({ deleted: 0, message: "无需清理" });
  }

  // 获取这些日期中在 stock_limit_up 有记录的股票代码（这些是真实历史数据）
  const { data: limitUpStocks } = await client
    .from("stock_limit_up")
    .select("date, stock_code")
    .in("date", recentDays);

  const limitUpStockSet = new Set<string>();
  for (const s of limitUpStocks || []) {
    limitUpStockSet.add(`${s.date}_${s.stock_code}`);
  }

  // 被污染的记录：在 stock_daily_price 中有记录，但在 stock_limit_up 中没有
  const pollutedRecords = (suspectPrices as { date: string; stock_code: string }[]).filter(
    (r) => !limitUpStockSet.has(`${r.date}_${r.stock_code}`)
  );

  if (pollutedRecords.length === 0) {
    return NextResponse.json({ deleted: 0, message: "无需清理" });
  }

  // 删除被污染的记录
  for (const record of pollutedRecords) {
    await client
      .from("stock_daily_price")
      .delete()
      .eq("date", record.date)
      .eq("stock_code", record.stock_code);
  }

  return NextResponse.json({
    deleted: pollutedRecords.length,
    message: `已清理 ${pollutedRecords.length} 条被污染的记录`,
  });
}