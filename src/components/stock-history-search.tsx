"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HistoryDayGroup } from "@/components/block-history-list";

interface StockEntry {
  code: string;
  name: string;
  dates: string[];
}

interface StockHistorySearchProps {
  historyData: HistoryDayGroup[];
  onJumpToDate: (stockCode: string, date: string) => void;
  disabled?: boolean;
}

function formatShortDate(dateStr: string) {
  return format(parseISO(dateStr), "M.d");
}

export function StockHistorySearch({
  historyData,
  onJumpToDate,
  disabled = false,
}: StockHistorySearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockEntry | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stockIndex = useMemo(() => {
    const map = new Map<string, StockEntry>();
    for (const group of historyData) {
      for (const stock of group.stocks) {
        const existing = map.get(stock.code);
        if (existing) {
          if (!existing.dates.includes(group.date)) {
            existing.dates.push(group.date);
          }
        } else {
          map.set(stock.code, {
            code: stock.code,
            name: stock.name,
            dates: [group.date],
          });
        }
      }
    }
    // 日期降序（与 historyData 一致）
    for (const entry of map.values()) {
      entry.dates.sort((a, b) => b.localeCompare(a));
    }
    return map;
  }, [historyData]);

  const matchedStocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: StockEntry[] = [];
    for (const entry of stockIndex.values()) {
      if (
        entry.code.toLowerCase().includes(q) ||
        entry.name.toLowerCase().includes(q)
      ) {
        results.push(entry);
      }
    }
    return results.slice(0, 10);
  }, [query, stockIndex]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectStock = (entry: StockEntry) => {
    setSelectedStock(entry);
    setQuery(`${entry.name} (${entry.code})`);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setSelectedStock(null);
    setOpen(false);
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedStock(null);
    setOpen(true);
  };

  const handleDateClick = (date: string) => {
    if (!selectedStock) return;
    onJumpToDate(selectedStock.code, date);
  };

  if (disabled) return null;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (query.trim() && !selectedStock) setOpen(true);
          }}
          placeholder="搜索股票"
          className="h-6 pl-7 pr-6 text-[11px] w-[120px]"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 搜索结果下拉 */}
      {open && query.trim() && !selectedStock && (
        <div className="absolute top-full left-0 mt-1 z-50 w-[200px] bg-white border border-slate-200 rounded-md shadow-lg max-h-[200px] overflow-y-auto">
          {matchedStocks.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-slate-400">未找到匹配股票</div>
          ) : (
            matchedStocks.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => handleSelectStock(entry)}
                className="w-full px-3 py-1.5 text-left hover:bg-orange-50 transition-colors"
              >
                <div className="text-[11px] font-medium text-slate-800 truncate">
                  {entry.name}
                </div>
                <div className="text-[10px] text-slate-400">
                  {entry.code} · 出现 {entry.dates.length} 天
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* 出现日期列表 */}
      {selectedStock && selectedStock.dates.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-lg px-2 py-1.5 flex flex-wrap gap-1 max-w-[280px]">
          <span className="text-[10px] text-slate-400 w-full mb-0.5">出现日期：</span>
          {selectedStock.dates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => handleDateClick(date)}
              className={cn(
                "px-1.5 py-0.5 text-[11px] rounded border border-slate-200",
                "text-orange-600 hover:bg-orange-50 hover:border-orange-300 transition-colors"
              )}
            >
              {formatShortDate(date)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
