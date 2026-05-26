"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, TrendingUp, RefreshCw, Clock, X, Save, StickyNote, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { BlockData, StockData } from "@/types/block-data";
import { useAuth } from "@/hooks/use-auth";
import { useNotes } from "@/hooks/use-notes";

interface DayBlockData {
  date: string;
  block: BlockData;
  stocks: StockData[];
}

async function fetchBlockDetail(
  code: string,
  startDate?: string,
  days: number = 10
): Promise<{
  data: DayBlockData[];
  hasMore: boolean;
  nextDate: string | null;
}> {
  const params = new URLSearchParams({ code, days: String(days) });
  if (startDate) params.set("startDate", startDate);

  const response = await fetch(`/api/block-detail?${params.toString()}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

interface NoteDrawerState {
  open: boolean;
  stockCode: string;
  stockName: string;
  stockDate: string;
  content: string;
  originalContent: string;
}

type SortField = "name" | "latest" | "changeRate" | "continueNum" | "firstLimitUpTime" | "lastLimitUpTime";
type SortDirection = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDirection }) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
  return sortDir === "asc" ? (
    <ArrowUp className="w-3 h-3 text-orange-600" />
  ) : (
    <ArrowDown className="w-3 h-3 text-orange-600" />
  );
}

function SortedStockTable({ stocks, date, onStockClick }: { stocks: StockData[]; date: string; onStockClick: (stock: StockData, date: string) => void }) {
  const [sortField, setSortField] = useState<SortField>("firstLimitUpTime");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "firstLimitUpTime" || field === "lastLimitUpTime" ? "asc" : "desc");
    }
  };

  const sortedStocks = useMemo(() => {
    const sorted = [...stocks].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name, "zh-CN");
          break;
        case "latest":
          cmp = a.latest - b.latest;
          break;
        case "changeRate":
          cmp = a.changeRate - b.changeRate;
          break;
        case "continueNum":
          cmp = a.continueNum - b.continueNum;
          break;
        case "firstLimitUpTime":
          cmp = (a.firstLimitUpTime || "99:99").localeCompare(b.firstLimitUpTime || "99:99");
          break;
        case "lastLimitUpTime":
          cmp = (a.lastLimitUpTime || "99:99").localeCompare(b.lastLimitUpTime || "99:99");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [stocks, sortField, sortDir]);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th
            className="text-left pl-3 py-2 font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none"
            onClick={() => handleSort("name")}
          >
            <span className="inline-flex items-center gap-1">
              名称 <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
            </span>
          </th>
          <th
            className="text-right py-2 font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none"
            onClick={() => handleSort("latest")}
          >
            <span className="inline-flex items-center justify-end gap-1">
              最新价 <SortIcon field="latest" sortField={sortField} sortDir={sortDir} />
            </span>
          </th>
          <th
            className="text-right py-2 font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none"
            onClick={() => handleSort("changeRate")}
          >
            <span className="inline-flex items-center justify-end gap-1">
              涨幅 <SortIcon field="changeRate" sortField={sortField} sortDir={sortDir} />
            </span>
          </th>
          <th
            className="text-right py-2 font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none"
            onClick={() => handleSort("continueNum")}
          >
            <span className="inline-flex items-center justify-end gap-1">
              板数 <SortIcon field="continueNum" sortField={sortField} sortDir={sortDir} />
            </span>
          </th>
          <th
            className="text-right py-2 font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none"
            onClick={() => handleSort("firstLimitUpTime")}
          >
            <span className="inline-flex items-center justify-end gap-1">
              首封 <SortIcon field="firstLimitUpTime" sortField={sortField} sortDir={sortDir} />
            </span>
          </th>
          <th
            className="text-right pr-3 py-2 font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none"
            onClick={() => handleSort("lastLimitUpTime")}
          >
            <span className="inline-flex items-center justify-end gap-1">
              末封 <SortIcon field="lastLimitUpTime" sortField={sortField} sortDir={sortDir} />
            </span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sortedStocks.map((stock) => (
          <tr
            key={stock.code}
            className="hover:bg-orange-50/50 transition-colors cursor-pointer"
            onClick={() => onStockClick(stock, date)}
          >
            <td className="pl-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <StickyNote className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <div>
                  <div className="font-medium text-slate-900 text-xs leading-tight">{stock.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono leading-tight">{stock.code}</div>
                </div>
              </div>
            </td>
            <td className="text-right py-1.5 font-mono text-xs text-slate-700">
              {stock.latest.toFixed(2)}
            </td>
            <td className="text-right py-1.5">
              <span className="font-bold text-red-600 text-xs">
                {stock.changeRate > 0 ? "+" : ""}
                {stock.changeRate.toFixed(2)}%
              </span>
            </td>
            <td className="text-right py-1.5">
              <span
                className={cn(
                  "text-xs font-semibold",
                  stock.continueNum >= 3
                    ? "text-red-700"
                    : stock.continueNum >= 2
                    ? "text-orange-600"
                    : "text-slate-500"
                )}
              >
                {stock.high || `${stock.continueNum}板`}
              </span>
            </td>
            <td className="text-right py-1.5 text-[11px] text-slate-500 font-mono">
              {stock.firstLimitUpTime || "-"}
            </td>
            <td className="text-right pr-3 py-1.5 text-[11px] text-slate-500 font-mono">
              {stock.lastLimitUpTime || "-"}
            </td>
          </tr>
        ))}
        {sortedStocks.length === 0 && (
          <tr>
            <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
              暂无涨停个股
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function BlockDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DayBlockData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [blockName, setBlockName] = useState("");

  const { authenticated, loading: authLoading } = useAuth();
  const { fetchNote, saveNote, saving } = useNotes();
  const [drawer, setDrawer] = useState<NoteDrawerState>({
    open: false,
    stockCode: "",
    stockName: "",
    stockDate: "",
    content: "",
    originalContent: "",
  });

  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push("/");
    }
  }, [authLoading, authenticated, router]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchBlockDetail(code)
      .then((result) => {
        setData(result.data);
        setHasMore(result.hasMore);
        if (result.data.length > 0) {
          setBlockName(result.data[0].block.name);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err : new Error("Unknown error"))
      )
      .finally(() => setIsLoading(false));
  }, [code]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || data.length === 0) return;
    setIsLoadingMore(true);
    try {
      const lastDate = data[data.length - 1].date;
      const result = await fetchBlockDetail(code, lastDate, 10);
      setData((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, data, code]);

  const formatDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return format(d, "yyyy年MM月dd日 EEEE", { locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  const handleStockClick = async (stock: StockData, date: string) => {
    const existingNote = await fetchNote(stock.code, date);
    setDrawer({
      open: true,
      stockCode: stock.code,
      stockName: stock.name,
      stockDate: date,
      content: existingNote || "",
      originalContent: existingNote || "",
    });
  };

  const handleSave = async () => {
    const success = await saveNote(
      drawer.stockCode,
      drawer.stockDate,
      drawer.content
    );
    if (success) {
      setDrawer((prev) => ({ ...prev, open: false }));
    }
  };

  const handleCancel = () => {
    setDrawer((prev) => ({ ...prev, open: false }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-60" />
              <Skeleton className="h-40 w-full" />
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-3 text-sm">加载失败或板块不存在</p>
          <Link href="/block-history">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              返回列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/block-history">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <TrendingUp className="w-4 h-4 text-orange-600" />
            <h1 className="text-lg font-bold text-slate-900">{blockName}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-4">
        <div className="space-y-4">
          {data.map((dayData) => (
            <div key={dayData.date}>
              {/* Date Summary Line */}
              <div className="flex items-center gap-2 mb-1.5 text-xs">
                <span className="font-semibold text-slate-700">
                  {formatDate(dayData.date)}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-orange-600 font-medium">
                  涨停{dayData.block.limitUpNum}
                </span>
                {dayData.block.continuousPlateNum > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-red-600 font-medium">
                      连板{dayData.block.continuousPlateNum}
                    </span>
                  </>
                )}
                {dayData.block.high && dayData.block.high !== "0" && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-purple-600 font-medium">
                      最高{dayData.block.high}
                    </span>
                  </>
                )}
              </div>

              {/* Stock Table - no rounded corners */}
              <div className="bg-white border border-slate-200">
                <SortedStockTable
                  stocks={dayData.stocks}
                  date={dayData.date}
                  onStockClick={handleStockClick}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-6 py-4 flex justify-center">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
              <span className="text-xs">加载中...</span>
            </div>
          )}
          {hasMore && !isLoadingMore && (
            <Button
              onClick={loadMore}
              variant="outline"
              size="sm"
              className="text-slate-600 border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              加载更多
            </Button>
          )}
          {!hasMore && data.length > 0 && (
            <div className="text-xs text-slate-400">已加载全部数据</div>
          )}
        </div>
      </main>

      {/* Note Drawer */}
      <div
        className={cn(
          "fixed inset-0 z-[100] transition-all duration-300",
          drawer.open ? "visible" : "invisible"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-300",
            drawer.open ? "opacity-100" : "opacity-0"
          )}
          onClick={handleCancel}
        />
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-white shadow-2xl transition-transform duration-300 max-h-[70vh] flex flex-col",
            drawer.open ? "translate-y-0" : "translate-y-full"
          )}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-orange-600" />
              <div>
                <span className="font-semibold text-slate-900 text-sm">
                  {drawer.stockName}
                </span>
                <span className="text-xs text-slate-400 font-mono ml-2">
                  {drawer.stockCode} · {drawer.stockDate}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              onClick={handleCancel}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <Textarea
              placeholder="添加备注..."
              value={drawer.content}
              onChange={(e) =>
                setDrawer((prev) => ({ ...prev, content: e.target.value }))
              }
              className="min-h-[120px] resize-none border-slate-200 focus:border-orange-300 focus:ring-orange-200 text-sm"
            />
          </div>

          {/* Drawer Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
