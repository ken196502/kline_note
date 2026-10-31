"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { RotationComparisonStock, RotationDirection, RotationSelection, RotationStock } from "@/types/rotation";

interface RotationRankingProps {
  selection: RotationSelection | null;
  direction: RotationDirection;
  loading: boolean;
  checkedStocks: RotationComparisonStock[];
  onToggleStock: (stock: RotationStock, checked: boolean) => void;
  onPrimaryStock: (stock: RotationStock) => void;
}

export function RotationRanking({ selection, direction, loading, checkedStocks, onToggleStock, onPrimaryStock }: RotationRankingProps) {
  const up = direction === "up";
  return (
    <section aria-label={`${up ? "涨停" : "跌停"}股票榜单`} className={cn("flex shrink-0 flex-col overflow-hidden bg-white px-4 py-2", up ? "h-[30%] border-b border-slate-200" : "h-[18%] border-t border-slate-200")}>
      <div className="mb-1 shrink-0">
        <div className="text-[10px] text-slate-400">{selection?.date ?? "悬浮柱子选择交易日"}</div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">{selection?.block.name ?? `${up ? "涨停" : "跌停"}个股`}</h2>
          {selection && <Badge variant="outline" className={cn("border-0 text-[10px]", up ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700")}>{up ? "涨停" : "跌停"} {selection.block.count} 只</Badge>}
          <span className="text-[10px] text-slate-400">当日连板数降序 · 移开保留</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !selection ? <div className="space-y-1">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-7 rounded" />)}</div> : selection ?
          selection.block.stocks.length === 0 ? <p className="py-4 text-xs text-slate-400">个股明细暂未获取</p> :
            <ol className="divide-y divide-slate-100">
              {selection.block.stocks.map((stock, index) => (
                <li
                  key={stock.code}
                  onClick={() => onPrimaryStock(stock)}
                  className={cn("flex cursor-pointer items-center gap-3 py-1 text-xs sm:gap-5", checkedStocks[0]?.code === stock.code ? "bg-orange-50" : "hover:bg-slate-50")}
                >
                  <Checkbox
                    aria-label={`对比${stock.name} ${stock.code}`}
                    checked={checkedStocks.some((item) => item.code === stock.code)}
                    onCheckedChange={(checked) => onToggleStock(stock, checked === true)}
                    onClick={(event) => event.stopPropagation()}
                    className="shrink-0"
                  />
                  <button
                    type="button"
                    aria-label={`设为主图${stock.name} ${stock.code}`}
                    aria-pressed={checkedStocks[0]?.code === stock.code}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:gap-5"
                  >
                    <span className="w-5 shrink-0 text-[10px] tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                    <span className="flex w-24 shrink-0 items-center gap-1.5 font-medium text-slate-800">
                      {checkedStocks.find((item) => item.code === stock.code)?.color && <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: checkedStocks.find((item) => item.code === stock.code)?.color }}
                      />}
                      <span className="truncate">{stock.name}</span>
                    </span>
                    <span className="hidden w-14 shrink-0 font-mono text-[10px] text-slate-400 sm:inline">{stock.code}</span>
                    <span className={cn("w-24 shrink-0 text-[10px] font-semibold", up ? "text-red-600" : "text-emerald-700")}>{stock.continueNum === null ? "暂无连板数据" : stock.continueNum <= 1 ? "首板" : `${stock.continueNum}连板`}</span>
                    <span className={cn("shrink-0 font-mono text-[10px]", stock.changeRate >= 0 ? "text-red-500" : "text-emerald-600")}>{stock.changeRate > 0 ? "+" : ""}{stock.changeRate.toFixed(2)}%</span>
                  </button>
                </li>
              ))}
            </ol> : <p className="py-4 text-xs text-slate-400">悬浮或点击{up ? "红色涨停" : "绿色跌停"}柱子查看</p>}
      </div>
    </section>
  );
}
