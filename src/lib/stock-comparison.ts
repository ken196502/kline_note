export interface ComparisonCandle {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

export interface CandleSeries {
  code: string;
  candles: ComparisonCandle[];
}

export function toPercent(price: number, base: number): number {
  return (price / base - 1) * 100;
}

/** 所有股票使用同一个起始交易日，各自以该日收盘价为 0%。缺失日期留空。 */
export function normalizeComparisonCandles(series: CandleSeries[]): {
  baseDate: string | null;
  dates: string[];
  series: CandleSeries[];
} {
  const valid = series.map((item) => ({
    ...item,
    candles: item.candles.filter((candle) =>
      [candle.open, candle.close, candle.high, candle.low].every((price) => Number.isFinite(price) && price > 0)
    ).sort((a, b) => a.date.localeCompare(b.date)),
  }));
  if (valid.length === 0 || valid.some((item) => item.candles.length === 0)) {
    return { baseDate: null, dates: [], series: [] };
  }
  const dateSets = valid.map((item) => new Set(item.candles.map((candle) => candle.date)));
  const baseDate = valid[0].candles.find((candle) => dateSets.every((dates) => dates.has(candle.date)))?.date ?? null;
  if (!baseDate) return { baseDate: null, dates: [], series: [] };
  const normalized = valid.map((item) => {
    const base = item.candles.find((candle) => candle.date === baseDate)!.close;
    return {
      code: item.code,
      candles: item.candles.filter((candle) => candle.date >= baseDate).map((candle) => ({
        date: candle.date,
        open: toPercent(candle.open, base),
        close: toPercent(candle.close, base),
        high: toPercent(candle.high, base),
        low: toPercent(candle.low, base),
      })),
    };
  });
  const dates = [...new Set(normalized.flatMap((item) => item.candles.map((candle) => candle.date)))].sort();
  return { baseDate, dates, series: normalized };
}

export function normalizeComparisonMinutes(prices: (number | null)[], prevClose: number): (number | null)[] {
  return prices.map((price) => price !== null && Number.isFinite(price) && price > 0 && Number.isFinite(prevClose) && prevClose > 0
    ? toPercent(price, prevClose) : null);
}

/** 主股票红涨绿跌；背景股票使用蓝灰色，阳线空心、阴线实心。 */
export function comparisonCandleStyle(primary: boolean, up: boolean): { stroke: string; fill: string } {
  const stroke = primary ? up ? "#E94040" : "#2DC08E" : "#7890a8";
  return { stroke, fill: !primary && up ? "none" : stroke };
}
