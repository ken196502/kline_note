import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getCurrentUser } from "@/lib/auth";
import type { CustomBlock } from "@/types/custom-block";

// 辅助函数：将数据库行转为 CustomBlock（含关联表数据）
function toCustomBlock(
  row: Record<string, unknown>,
  linkedBlocks: { code: string; name: string }[] = [],
  manualStocks: { code: string; name: string }[] = []
): CustomBlock {
  return {
    id: row.id as number,
    username: row.username as string,
    name: row.name as string,
    sortOrder: (row.sort_order as number) ?? 0,
    linkedBlocks,
    manualStocks,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// 获取当前用户的所有自定义板块
export async function GET() {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  const { data, error } = await client
    .from("custom_blocks")
    .select("*")
    .eq("username", username)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 批量获取所有关联数据
  const blockIds = (data || []).map((row) => row.id as number);

  const { data: links } = await client
    .from("custom_block_links")
    .select("custom_block_id, block_code, block_name")
    .in("custom_block_id", blockIds);

  const { data: stocks } = await client
    .from("custom_block_stocks")
    .select("custom_block_id, stock_code, stock_name")
    .in("custom_block_id", blockIds);

  // 清理无效关联：检查关联的板块是否在 stock_limit_up 中有数据
  // 如果某个关联板块在 stock_limit_up 中完全没有记录，说明本地数据库迁移后数据缺失，清理该关联
  const linkedBlockCodes = new Set(
    (links || []).map((l) => l.block_code as string)
  );
  const invalidBlockCodes: string[] = [];
  // 记录无效关联涉及的 custom_block_id，用于后续清理对应的股票
  const invalidLinkBlockIds = new Set<number>();

  if (linkedBlockCodes.size > 0) {
    // 查询 stock_limit_up 中存在这些 block_code 的记录
    const { data: validBlocks } = await client
      .from("stock_limit_up")
      .select("block_code")
      .in("block_code", Array.from(linkedBlockCodes));

    const validBlockCodeSet = new Set(
      (validBlocks || []).map((v) => v.block_code as string)
    );

    for (const code of linkedBlockCodes) {
      if (!validBlockCodeSet.has(code)) {
        invalidBlockCodes.push(code);
      }
    }

    // 删除无效关联
    if (invalidBlockCodes.length > 0) {
      // 记录受影响的 custom_block_id（在删除前记录）
      for (const l of links || []) {
        if (invalidBlockCodes.includes(l.block_code as string)) {
          invalidLinkBlockIds.add(l.custom_block_id as number);
        }
      }

      // 删除 custom_block_links 中的无效关联
      await client
        .from("custom_block_links")
        .delete()
        .in("block_code", invalidBlockCodes);

      // 清理受影响板块中由无效关联产生的股票记录
      // 只删除 stock_limit_up 中以无效板块代码为来源的股票
      for (const affectedBlockId of invalidLinkBlockIds) {
        // 获取该自定义板块当前的所有股票
        const { data: currentStocks } = await client
          .from("custom_block_stocks")
          .select("stock_code")
          .eq("custom_block_id", affectedBlockId);

        // 查找这些股票在 stock_limit_up 中属于无效板块的记录
        const currentStockCodes = (currentStocks || []).map(
          (s) => s.stock_code as string
        );

        if (currentStockCodes.length > 0) {
          const { data: invalidStocks } = await client
            .from("stock_limit_up")
            .select("stock_code")
            .in("stock_code", currentStockCodes)
            .in("block_code", invalidBlockCodes);

          // 只删除既属于无效板块来源、又不属于任何有效关联板块的股票
          const potentiallyInvalidCodes = new Set(
            (invalidStocks || []).map((s) => s.stock_code as string)
          );

          // 获取该自定义板块剩余的有效关联板块
          const { data: remainingLinks } = await client
            .from("custom_block_links")
            .select("block_code")
            .eq("custom_block_id", affectedBlockId);

          const remainingBlockCodes = (remainingLinks || []).map(
            (l) => l.block_code as string
          );

          let validStockCodesFromLinks = new Set<string>();
          if (remainingBlockCodes.length > 0) {
            const { data: validLinkStocks } = await client
              .from("stock_limit_up")
              .select("stock_code")
              .in("block_code", remainingBlockCodes);

            for (const s of validLinkStocks || []) {
              validStockCodesFromLinks.add(s.stock_code as string);
            }
          }

          // 要删除的股票：属于无效板块来源，且不属于任何有效关联板块
          const stockCodesToRemove = Array.from(potentiallyInvalidCodes).filter(
            (code) => !validStockCodesFromLinks.has(code)
          );

          if (stockCodesToRemove.length > 0) {
            await client
              .from("custom_block_stocks")
              .delete()
              .eq("custom_block_id", affectedBlockId)
              .in("stock_code", stockCodesToRemove);
          }
        }
      }
    }
  }

  // 重新获取清理后的数据
  const { data: cleanLinks } = invalidBlockCodes.length > 0
    ? await client
        .from("custom_block_links")
        .select("custom_block_id, block_code, block_name")
        .in("custom_block_id", blockIds)
    : { data: links };

  const { data: cleanStocks } = invalidLinkBlockIds.size > 0
    ? await client
        .from("custom_block_stocks")
        .select("custom_block_id, stock_code, stock_name")
        .in("custom_block_id", blockIds)
    : { data: stocks };

  // 按 custom_block_id 分组
  const linksMap = new Map<number, { code: string; name: string }[]>();
  for (const l of cleanLinks || []) {
    const id = l.custom_block_id as number;
    if (!linksMap.has(id)) linksMap.set(id, []);
    linksMap.get(id)!.push({
      code: l.block_code as string,
      name: (l.block_name as string) || "",
    });
  }

  const stocksMap = new Map<number, { code: string; name: string }[]>();
  for (const s of cleanStocks || []) {
    const id = s.custom_block_id as number;
    if (!stocksMap.has(id)) stocksMap.set(id, []);
    stocksMap.get(id)!.push({
      code: s.stock_code as string,
      name: (s.stock_name as string) || "",
    });
  }

  const customBlocks: CustomBlock[] = (data || []).map((row) =>
    toCustomBlock(
      row,
      linksMap.get(row.id as number) || [],
      stocksMap.get(row.id as number) || []
    )
  );

  return NextResponse.json({ data: customBlocks });
}

// 创建自定义板块
export async function POST(request: NextRequest) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();
  const body = await request.json();
  const name = (body.name as string)?.trim();

  if (!name) {
    return NextResponse.json({ error: "板块名称不能为空" }, { status: 400 });
  }

  const { data, error } = await client
    .from("custom_blocks")
    .insert({
      username,
      name,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "板块名称已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customBlock: CustomBlock = toCustomBlock(data);

  return NextResponse.json({ data: customBlock });
}