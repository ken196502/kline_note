import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { groupRotationStocks, loadCustomMemberships, loadRotationDay } from "@/lib/rotation-data";
import { chinaDate, shiftRotationDate } from "@/lib/rotation";
import type { RotationDay, RotationResponse } from "@/types/rotation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const username = await getCurrentUser();
  if (!username) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const today = chinaDate();
  const startDate = request.nextUrl.searchParams.get("startDate") || today;
  const count = Number(request.nextUrl.searchParams.get("days") || "5");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(`${startDate}T00:00:00Z`)) ||
    new Date(`${startDate}T00:00:00Z`).toISOString().slice(0, 10) !== startDate ||
    startDate > today || !Number.isInteger(count) || count < 1 || count > 10) {
    return NextResponse.json({ error: "日期或天数无效" }, { status: 400 });
  }
  const data: RotationDay[] = [];
  const warnings = new Set<string>();
  let date = startDate;
  // 有限扫描，跳过周末和无行情的休市日期，防止上游无数据时无限请求。
  try {
    const memberships = await loadCustomMemberships(username);
    for (let scanned = 0; scanned < 20 && data.length < count; scanned++) {
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (weekday !== 0 && weekday !== 6) {
        const result = await loadRotationDay(date, today);
        result.warnings.forEach((warning) => warnings.add(warning));
        if (result.day.up.length > 0 || result.day.down.length > 0) data.push({
          ...result.day,
          up: groupRotationStocks(result.day.up.flatMap((block) => block.stocks), memberships),
          down: groupRotationStocks(result.day.down.flatMap((block) => block.stocks), memberships),
        });
      }
      date = shiftRotationDate(date, -1);
    }
    const hasMore = data.length === count;
    const result: RotationResponse = { data, warnings: [...warnings], hasMore, nextDate: hasMore ? date : null };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "轮动行情获取失败" }, { status: 502 });
  }
}
