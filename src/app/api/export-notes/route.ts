import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getSupabaseClient();

  // 获取当前用户所有非空备注
  const { data: notes, error: notesError } = await client
    .from("stock_notes")
    .select("id, username, stock_code, content, updated_at")
    .eq("username", username)
    .not("content", "is", null)
    .not("content", "eq", "")
    .order("updated_at", { ascending: false });

  if (notesError) {
    return NextResponse.json(
      { error: "获取备注失败" },
      { status: 500 }
    );
  }

  if (!notes || notes.length === 0) {
    // 没有备注时返回空CSV
    const csvContent = "股票代码,备注,更新时间\n";
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="stock-notes-${new Date()
          .toISOString()
          .split("T")[0]}.csv"`,
      },
    });
  }

  // 获取相关股票名称
  const stockCodes = notes.map((n: any) => n.stock_code);

  const { data: stockInfo } = await client
    .from("stock_limit_up")
    .select("stock_code, stock_name")
    .in("stock_code", stockCodes);

  // 构建股票名称Map（取最新的一条）
  const stockNameMap = new Map<string, string>();
  if (stockInfo) {
    for (const s of stockInfo as any[]) {
      if (!stockNameMap.has(s.stock_code)) {
        stockNameMap.set(s.stock_code, s.stock_name);
      }
    }
  }

  // 构建CSV内容
  const csvLines: string[] = ["股票代码,股票名称,备注,更新时间"];

  notes.forEach((note: any) => {
    const row = [
      note.stock_code,
      stockNameMap.get(note.stock_code) || "",
      csvEscape(note.content || ""),
      note.updated_at ? new Date(note.updated_at).toLocaleString("zh-CN") : "",
    ];

    csvLines.push(row.join(","));
  });

  const csvContent = csvLines.join("\n") + "\n";

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-notes-${new Date()
        .toISOString()
        .split("T")[0]}.csv"`,
    },
  });
}

function csvEscape(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return '"' + cell.replace(/"/g, '""') + '"';
  }
  return cell;
}