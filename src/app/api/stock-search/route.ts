import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: Request) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const client = getSupabaseClient();

  // 从 stock_limit_up 表搜索：按代码前缀或名称模糊匹配
  const { data, error } = await client
    .from("stock_limit_up")
    .select("stock_code, stock_name")
    .or(`stock_code.ilike.${q}%,stock_name.ilike.%${q}%`)
    .order("stock_code", { ascending: true })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 去重：同一股票代码只保留一条
  const seen = new Set<string>();
  const results: { code: string; name: string }[] = [];
  for (const row of data || []) {
    if (!seen.has(row.stock_code)) {
      seen.add(row.stock_code);
      results.push({ code: row.stock_code, name: row.stock_name });
    }
  }

  return NextResponse.json({ results });
}