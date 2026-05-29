import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";

// 获取某个自定义板块下的所有自定义日期
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const blockId = searchParams.get("blockId");

  if (!blockId) {
    return NextResponse.json({ error: "Missing blockId" }, { status: 400 });
  }

  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 查询自定义日期，附带日期内的股票
  const { data: dates, error } = await client
    .from("custom_dates")
    .select("id, username, date, custom_block_id, created_at, updated_at")
    .eq("username", username)
    .eq("custom_block_id", Number(blockId))
    .order("date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 获取每个日期内的股票
  const dateIds = (dates || []).map((d: any) => d.id);
  let stocksByDateId: Record<number, any[]> = {};

  if (dateIds.length > 0) {
    const { data: stocks } = await client
      .from("custom_date_stocks")
      .select("id, custom_date_id, stock_code, stock_name, sort_order, remark, stock_name_color")
      .in("custom_date_id", dateIds)
      .order("sort_order", { ascending: true });

    for (const s of stocks || []) {
      const dateId = s.custom_date_id as number;
      if (!stocksByDateId[dateId]) stocksByDateId[dateId] = [];
      stocksByDateId[dateId].push({
        id: s.id,
        customDateId: s.custom_date_id,
        stockCode: s.stock_code,
        stockName: s.stock_name,
        sortOrder: s.sort_order,
        remark: s.remark || "",
        stockNameColor: (s.stock_name_color as string) || "",
      });
    }
  }

  const result = (dates || []).map((d: any) => ({
    id: d.id,
    username: d.username,
    date: d.date,
    customBlockId: d.custom_block_id,
    stocks: stocksByDateId[d.id] || [],
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));

  return NextResponse.json({ data: result });
}

// 创建自定义日期
export async function POST(request: NextRequest) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { date, customBlockId } = body;

  if (!date || !customBlockId) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const client = getSupabaseClient();

  // 验证板块归属
  const { data: block, error: blockError } = await client
    .from("custom_blocks")
    .select("id")
    .eq("id", Number(customBlockId))
    .eq("username", username)
    .single();

  if (blockError || !block) {
    return NextResponse.json({ error: "自定义板块不存在" }, { status: 404 });
  }

  // 插入自定义日期
  const { data: newDate, error: insertError } = await client
    .from("custom_dates")
    .insert({
      username,
      date,
      custom_block_id: Number(customBlockId),
    })
    .select("id, username, date, custom_block_id, created_at, updated_at")
    .single();

  if (insertError) {
    // 唯一约束冲突
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "该日期已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id: newDate.id,
      username: newDate.username,
      date: newDate.date,
      customBlockId: newDate.custom_block_id,
      stocks: [],
      createdAt: newDate.created_at,
      updatedAt: newDate.updated_at,
    },
  });
}

// 删除自定义日期
export async function DELETE(request: NextRequest) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const dateId = searchParams.get("dateId");

  if (!dateId) {
    return NextResponse.json({ error: "Missing dateId" }, { status: 400 });
  }

  const client = getSupabaseClient();

  // 验证归属
  const { data: existing, error: findError } = await client
    .from("custom_dates")
    .select("id")
    .eq("id", Number(dateId))
    .eq("username", username)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "自定义日期不存在" }, { status: 404 });
  }

  const { error: deleteError } = await client
    .from("custom_dates")
    .delete()
    .eq("id", Number(dateId));

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}