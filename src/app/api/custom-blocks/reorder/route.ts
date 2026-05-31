import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";

// 批量更新自定义板块排序
// body: { orders: [{ id: number, sortOrder: number }, ...] }
export async function PUT(request: NextRequest) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();
  const body = await request.json();
  const orders = body.orders as { id: number; sortOrder: number }[] | undefined;

  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: "缺少排序数据" }, { status: 400 });
  }

  // 验证所有板块都属于当前用户
  const blockIds = orders.map((o) => o.id);
  const { data: blocks } = await client
    .from("custom_blocks")
    .select("id")
    .eq("username", username)
    .in("id", blockIds);

  const validIds = new Set((blocks || []).map((b) => b.id as number));
  for (const item of orders) {
    if (!validIds.has(item.id)) {
      return NextResponse.json({ error: `板块 ${item.id} 不存在或不属于当前用户` }, { status: 403 });
    }
  }

  // 逐个更新排序字段
  for (const item of orders) {
    const { error } = await client
      .from("custom_blocks")
      .update({ sort_order: item.sortOrder, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("username", username);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}