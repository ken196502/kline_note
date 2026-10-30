import assert from "node:assert/strict";
import { test } from "node:test";
import { comparisonCandleStyle, normalizeComparisonCandles, normalizeComparisonMinutes } from "../src/lib/stock-comparison";
import type { ComparisonCandle } from "../src/lib/stock-comparison";

const candle = (date: string, close: number): ComparisonCandle => ({ date, open: close * 0.98, close, high: close * 1.02, low: close * 0.96 });

test("价格量级不同的股票按同一交易日归一化，缺失交易日不移位", () => {
  const input = [
    { code: "a", candles: [candle("2026-10-26", 10), candle("2026-10-27", 20), candle("2026-10-28", 22)] },
    { code: "b", candles: [candle("2026-10-27", 200), candle("2026-10-29", 220)] },
  ];
  const result = normalizeComparisonCandles(input);
  assert.equal(result.baseDate, "2026-10-27");
  assert.deepEqual(result.dates, ["2026-10-27", "2026-10-28", "2026-10-29"]);
  assert.equal(result.series[0].candles[0].close, 0);
  assert.equal(result.series[1].candles[0].close, 0);
  assert.ok(Math.abs(result.series[0].candles[1].close - 10) < 1e-10);
  assert.ok(Math.abs(result.series[1].candles[1].close - 10) < 1e-10);
  assert.equal(result.series[1].candles.some((item) => item.date === "2026-10-28"), false);
  assert.equal(input[0].candles[0].close, 10);
});

test("无共同交易日或无有效价格时不绘制误导性的叠加K线", () => {
  assert.equal(normalizeComparisonCandles([
    { code: "a", candles: [candle("2026-10-26", 10)] },
    { code: "b", candles: [candle("2026-10-27", 20)] },
  ]).baseDate, null);
  assert.deepEqual(normalizeComparisonCandles([{ code: "a", candles: [candle("2026-10-26", 0)] }]).series, []);
});

test("分时以各股昨收价换算，停牌或未到达的分钟保留空值", () => {
  const values = normalizeComparisonMinutes([10, 11, null, 9, NaN, 0], 10);
  assert.equal(values[0], 0);
  assert.ok(Math.abs(values[1]! - 10) < 1e-10);
  assert.equal(values[2], null);
  assert.ok(Math.abs(values[3]! + 10) < 1e-10);
  assert.deepEqual(values.slice(4), [null, null]);
  assert.deepEqual(normalizeComparisonMinutes([10, 11], 0), [null, null]);
});

test("主图红涨绿跌，叠加阳线空心、阴线蓝灰实心", () => {
  assert.equal(comparisonCandleStyle(true, true).fill, "#E94040");
  assert.equal(comparisonCandleStyle(true, false).fill, "#2DC08E");
  assert.equal(comparisonCandleStyle(false, true).fill, "none");
  assert.equal(comparisonCandleStyle(false, false).fill, comparisonCandleStyle(false, false).stroke);
});
