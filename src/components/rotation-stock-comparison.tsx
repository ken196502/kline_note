"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { comparisonCandleStyle, normalizeComparisonCandles, normalizeComparisonMinutes } from "@/lib/stock-comparison";
import type { ComparisonCandle } from "@/lib/stock-comparison";
import type { RotationComparisonStock } from "@/types/rotation";

interface StockChartData {
  candles: ComparisonCandle[];
  minutes: (number | null)[];
  candleError?: string;
  minuteError?: string;
  candlePending?: boolean;
  minutePending?: boolean;
}

interface ComparisonProps {
  stocks: RotationComparisonStock[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const rate = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

function useChartSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 440, height: 280 });
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

function PercentPlot({ values, labels, render, onHover }: {
  values: number[];
  labels: { index: number; label: string }[];
  render: (coordinates: { x: (index: number) => number; y: (value: number) => number; step: number; bottom: number }) => ReactNode;
  onHover: (index: number | null) => void;
}) {
  const { ref, width, height } = useChartSize();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const count = Math.max(1, ...labels.map((label) => label.index + 1));
  const left = 56;
  const right = Math.max(left + 1, width - 12);
  const top = 12;
  const bottom = Math.max(top + 1, height - 24);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const padding = Math.max((max - min) * 0.08, 0.5);
  const low = min - padding;
  const high = max + padding;
  const step = (right - left) / count;
  const x = (index: number) => left + (index + 0.5) * step;
  const y = (value: number) => bottom - (value - low) / (high - low) * (bottom - top);
  return (
    <div ref={ref} className="relative min-h-0 flex-1">
      <svg
        width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}
        role="img" aria-label="股票百分比对比图"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const position = (event.clientX - bounds.left) * width / bounds.width;
          const index = Math.max(0, Math.min(count - 1, Math.floor((position - left) / step)));
          setHoverIndex(index);
          onHover(index);
        }}
        onPointerLeave={() => { setHoverIndex(null); onHover(null); }}
      >
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = low + (high - low) * tick / 4;
          return <g key={tick}>
            <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#f1f5f9" />
            <text x={left - 6} y={y(value)} textAnchor="end" dominantBaseline="middle" fill="#94a3b8" fontSize="10">{rate(value)}</text>
          </g>;
        })}
        <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeDasharray="4 4" />
        {render({ x, y, step, bottom })}
        {hoverIndex !== null && <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={top} y2={bottom} stroke="#94a3b8" strokeDasharray="3 3" />}
        {labels.map((label, index) => <text key={label.index} x={x(label.index)} y={height - 6} textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"} fill="#94a3b8" fontSize="10">{label.label}</text>)}
      </svg>
    </div>
  );
}

function ComparisonCharts({ stocks, data }: { stocks: RotationComparisonStock[]; data: Record<string, StockChartData> }) {
  const [candleHover, setCandleHover] = useState<number | null>(null);
  const [minuteHover, setMinuteHover] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(120);
  const normalized = useMemo(() => normalizeComparisonCandles(stocks.flatMap((stock) => {
    const candles = data[stock.code]?.candles;
    return candles?.length ? [{ code: stock.code, candles }] : [];
  })), [stocks, data]);
  const dates = normalized.dates.slice(-visibleCount);
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const candles = normalized.series.map((series) => ({ ...series, candles: series.candles.filter((candle) => dateIndex.has(candle.date)) }));
  const values = candles.flatMap((series) => series.candles.flatMap((candle) => [candle.high, candle.low]));
  const minutes = stocks.map((stock) => ({ code: stock.code, values: data[stock.code]?.minutes ?? [] }));
  const minuteValues = minutes.flatMap((series) => series.values.filter((value): value is number => value !== null));
  const minuteCount = Math.max(2, ...minutes.map((series) => series.values.length));
  const primaryCode = stocks[0]?.code;
  const candleLabels = [...new Set([0, Math.floor((dates.length - 1) / 2), dates.length - 1])]
    .filter((index) => index >= 0).map((index) => ({ index, label: dates[index]?.slice(5) ?? "" }));
  const minuteLabels = [
    { index: 0, label: "09:30" },
    { index: Math.floor((minuteCount - 1) / 2), label: "11:30 / 13:00" },
    { index: minuteCount - 1, label: "15:00" },
  ];
  const hoverDate = dates[candleHover ?? dates.length - 1];
  const minuteIndex = minuteHover ?? Math.max(0, ...minutes.map((series) => series.values.findLastIndex((value) => value !== null)));
  const minuteTime = (() => {
    // 在线分时接口含午间两个端点（通常共 242 个点）。
    const minute = minuteIndex <= 120 ? 570 + minuteIndex : 780 + minuteIndex - 121;
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  })();
  const chartEmpty = (kind: "candle" | "minute") => <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-slate-400">
    {stocks.some((stock) => !data[stock.code] || data[stock.code][kind === "candle" ? "candlePending" : "minutePending"]) ? <Skeleton className="h-full w-full rounded-none" /> : kind === "candle" && normalized.baseDate === null && stocks.some((stock) => data[stock.code]?.candles.length) ? "所选股票没有共同交易日" : `暂无${kind === "candle" ? "K线" : "分时"}数据`}
  </div>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section aria-label="K线对比" className="flex min-h-0 flex-[3] flex-col border-b border-slate-200">
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2">
          <h3 className="text-xs font-semibold text-slate-600">日 K 线</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">{dates.length} 日</span>
            <Button variant="ghost" size="sm" className="h-6 px-2" aria-label="放大K线" disabled={visibleCount <= 20} onClick={() => setVisibleCount((count) => Math.max(20, count - 20))}>+</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2" aria-label="缩小K线" disabled={visibleCount >= 120} onClick={() => setVisibleCount((count) => Math.min(120, count + 20))}>−</Button>
          </div>
        </div>
        <p className="shrink-0 px-3 text-[10px] text-slate-400">{normalized.baseDate ? `${normalized.baseDate} 各股收盘价 = 0%` : "共同起始交易日收盘价 = 0%"}</p>
        {dates.length ? <PercentPlot values={values} labels={candleLabels} onHover={setCandleHover} render={({ x, y, step }) =>
          [...candles].reverse().map((series) => <g key={series.code} data-candle-series={series.code} opacity={1}>
            {series.candles.map((candle) => {
              const index = dateIndex.get(candle.date)!;
              const primary = series.code === primaryCode;
              const style = comparisonCandleStyle(primary, candle.close >= candle.open, stocks.find((stock) => stock.code === series.code)?.color);
              const bodyWidth = Math.max(1, Math.min(primary ? 12 : 16, step * (primary ? 0.62 : 0.9)));
              const bodyTop = Math.min(y(candle.open), y(candle.close));
              const bodyBottom = Math.max(y(candle.open), y(candle.close));
              return <g key={candle.date}>
                <line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={bodyTop} stroke={style.stroke} strokeWidth={primary ? 1 : 0.75} />
                <line x1={x(index)} x2={x(index)} y1={bodyBottom} y2={y(candle.low)} stroke={style.stroke} strokeWidth={primary ? 1 : 0.75} />
                <rect x={x(index) - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={Math.max(1, bodyBottom - bodyTop)} stroke={style.stroke} strokeWidth={primary ? 1 : 0.75} fill={style.fill} />
              </g>;
            })}
          </g>)
        } /> : chartEmpty("candle")}
        <div className="h-20 shrink-0 overflow-y-auto px-3 pb-1 text-[10px] leading-4 text-slate-500">
          <span>{hoverDate ?? "暂无K线数据"}</span>
          {stocks.map((stock) => {
            const candle = candles.find((series) => series.code === stock.code)?.candles.find((item) => item.date === hoverDate);
            return <div key={stock.code} className="flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: stock.color }} />{stock.name} {candle ? `开 ${rate(candle.open)} 高 ${rate(candle.high)} 低 ${rate(candle.low)} 收 ${rate(candle.close)}` : "无当日数据"}</div>;
          })}
        </div>
      </section>
      <section aria-label="分时对比" className="flex min-h-0 flex-[2] flex-col">
        <h3 className="shrink-0 px-3 pt-2 text-xs font-semibold text-slate-600">最新分时</h3>
        <p className="shrink-0 px-3 text-[10px] text-slate-400">各股昨收价 = 0%</p>
        {minuteValues.length ? <PercentPlot values={minuteValues} labels={minuteLabels} onHover={setMinuteHover} render={({ x, y }) =>
          [...minutes].reverse().map((series) => {
            let path = "";
            let connected = false;
            series.values.forEach((value, index) => {
              if (value === null) { connected = false; return; }
              path += `${connected ? "L" : "M"}${x(index)},${y(value)} `;
              connected = true;
            });
            const last = series.values.findLast((value) => value !== null) ?? 0;
            const primary = series.code === primaryCode;
            const color = primary ? last >= 0 ? "#E94040" : "#2DC08E" : stocks.find((stock) => stock.code === series.code)?.color;
            const lastIndex = series.values.findLastIndex((value) => value !== null);
            return <g key={series.code} data-minute-series={series.code} opacity={1}>
              <path d={path} fill="none" stroke={color} strokeWidth={primary ? 2 : 1.5} />
              {lastIndex >= 0 && <circle cx={x(lastIndex)} cy={y(last)} r={primary ? 2 : 1.5} fill={color} />}
            </g>;
          })
        } /> : chartEmpty("minute")}
        <div className="h-16 shrink-0 overflow-y-auto px-3 pb-1 text-[10px] leading-4 text-slate-500">
          {minuteValues.length ? minuteTime : "暂无分时数据"} {stocks.map((stock) => {
            const value = data[stock.code]?.minutes[minuteIndex];
            return <span key={stock.code} className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: stock.color }} />{stock.name} {value === null || value === undefined ? "无数据" : rate(value)}</span>;
          })}
        </div>
      </section>
    </div>
  );
}

export function RotationStockComparison({ stocks, open, onOpenChange }: ComparisonProps) {
  const cacheRef = useRef(new Map<string, StockChartData>());
  const [data, setData] = useState<Record<string, StockChartData>>({});
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]);
    for (const stock of stocks) {
      if (cacheRef.current.has(stock.code)) continue;
      setData((previous) => ({ ...previous, [stock.code]: { candles: [], minutes: [], candlePending: true, minutePending: true } }));
      const symbol = /^(sh|sz)/.test(stock.code) ? stock.code : `${stock.code.startsWith("6") ? "sh" : "sz"}${stock.code}`;
      const fetchCandles = async (): Promise<ComparisonCandle[]> => {
        const response = await fetch(`/api/kline?${new URLSearchParams({ symbol, limit: "120" })}`, { signal });
        if (!response.ok) throw new Error("K线获取失败");
        const result: { klines?: ComparisonCandle[] } = await response.json();
        if (!result.klines?.length) throw new Error("暂无K线数据");
        return result.klines;
      };
      const fetchMinutes = async (): Promise<(number | null)[]> => {
        const response = await fetch(`/api/time-preview?${new URLSearchParams({ code: symbol })}`, { signal });
        if (!response.ok) throw new Error("分时获取失败");
        const result: { success: boolean; data?: { prices: (number | null)[]; prevClose: number } } = await response.json();
        if (!result.success || !result.data?.prices.length) throw new Error("暂无分时数据");
        const values = normalizeComparisonMinutes(result.data.prices, result.data.prevClose);
        if (values.every((value) => value === null)) throw new Error("分时缺少有效价格或昨收价");
        return values;
      };
      const failureText = (failure: unknown) => failure instanceof Error ? failure.message : "行情获取失败";
      const update = (patch: Partial<StockChartData>) => {
        if (controller.signal.aborted) return;
        setData((previous) => ({ ...previous, [stock.code]: { ...previous[stock.code], ...patch } }));
      };
      const candleRequest = fetchCandles().then((candles) => {
        update({ candles, candlePending: false });
        return candles;
      }, (failure: unknown) => {
        update({ candleError: failureText(failure), candlePending: false });
        throw failure;
      });
      const minuteRequest = fetchMinutes().then((minutes) => {
        update({ minutes, minutePending: false });
        return minutes;
      }, (failure: unknown) => {
        update({ minuteError: failureText(failure), minutePending: false });
        throw failure;
      });
      void Promise.allSettled([candleRequest, minuteRequest]).then(([candles, minutes]) => {
        if (controller.signal.aborted) return;
        const result: StockChartData = {
          candles: candles.status === "fulfilled" ? candles.value : [],
          minutes: minutes.status === "fulfilled" ? minutes.value : [],
          candleError: candles.status === "rejected" ? failureText(candles.reason) : undefined,
          minuteError: minutes.status === "rejected" ? failureText(minutes.reason) : undefined,
        };
        cacheRef.current.set(stock.code, result);
        setData((previous) => ({ ...previous, [stock.code]: result }));
      });
    }
    return () => controller.abort();
  }, [stocks]);

  const content = () => stocks.length === 0 ? <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-sm text-slate-400">勾选个股查看 K 线和分时，可多选叠加对比</div> : <>
    <ComparisonCharts stocks={stocks} data={data} />
  </>;
  return <>
    <aside aria-label="个股图表对比" className="hidden w-[50vh] min-w-[340px] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white lg:flex">{content()}</aside>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg lg:hidden">
        <SheetHeader className="shrink-0 border-b border-slate-200 p-3 pr-10">
          <SheetTitle>个股图表对比</SheetTitle>
          <SheetDescription className="sr-only">按勾选顺序叠加 K 线和最新分时，百分比对比</SheetDescription>
        </SheetHeader>
        {content()}
      </SheetContent>
    </Sheet>
  </>;
}
