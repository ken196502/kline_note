"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2, RefreshCw, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotationChart } from "@/components/rotation-chart";
import { RotationRanking } from "@/components/rotation-ranking";
import { RotationStockComparison } from "@/components/rotation-stock-comparison";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { RotationDay, RotationResponse, RotationSelection, RotationStock } from "@/types/rotation";

export default function RotationPage() {
  const router = useRouter();
  const { authenticated, loading: authLoading } = useAuth();
  const [days, setDays] = useState<RotationDay[]>([]);
  const [selected, setSelected] = useState<RotationSelection | null>(null);
  const [upSelection, setUpSelection] = useState<RotationSelection | null>(null);
  const [downSelection, setDownSelection] = useState<RotationSelection | null>(null);
  const [checkedStocks, setCheckedStocks] = useState<RotationStock[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [nextDate, setNextDate] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (startDate?: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: "5" });
      if (startDate) params.set("startDate", startDate);
      const response = await fetch(`/api/rotation?${params}`, { signal: controller.signal });
      if (!response.ok) {
        const failure: { error?: string } = await response.json();
        throw new Error(failure.error || "行情加载失败，请重试");
      }
      const result: RotationResponse = await response.json();
      if (controller.signal.aborted) return;
      setDays((previous) => {
        const merged = new Map((startDate ? previous : []).map((day) => [day.date, day]));
        result.data.forEach((day) => merged.set(day.date, day));
        return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date));
      });
      setNextDate(result.hasMore ? result.nextDate : null);
      setWarnings((previous) => [...new Set([...(startDate ? previous : []), ...result.warnings])]);
      const updateRanking = (previous: RotationSelection | null, direction: "up" | "down"): RotationSelection | null => {
        if (previous) {
          const block = result.data.find((day) => day.date === previous.date)?.[direction].find((block) => block.code === previous.block.code);
          return block ? { ...previous, block } : previous;
        }
        const day = result.data.find((day) => day[direction].length > 0);
        return day ? { date: day.date, direction, block: day[direction][0] } : null;
      };
      setUpSelection((previous) => updateRanking(previous, "up"));
      setDownSelection((previous) => updateRanking(previous, "down"));
      setSelected((previous) => {
        if (previous) {
          const block = result.data.find((day) => day.date === previous.date)?.[previous.direction]
            .find((block) => block.code === previous.block.code);
          return block ? { ...previous, block } : previous;
        }
        const firstDay = result.data[0];
        const firstBlock = firstDay?.up[0] ?? firstDay?.down[0];
        return firstDay && firstBlock ? { date: firstDay.date, direction: firstDay.up.length > 0 ? "up" : "down", block: firstBlock } : null;
      });
    } catch (failure: unknown) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "网络错误，请重试");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!authenticated) { router.replace("/"); return; }
    void load();
    return () => requestRef.current?.abort();
  }, [authLoading, authenticated, router, load]);

  const pending = authLoading || loading;

  const handleSelect = (selection: RotationSelection) => {
    setSelected(selection);
    if (selection.direction === "up") setUpSelection(selection);
    else setDownSelection(selection);
  };

  const handleToggleStock = (stock: RotationStock, checked: boolean) => {
    setCheckedStocks((previous) => checked
      ? previous.some((item) => item.code === stock.code) ? previous : [...previous, stock]
      : previous.filter((item) => item.code !== stock.code));
    if (checked && !window.matchMedia("(min-width: 1024px)").matches) setComparisonOpen(true);
  };

  const handlePrimaryStock = (stock: RotationStock) => {
    setCheckedStocks((previous) => previous[0]?.code === stock.code
      ? previous
      : [previous.find((item) => item.code === stock.code) ?? stock, ...previous.filter((item) => item.code !== stock.code)]);
    if (!window.matchMedia("(min-width: 1024px)").matches) setComparisonOpen(true);
  };

  return (
    <main className="flex h-[calc(100dvh-3rem)] flex-col overflow-hidden bg-slate-50 md:h-dvh">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="size-5 text-orange-600" />
          <h1 className="text-lg font-bold text-slate-900">轮动</h1>
          <span className="hidden text-xs text-slate-400 sm:inline">板块涨跌停 · 交易日对照</span>
        </div>
        <div className="flex items-center gap-2">
          {checkedStocks.length > 0 && <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setComparisonOpen(true)}>对比 {checkedStocks.length} 只</Button>}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={pending || !authenticated}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />刷新
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <RotationRanking selection={upSelection} direction="up" loading={pending} checkedStocks={checkedStocks} onToggleStock={handleToggleStock} onPrimaryStock={handlePrimaryStock} />

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-slate-600"><span className="size-2 rounded-sm bg-red-500" />涨停数</span>
                <span className="flex items-center gap-1.5 text-slate-600"><span className="size-2 rounded-sm bg-emerald-600" />跌停数</span>
                <span className="text-slate-400">{days.length} 个交易日 · 各日独立降序</span>
              </div>
              <span className="hidden items-center gap-1 text-slate-400 sm:flex"><MoveHorizontal className="size-3.5" />左右拖动 / 滚轮移动</span>
            </div>
            {error && <div role="alert" className="flex shrink-0 items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <span>{error}</span><Button variant="ghost" size="sm" disabled={pending} onClick={() => void load(days.length > 0 ? nextDate ?? undefined : undefined)}>重试</Button>
            </div>}
            {warnings.length > 0 && <p role="status" className="shrink-0 text-xs text-amber-700">{warnings.join("；")}</p>}
            {days.length > 0 ? <RotationChart days={days} selected={selected} onSelect={handleSelect} /> : pending ?
              <Skeleton className="min-h-0 flex-1 rounded-xl" /> : <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">{error ? "行情暂未加载" : "暂无交易日行情"}</div>}
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <p className="max-w-3xl text-[10px] leading-relaxed text-slate-400">同花顺数据；跌停按截至当日最近一次历史板块归属，未匹配归入未分类；多板块股票分别计数。未提供的连板数排在末尾。</p>
              <Button variant="outline" size="sm" disabled={pending || !nextDate} onClick={() => { if (nextDate) void load(nextDate); }}>
                {loading && <Loader2 className="size-3.5 animate-spin" />}
                {loading ? "加载中" : nextDate ? "加载更早交易日" : "暂无更早数据"}
              </Button>
            </footer>
          </div>
          <RotationRanking selection={downSelection} direction="down" loading={pending} checkedStocks={checkedStocks} onToggleStock={handleToggleStock} onPrimaryStock={handlePrimaryStock} />
        </div>
        <RotationStockComparison stocks={checkedStocks} onRemove={(stock) => handleToggleStock(stock, false)} open={comparisonOpen} onOpenChange={setComparisonOpen} />
      </div>
    </main>
  );
}
