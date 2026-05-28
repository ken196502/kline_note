import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";

// 腾讯接口返回 GBK 编码，需要用 GBK 解码
async function fetchStockName(code: string): Promise<string | null> {
  const prefix = code.startsWith("6") ? "sh" : "sz";
  const url = `https://qt.gtimg.cn/q=${prefix}${code}`;

  const response = await fetch(url, {
    headers: {
      Referer: "https://gu.qq.com/",
      "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) return null;

  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("gbk");
  const text = decoder.decode(buffer);

  const eqIndex = text.indexOf("=");
  if (eqIndex === -1) return null;

  const content = text.substring(eqIndex + 1).replace(/^"|"$/g, "");
  if (!content) return null;

  const fields = content.split("~");
  return fields[1] || null;
}

export async function POST() {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 获取当前用户所有自定义板块的股票
  const { data: stocks, error } = await client
    .from("custom_block_stocks")
    .select("id, stock_code, stock_name")
    .not("stock_code", "is", null);

  if (error || !stocks || stocks.length === 0) {
    return NextResponse.json({ fixed: 0 });
  }

  let fixed = 0;
  const updates: { id: number; stock_code: string; stock_name: string }[] = [];

  for (const stock of stocks) {
    const correctName = await fetchStockName(stock.stock_code as string);
    if (correctName && correctName !== stock.stock_name) {
      updates.push({ id: stock.id, stock_code: stock.stock_code as string, stock_name: correctName });
    }
  }

  // 批量更新
  for (const update of updates) {
    await client
      .from("custom_block_stocks")
      .update({ stock_name: update.stock_name })
      .eq("id", update.id);
    fixed++;
  }

  return NextResponse.json({ fixed });
}