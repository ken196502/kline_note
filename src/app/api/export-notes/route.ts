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
    .select("id, username, stock_code, stock_date, content")
    .eq("username", username)
    .not("content", "is", null)
    .not("content", "eq", "")
    .order("stock_date", { ascending: false });

  if (notesError) {
    return NextResponse.json(
      { error: "获取备注失败" },
      { status: 500 }
    );
  }

  if (!notes || notes.length === 0) {
    // 没有备注时返回空CSV
    const csvContent = "日期,板块,板块代码,股票,股票代码,备注\n";
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

  // 获取所有相关的股票和板块信息
  const noteKeys = notes.map(
    (n: any) => `${n.stock_code}-${n.stock_date}`
  );

  // 从 stock_limit_up 获取股票和板块信息
  const { data: stocks, error: stocksError } = await client
    .from("stock_limit_up")
    .select("stock_code, date, stock_name, block_code, block_name")
    .in("stock_code", notes.map((n: any) => n.stock_code))
    .in("date", notes.map((n: any) => n.stock_date));

  if (stocksError) {
    return NextResponse.json(
      { error: "获取股票数据失败" },
      { status: 500 }
    );
  }

  // 构建股票信息Map
  const stockMap = new Map<string, any>();
  if (stocks) {
    stocks.forEach((s: any) => {
      const key = `${s.stock_code}-${s.date}`;
      stockMap.set(key, s);
    });
  }

  // 构建CSV内容
  const csvLines: string[] = ["日期,板块,板块代码,股票,股票代码,备注"];

  notes.forEach((note: any) => {
    const key = `${note.stock_code}-${note.stock_date}`;
    const stockInfo = stockMap.get(key);

    const row = [
      note.stock_date,
      stockInfo?.block_name || "",
      stockInfo?.block_code || "",
      stockInfo?.stock_name || "",
      note.stock_code,
      csvEscape(note.content || ""),
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
