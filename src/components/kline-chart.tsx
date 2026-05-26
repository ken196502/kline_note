"use client";

import { useEffect, useRef, useState } from "react";
import { init, dispose } from "klinecharts";
import { Skeleton } from "@/components/ui/skeleton";

interface KLineChartData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  amount: number;
}

interface KLineChartProps {
  symbol: string;
  stockName: string;
}

export function KLineChart({ symbol, stockName }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const currentSymbolRef = useRef(symbol);

  useEffect(() => {
    if (!containerRef.current || !symbol) return;

    const container = containerRef.current;
    const containerId = "kline-chart-container";
    container.id = containerId;

    // 记录当前 symbol
    currentSymbolRef.current = symbol;
    const currentSymbol = symbol;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // 销毁旧图表
    if (chartRef.current) {
      chartRef.current = null;
    }
    dispose(containerId);

    setLoading(true);

    // 创建图表
    const chart = init(containerId);
    if (!chart) {
      setLoading(false);
      return;
    }

    chartRef.current = chart;
    chart.setSymbol({ ticker: stockName || currentSymbol });
    chart.setPeriod({ span: 1, type: "day" });

    // 设置数据加载器
    chart.setDataLoader({
      getBars: async ({ callback }: { callback: (data: any[]) => void }) => {
        try {
          const res = await fetch(`/api/kline?symbol=${currentSymbol}&limit=120`, {
            signal: abortControllerRef.current?.signal,
          });

          if (!res.ok) {
            callback([]);
            setLoading(false);
            return;
          }

          const result = await res.json();
          const klines: KLineChartData[] = result.klines;

          // 检查是否是最新的 symbol
          if (currentSymbolRef.current !== currentSymbol) {
            return;
          }

          if (!klines || klines.length === 0) {
            callback([]);
            setLoading(false);
            return;
          }

          const chartData = klines.map((item) => ({
            timestamp: new Date(item.date).getTime(),
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.amount,
          }));

          callback(chartData);
          setLoading(false);

          // 数据加载完成后，容器从 hidden 变为可见，需要触发 resize
          // 让 klinecharts 重新计算正确的尺寸
          requestAnimationFrame(() => {
            if (chartRef.current) {
              chartRef.current.resize();
            }
          });
        } catch (err) {
          // AbortError 不处理
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          console.error("K线数据加载失败", err);
          callback([]);
          setLoading(false);
        }
      },
    });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (chartRef.current) {
        chartRef.current = null;
      }
      dispose(containerId);
    };
  }, [symbol, stockName]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2 px-2">
        <span className="text-sm font-semibold text-slate-900">
          {stockName}
        </span>
        <span className="text-xs text-slate-400 font-mono">{symbol}</span>
        {loading && (
          <span className="text-xs text-slate-400">加载K线数据...</span>
        )}
      </div>
      <div className="flex-1 relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
            <Skeleton className="w-full h-full" />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}