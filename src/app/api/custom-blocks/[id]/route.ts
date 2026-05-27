import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";
import { getRecentTradingDays } from "@/lib/trading-day";
import type { CustomBlock } from "@/types/custom-block";

// 辅助函数：获取板块的完整关联数据并组装 CustomBlock
async function loadCustomBlock(
  client: ReturnType<typeof getSupabaseClient>,
  blockId: number
): Promise<CustomBlock | null> {
  const { data: row, error } = await client
    .from("custom_blocks")
    .select("*")
    .eq("id", blockId)
    .single();

  if (error || !row) return null;

  const { data: links } = await client
    .from("custom_block_links")
    .select("block_code, block_name")
    .eq("custom_block_id", blockId);

  const { data: stocks } = await client
    .from("custom_block_stocks")
    .select("stock_code, stock_name")
    .eq("custom_block_id", blockId);

  return {
    id: row.id as number,
    username: row.username as string,
    name: row.name as string,
    linkedBlocks: (links || []).map((l) => ({
      code: l.block_code as string,
      name: (l.block_name as string) || "",
    })),
    manualStocks: (stocks || []).map((s) => ({
      code: s.stock_code as string,
      name: (s.stock_name as string) || "",
    })),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// 获取单个自定义板块详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 先验证归属
  const { data: row } = await client
    .from("custom_blocks")
    .select("id")
    .eq("id", Number(id))
    .eq("username", username)
    .single();

  if (!row) {
    return NextResponse.json({ error: "板块不存在" }, { status: 404 });
  }

  const customBlock = await loadCustomBlock(client, Number(id));
  if (!customBlock) {
    return NextResponse.json({ error: "板块不存在" }, { status: 404 });
  }

  return NextResponse.json({ data: customBlock });
}

// 更新自定义板块
// 支持四种操作：
// 1. 普通更新：{ name } - 更新板块名称
// 2. 关联板块：{ action: "linkBlock", blockCode, blockName } - 关联一个板块，并自动添加该板块最新一天的股票
// 3. 取消关联板块：{ action: "unlinkBlock", blockCode } - 取消关联板块，并移除该板块对应的股票
// 4. 添加股票：{ action: "addStock", stockCode, stockName } - 手动添加一只股票
// 5. 移除股票：{ action: "removeStock", stockCode } - 手动移除一只股票
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();
  const blockId = Number(id);
  const body = await request.json();

  // 验证归属
  const { data: current } = await client
    .from("custom_blocks")
    .select("id")
    .eq("id", blockId)
    .eq("username", username)
    .single();

  if (!current) {
    return NextResponse.json({ error: "板块不存在" }, { status: 404 });
  }

  const action = body.action as string;

  if (action === "linkBlock") {
    // 关联板块：在 custom_block_links 中插入，并把该板块最新一天的股票加进 custom_block_stocks
    const blockCode = body.blockCode as string;
    const blockName = (body.blockName as string) || "";
    if (!blockCode) {
      return NextResponse.json({ error: "缺少 blockCode" }, { status: 400 });
    }

    // 插入关联（upsert，忽略重复）
    await client
      .from("custom_block_links")
      .upsert(
        { custom_block_id: blockId, block_code: blockCode, block_name: blockName },
        { onConflict: "custom_block_id,block_code" }
      );

    // 找到该板块最新有数据的交易日，获取该板块的股票
    const today = new Date().toISOString().split("T")[0];
    const recentDays = getRecentTradingDays(today, 10);
    let latestDate: string | null = null;
    for (const date of recentDays) {
      const { count } = await client
        .from("stock_limit_up")
        .select("*", { count: "exact", head: true })
        .eq("date", date)
        .eq("block_code", blockCode);
      if (count && count > 0) {
        latestDate = date;
        break;
      }
    }

    if (latestDate) {
      // 获取该板块最新一天的股票代码和名称
      const { data: blockStocks } = await client
        .from("stock_limit_up")
        .select("stock_code, stock_name")
        .eq("date", latestDate)
        .eq("block_code", blockCode);

      // 批量 upsert 进 custom_block_stocks
      if (blockStocks && blockStocks.length > 0) {
        const rows = blockStocks.map((s) => ({
          custom_block_id: blockId,
          stock_code: s.stock_code as string,
          stock_name: (s.stock_name as string) || "",
        }));
        await client
          .from("custom_block_stocks")
          .upsert(rows, { onConflict: "custom_block_id,stock_code" });
      }
    }
  } else if (action === "unlinkBlock") {
    // 取消关联板块：从 custom_block_links 删除，并移除该板块对应的股票
    const blockCode = body.blockCode as string;
    if (!blockCode) {
      return NextResponse.json({ error: "缺少 blockCode" }, { status: 400 });
    }

    // 删除关联
    await client
      .from("custom_block_links")
      .delete()
      .eq("custom_block_id", blockId)
      .eq("block_code", blockCode);

    // 找到该板块最新有数据的交易日，获取该板块的股票代码，然后从 custom_block_stocks 删除
    const today = new Date().toISOString().split("T")[0];
    const recentDays = getRecentTradingDays(today, 10);
    let latestDate: string | null = null;
    for (const date of recentDays) {
      const { count } = await client
        .from("stock_limit_up")
        .select("*", { count: "exact", head: true })
        .eq("date", date)
        .eq("block_code", blockCode);
      if (count && count > 0) {
        latestDate = date;
        break;
      }
    }

    if (latestDate) {
      const { data: blockStocks } = await client
        .from("stock_limit_up")
        .select("stock_code")
        .eq("date", latestDate)
        .eq("block_code", blockCode);

      if (blockStocks && blockStocks.length > 0) {
        const codes = blockStocks.map((s) => s.stock_code as string);
        await client
          .from("custom_block_stocks")
          .delete()
          .eq("custom_block_id", blockId)
          .in("stock_code", codes);
      }
    }
  } else if (action === "addStock") {
    // 手动添加股票
    const stockCode = body.stockCode as string;
    const stockName = (body.stockName as string) || "";
    if (!stockCode) {
      return NextResponse.json({ error: "缺少 stockCode" }, { status: 400 });
    }

    await client
      .from("custom_block_stocks")
      .upsert(
        { custom_block_id: blockId, stock_code: stockCode, stock_name: stockName },
        { onConflict: "custom_block_id,stock_code" }
      );
  } else if (action === "removeStock") {
    // 手动移除股票
    const stockCode = body.stockCode as string;
    if (!stockCode) {
      return NextResponse.json({ error: "缺少 stockCode" }, { status: 400 });
    }

    await client
      .from("custom_block_stocks")
      .delete()
      .eq("custom_block_id", blockId)
      .eq("stock_code", stockCode);
  } else {
    // 普通更新：只更新名称
    const newName = (body.name as string)?.trim();
    if (newName) {
      const { error } = await client
        .from("custom_blocks")
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq("id", blockId)
        .eq("username", username);

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ error: "板块名称已存在" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // 返回更新后的完整数据
  const customBlock = await loadCustomBlock(client, blockId);
  if (!customBlock) {
    return NextResponse.json({ error: "板块不存在" }, { status: 404 });
  }

  return NextResponse.json({ data: customBlock });
}

// 删除自定义板块
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 关联表有 ON DELETE CASCADE，只需删主表
  const { error } = await client
    .from("custom_blocks")
    .delete()
    .eq("id", Number(id))
    .eq("username", username);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}