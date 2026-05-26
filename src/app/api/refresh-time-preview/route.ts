import { NextRequest, NextResponse } from "next/server";
import { fetchAndUpsertTimePreview } from "@/lib/block-api";
import { isHoliday, getPrevTradingDay } from "@/lib/trading-day";

export async function POST(request: NextRequest) {
  const body = await request.json();
  let date = body.date as string | undefined;

  if (!date) {
    return NextResponse.json({ error: "缺少日期参数" }, { status: 400 });
  }

  while (isHoliday(new Date(date))) {
    date = getPrevTradingDay(date);
  }

  try {
    await fetchAndUpsertTimePreview(date, true);
    return NextResponse.json({ message: "分时数据刷新成功", date });
  } catch (error) {
    console.error(`刷新 ${date} 分时数据失败:`, error);
    return NextResponse.json({ error: "刷新分时数据失败" }, { status: 500 });
  }
}