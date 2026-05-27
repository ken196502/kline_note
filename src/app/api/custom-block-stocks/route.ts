import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";
import type { CustomBlockStock } from "@/types/custom-block";
import { getRecentTradingDays } from "@/lib/trading-day";

// 获取自定义板块的股票数据（最新一天的）
// 只从 stock_daily_price 和 stock_limit_up 获取真实历史价格
// 不使用腾讯实时行情补充，避免显示错误价格
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const blockId = searchParams.get("blockId");

  if (!blockId) {
    return NextResponse.json(
      { error: "Missing blockId" },
      { status: 400 }
    );
  }

  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 获取自定义板块配置（验证归属）
  const { data: customBlock, error: blockError } = await client
    .from("custom_blocks")
    .select("id")
    .eq("id", Number(blockId))
    .eq("username", username)
    .single();

  if (blockError || !customBlock) {
    return NextResponse.json(
      { error: "自定义板块不存在" },
      { status: 404 }
    );
  }

  // 从关联表获取所有股票代码和名称
  const { data: manualStocks } = await client
    .from("custom_block_stocks")
    .select("stock_code, stock_name")
    .eq("custom_block_id", Number(blockId));

  const stockEntries: { code: string; name: string }[] = (manualStocks || []).map(
    (s) => ({
      code: s.stock_code as string,
      name: (s.stock_name as string) || "",
    })
  );

  const stockCodes = stockEntries.map((s) => s.code);
  // 构建 code -> name 映射（来自用户手动保存的名称）
  const nameMap = new Map<string, string>();
  for (const entry of stockEntries) {
    nameMap.set(entry.code, entry.name);
  }

  if (stockCodes.length === 0) {
    return NextResponse.json({ data: [], date: null });
  }

  // 找到最新有数据的交易日
  let latestDate: string | null = null;
  const today = new Date().toISOString().split("T")[0];
  const recentDays = getRecentTradingDays(today, 10);

  for (const date of recentDays) {
    const { count } = await client
      .from("stock_limit_up")
      .select("*", { count: "exact", head: true })
      .eq("date", date);

    if (count && count > 0) {
      latestDate = date;
      break;
    }
  }

  // 如果没有涨停池数据，使用今天日期作为最新日期
  if (!latestDate) {
    latestDate = today;
  }

  // === 第一步：从 stock_daily_price 获取当天价格和涨跌幅 ===
  const { data: dailyPrices } = await client
    .from("stock_daily_price")
    .select("stock_code, stock_name, price, change_rate")
    .eq("date", latestDate)
    .in("stock_code", stockCodes);

  const dailyPriceMap = new Map<string, { price: number; changeRate: number; name: string }>();
  for (const dp of dailyPrices || []) {
    dailyPriceMap.set(dp.stock_code as string, {
      price: dp.price as number,
      changeRate: dp.change_rate as number,
      name: (dp.stock_name as string) || "",
    });
  }

  // === 第二步：从 stock_limit_up 获取分时缩略图和来源板块信息 ===
  const { data: dbStocks } = await client
    .from("stock_limit_up")
    .select("stock_code, stock_name, latest, change_rate, block_code, block_name, time_preview, market_type")
    .eq("date", latestDate)
    .in("stock_code", stockCodes);

  // 构建分时缩略图映射
  const timePreviewMap = new Map<string, number[]>();
  const blockSourceMap = new Map<string, { blockCode: string; blockName: string; marketType: string }>();
  const seenCodes = new Set<string>();

  for (const s of dbStocks || []) {
    const code = s.stock_code as string;
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);

    if (s.time_preview) {
      timePreviewMap.set(code, typeof s.time_preview === 'string'
        ? JSON.parse(s.time_preview) as number[]
        : []);
    }

    blockSourceMap.set(code, {
      blockCode: s.block_code as string,
      blockName: s.block_name as string,
      marketType: (s.market_type as string) || "",
    });
  }

  // === 第三步：组装返回数据 ===
  const stocks: CustomBlockStock[] = [];

  for (const entry of stockEntries) {
    const { code, name } = entry;
    const dailyPrice = dailyPriceMap.get(code);
    const blockSource = blockSourceMap.get(code);

    const hasPrice = dailyPrice?.price != null || (blockSource != null);

    stocks.push({
      code,
      // 优先使用用户保存的名称，其次用数据库中的名称
      name: nameMap.get(code) || dailyPrice?.name || name || code,
      // 优先使用 stock_daily_price 的价格和涨跌幅，其次用 stock_limit_up 的
      latest: dailyPrice?.price ?? (blockSource ? (dbStocks?.find(s => s.stock_code === code)?.latest as number) ?? 0 : 0),
      changeRate: dailyPrice?.changeRate ?? (blockSource ? (dbStocks?.find(s => s.stock_code === code)?.change_rate as number) ?? 0 : 0),
      date: latestDate,
      timePreview: timePreviewMap.get(code),
      marketType: blockSource?.marketType || (code.startsWith("6") ? "SH" : "SZ"),
      source: blockSource ? "limitUp" : "nonLimitUp",
      sourceBlockCode: blockSource?.blockCode,
      sourceBlockName: blockSource?.blockName,
      hasPrice,
    });
  }

  return NextResponse.json({ data: stocks, date: latestDate });
}