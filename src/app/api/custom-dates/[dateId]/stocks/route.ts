import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";

// 添加股票到自定义日期
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dateId: string }> }
) {
  const { dateId } = await params;
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 验证自定义日期归属
  const { data: customDate, error: dateError } = await client
    .from("custom_dates")
    .select("id, custom_block_id")
    .eq("id", Number(dateId))
    .eq("username", username)
    .single();

  if (dateError || !customDate) {
    return NextResponse.json({ error: "自定义日期不存在" }, { status: 404 });
  }

  const body = await request.json();
  const { stockCode, stockName } = body;

  if (!stockCode) {
    return NextResponse.json({ error: "缺少股票代码" }, { status: 400 });
  }

  // 获取当前最大sort_order
  const { data: existingStocks } = await client
    .from("custom_date_stocks")
    .select("sort_order")
    .eq("custom_date_id", Number(dateId))
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxOrder = existingStocks && existingStocks.length > 0
    ? (existingStocks[0].sort_order as number) + 1
    : 0;

  const { data: newStock, error: insertError } = await client
    .from("custom_date_stocks")
    .insert({
      custom_date_id: Number(dateId),
      stock_code: stockCode,
      stock_name: stockName || "",
      sort_order: maxOrder,
    })
    .select("id, custom_date_id, stock_code, stock_name, sort_order, remark")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "该股票已在此日期中" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id: newStock.id,
      customDateId: newStock.custom_date_id,
      stockCode: newStock.stock_code,
      stockName: newStock.stock_name,
      sortOrder: newStock.sort_order,
      remark: newStock.remark || "",
    },
  });
}

// 移除股票
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dateId: string }> }
) {
  const { dateId } = await params;
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const stockCode = searchParams.get("stockCode");

  if (!stockCode) {
    return NextResponse.json({ error: "Missing stockCode" }, { status: 400 });
  }

  const client = getSupabaseClient();

  // 验证自定义日期归属
  const { data: customDate } = await client
    .from("custom_dates")
    .select("id")
    .eq("id", Number(dateId))
    .eq("username", username)
    .single();

  if (!customDate) {
    return NextResponse.json({ error: "自定义日期不存在" }, { status: 404 });
  }

  const { error: deleteError } = await client
    .from("custom_date_stocks")
    .delete()
    .eq("custom_date_id", Number(dateId))
    .eq("stock_code", stockCode);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// 更新排序或备注
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ dateId: string }> }
) {
  const { dateId } = await params;
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 验证自定义日期归属
  const { data: customDate } = await client
    .from("custom_dates")
    .select("id")
    .eq("id", Number(dateId))
    .eq("username", username)
    .single();

  if (!customDate) {
    return NextResponse.json({ error: "自定义日期不存在" }, { status: 404 });
  }

  const body = await request.json();

  // 模式1：批量更新排序
  if (body.stockOrders && Array.isArray(body.stockOrders)) {
    for (const item of body.stockOrders) {
      await client
        .from("custom_date_stocks")
        .update({ sort_order: item.sortOrder })
        .eq("custom_date_id", Number(dateId))
        .eq("stock_code", item.stockCode);
    }
    return NextResponse.json({ success: true });
  }

  // 模式2：更新单条股票备注
  if (body.stockCode && body.remark !== undefined) {
    const { error } = await client
      .from("custom_date_stocks")
      .update({ remark: body.remark })
      .eq("custom_date_id", Number(dateId))
      .eq("stock_code", body.stockCode);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
}