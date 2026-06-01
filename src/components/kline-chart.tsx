"use client";

import { useEffect, useRef } from "react";
import { init, dispose } from "klinecharts";


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
  onDataLoaded?: (symbol: string) => void;
}

export function KLineChart({ symbol, stockName, onDataLoaded }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentSymbolRef = useRef(symbol);
  const initializedRef = useRef(false);
  const onDataLoadedRef = useRef(onDataLoaded);
  onDataLoadedRef.current = onDataLoaded;

  // 初始化图表（只执行一次）
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerId = "kline-chart-container";
    container.id = containerId;

    if (initializedRef.current) return;
    initializedRef.current = true;

    const chart = init(containerId, {
      layout: {
        panes: [
          { type: "candle" },
          {
            type: "indicator",
            content: ["VOL"],
            options: { minHeight: 60 },
          },
          { type: "xAxis" },
        ],
      },
    });
    if (!chart) return;

    chartRef.current = chart;
    chart.setPeriod({ span: 1, type: "day" });
    
    // 设置格式化器，将数值显示为百分比
    chart.setFormatter({
      formatBigNumber: (value: string | number) => {
        const num = typeof value === "string" ? parseFloat(value) : value;
        return `${num.toFixed(2)}%`;
      },
    });
    
    chart.setStyles({
      candle: {
        priceMark: {
          high: { color: "#E94040" },
          low: { color: "#2DC08E" },
        },
        tooltip: {
          title: {
            show: false,
          },
        },
      },
      indicator: {
        last: { color: "#E94040" },
      },
      grid: {
        horizontal: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        vertical: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      xAxis: {
        axisLine: { color: "rgba(0, 0, 0, 0.1)" },
        tickLine: { color: "rgba(0, 0, 0, 0.1)" },
      },
      yAxis: {
        axisLine: { color: "rgba(0, 0, 0, 0.1)" },
        tickLine: { color: "rgba(0, 0, 0, 0.1)" },
      },
    });

    // 红涨绿跌样式
    chart.setStyles({
      candle: {
        bar: {
          upColor: "#E94040",
          downColor: "#2DC08E",
          upBorderColor: "#E94040",
          downBorderColor: "#2DC08E",
          upWickColor: "#E94040",
          downWickColor: "#2DC08E",
        },
      },
    });

    // 默认显示 MA 均线（叠加在蜡烛图上），隐藏 label 只保留曲线
    chart.createIndicator("MA", { pane: { id: "candle_pane" }, isStack: true });
    chart.setStyles({
      indicator: {
        tooltip: {
          showRule: "none",
        },
      },
    });

    // 从缓存恢复缩放
    const savedBarSpace = localStorage.getItem("kline-bar-space");
    if (savedBarSpace) {
      chart.setBarSpace(Number(savedBarSpace));
    }

    // 监听缩放变化，保存到缓存
    chart.subscribeAction("onZoom", () => {
      const barSpace = chart.getBarSpace();
      localStorage.setItem("kline-bar-space", String(barSpace.bar));
    });

    // 设置数据加载器（只设置一次）
    chart.setDataLoader({
      getBars: async ({ callback }) => {
        const targetSymbol = currentSymbolRef.current;
        if (!targetSymbol) {
          callback([]);
          return;
        }

        // 取消之前的请求
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const res = await fetch(`/api/kline?symbol=${targetSymbol}&limit=120`, {
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          callback([]);
          return;
        }

        const result = await res.json();
        const klines: KLineChartData[] = result.klines;

        // 检查是否是最新的 symbol
        if (currentSymbolRef.current !== targetSymbol) {
          return;
        }

        if (!klines || klines.length === 0) {
          callback([]);
          return;
        }

        // 将价格转换为相对于第一个交易日收盘价的百分比变化
        const basePrice = klines[0].close;
        const chartData = klines.map((item) => ({
          timestamp: new Date(item.date).getTime(),
          open: (item.open / basePrice - 1) * 100,
          high: (item.high / basePrice - 1) * 100,
          low: (item.low / basePrice - 1) * 100,
          close: (item.close / basePrice - 1) * 100,
          volume: item.amount,
        }));

        callback(chartData);

        onDataLoadedRef.current?.(targetSymbol);

        requestAnimationFrame(() => {
          if (chartRef.current) {
            chartRef.current.resize();
          }
        });
      },
    });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (chartRef.current) {
        chartRef.current = null;
      }
      initializedRef.current = false;
      dispose(containerId);
    };
  }, []);

  // symbol 变化时：更新 symbol ref，通知图表重新加载数据
  useEffect(() => {
    if (!symbol || !initializedRef.current) return;
    currentSymbolRef.current = symbol;

    const chart = chartRef.current;
    if (!chart) return;

    // 更新 symbol 会触发 DataLoader.getBars 重新执行
    chart.setSymbol({ ticker: stockName || symbol });
  }, [symbol, stockName]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative min-h-0">

        <div
          ref={containerRef}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}