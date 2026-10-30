import type { RotationBlock, RotationStock } from "@/types/rotation";

export function rankRotationStocks(stocks: RotationStock[]): RotationStock[] {
  const unique = new Map<string, RotationStock>();
  for (const stock of stocks) {
    const previous = unique.get(stock.code);
    if (!previous || (stock.continueNum ?? -1) > (previous.continueNum ?? -1)) {
      unique.set(stock.code, stock);
    }
  }
  return [...unique.values()].sort((a, b) =>
    (b.continueNum ?? -1) - (a.continueNum ?? -1) || a.code.localeCompare(b.code)
  );
}

export function rankRotationBlocks(blocks: RotationBlock[]): RotationBlock[] {
  return blocks.map((block) => ({ ...block, stocks: rankRotationStocks(block.stocks) }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export function chinaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function shiftRotationDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
