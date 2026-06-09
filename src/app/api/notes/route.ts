import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const stockCode = searchParams.get("stock_code");
  const stockCodes = searchParams.get("stock_codes"); // 支持批量查询: 逗号分隔的股票代码列表

  const client = getSupabaseClient();

  let query = client
    .from("stock_notes")
    .select("id, username, stock_code, content, created_at, updated_at")
    .eq("username", username)
    .order("updated_at", { ascending: false });

  // 批量查询：多个股票代码
  if (stockCodes) {
    const codeList = stockCodes.split(",").map((c) => c.trim()).filter(Boolean);
    if (codeList.length > 0) {
      query = query.in("stock_code", codeList);
    }
  } else if (stockCode) {
    // 单个查询
    query = query.eq("stock_code", stockCode);
  }

  const { data, error } = await query.limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { stock_code, content } = body as {
    stock_code: string;
    content: string;
  };

  if (!stock_code) {
    return NextResponse.json(
      { error: "股票代码不能为空" },
      { status: 400 }
    );
  }

  const client = getSupabaseClient();

  // 使用 upsert 实现保存或更新（按 username + stock_code 唯一）
  const { data, error } = await client
    .from("stock_notes")
    .upsert(
      {
        username,
        stock_code,
        content: content || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "username,stock_code" }
    )
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}