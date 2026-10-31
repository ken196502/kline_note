import { z } from "zod";

const indexSchema = z.object({
  code: z.literal(0),
  data: z.object({ sh000001: z.object({ day: z.array(z.array(z.unknown())) }) }),
});

export function indexChangeRate(rows: unknown[][], date: string): number | null {
  const candles = rows.map((row) => ({ date: String(row[0]), close: Number(row[2]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const index = candles.findIndex((candle) => candle.date === date);
  if (index < 1) return null;
  const close = candles[index].close;
  const previous = candles[index - 1].close;
  if (!Number.isFinite(close) || !Number.isFinite(previous) || close <= 0 || previous <= 0) return null;
  return Math.round((close / previous - 1) * 10000) / 100;
}

export async function loadShanghaiChangeRate(date: string): Promise<number | null> {
  // 按所选日期获取指数日线，保留前一个交易日以计算涨幅。
  const params = new URLSearchParams({ param: `sh000001,day,,${date},40,qfq` });
  const response = await fetch(`https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get?${params}`, {
    headers: { Referer: "https://gu.qq.com/", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(5000), cache: "no-store",
  });
  if (!response.ok) throw new Error("上证指数行情获取失败");
  const payload = indexSchema.parse(await response.json());
  return indexChangeRate(payload.data.sh000001.day, date);
}
