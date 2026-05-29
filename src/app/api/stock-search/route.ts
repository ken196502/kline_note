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

  // 通过 RPC 调用数据库函数，在 stock_limit_up 全表中 DISTINCT 搜索
  const { data, error } = await client
    .rpc("search_stocks", { search_query: q });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { code: string; name: string }[] = (data || []).map(
    (row: { stock_code: string; stock_name: string }) => ({
      code: row.stock_code,
      name: row.stock_name,
    })
  );

  return NextResponse.json({ results });
}