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
  const stockDate = searchParams.get("stock_date");
  const stockCodes = searchParams.get("stock_codes"); // 支持批量查询: 逗号分隔的股票代码列表

  const client = getSupabaseClient();

  let query = client
    .from("stock_notes")
    .select("id, username, stock_code, stock_date, content, created_at, updated_at")
    .eq("username", username)
    .order("updated_at", { ascending: false });

  // 批量查询：按日期 + 多个股票代码
  if (stockDate && stockCodes) {
    const codeList = stockCodes.split(",").map((c) => c.trim()).filter(Boolean);
    if (codeList.length > 0) {
      query = query.eq("stock_date", stockDate).in("stock_code", codeList);
    }
  } else {
    // 单个查询
    if (stockCode) {
      query = query.eq("stock_code", stockCode);
    }
    if (stockDate) {
      query = query.eq("stock_date", stockDate);
    }
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
  const { stock_code, stock_date, content } = body as {
    stock_code: string;
    stock_date: string;
    content: string;
  };

  if (!stock_code || !stock_date) {
    return NextResponse.json(
      { error: "股票代码和日期不能为空" },
      { status: 400 }
    );
  }

  const client = getSupabaseClient();

  // 使用 upsert 实现保存或更新
  const { data, error } = await client
    .from("stock_notes")
    .upsert(
      {
        username,
        stock_code,
        stock_date,
        content: content || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "username,stock_code,stock_date" }
    )
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
