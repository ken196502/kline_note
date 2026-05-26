"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, TrendingUp, RefreshCw, Clock, X, Save, StickyNote } from "lucide-react";
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

  // 未登录时跳转
  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push("/");
    }
  }, [authLoading, authenticated, router]);

  // 初始加载
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

  // 加载更多
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

  // 点击股票打开备注drawer
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-8 w-40" />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-80" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">加载失败或板块不存在</p>
          <Link href="/block-history">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回列表
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/block-history">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg hover:bg-slate-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {blockName}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {data.map((dayData) => (
            <div key={dayData.date}>
              {/* Date Summary Line */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <span className="font-semibold text-slate-800">
                  {formatDate(dayData.date)}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-orange-700 font-medium">
                  涨停{dayData.block.limitUpNum}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-red-600 font-medium">
                  连板{dayData.block.continuousPlateNum}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-purple-700 font-medium">
                  最高{dayData.block.high || `${dayData.block.continuousPlateNum}天${dayData.block.continuousPlateNum}板`}
                </span>
              </div>

              {/* Stock Table */}
              <Card className="overflow-hidden border-0 shadow-lg shadow-slate-900/5">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="font-semibold text-slate-600 pl-5 h-10">
                        股票名称
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600">
                        最新价
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600">
                        涨幅
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600">
                        板数
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          首次涨停
                        </div>
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          最后涨停
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayData.stocks.map((stock) => (
                      <TableRow
                        key={stock.code}
                        className="hover:bg-orange-50/50 transition-colors cursor-pointer"
                        onClick={() => handleStockClick(stock, dayData.date)}
                      >
                        <TableCell className="pl-5 py-3">
                          <div className="flex items-center gap-2">
                            <StickyNote className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-900 text-sm">
                                {stock.name}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {stock.code}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-sm">
                          {stock.latest.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-red-600 text-sm">
                            {stock.changeRate > 0 ? "+" : ""}
                            {stock.changeRate.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-semibold text-xs",
                              stock.continueNum >= 3
                                ? "border-red-300 text-red-700 bg-red-50"
                                : stock.continueNum >= 2
                                ? "border-orange-300 text-orange-700 bg-orange-50"
                                : "border-slate-200 text-slate-600"
                            )}
                          >
                            {stock.high || `${stock.continueNum}板`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-500 font-mono">
                          {stock.firstLimitUpTime || "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-500 font-mono pr-5">
                          {stock.lastLimitUpTime || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {dayData.stocks.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-20 text-center text-slate-400"
                        >
                          暂无涨停个股
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-8 py-6 flex justify-center">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          )}
          {hasMore && !isLoadingMore && (
            <Button
              onClick={loadMore}
              variant="outline"
              className="px-6 py-4 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-md"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              加载更多
            </Button>
          )}
          {!hasMore && data.length > 0 && (
            <div className="text-center text-slate-400 text-sm">
              已加载全部历史数据
            </div>
          )}
        </div>
      </main>

      {/* Note Drawer - Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-0 z-[100] transition-all duration-300",
          drawer.open ? "visible" : "invisible"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-300",
            drawer.open ? "opacity-100" : "opacity-0"
          )}
          onClick={handleCancel}
        />

        {/* Drawer */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 max-h-[70vh] flex flex-col",
            drawer.open ? "translate-y-0" : "translate-y-full"
          )}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-orange-100 rounded-lg">
                <StickyNote className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">
                  {drawer.stockName}
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {drawer.stockCode} · {drawer.stockDate}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
              onClick={handleCancel}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5">
            <Textarea
              placeholder="添加备注..."
              value={drawer.content}
              onChange={(e) =>
                setDrawer((prev) => ({ ...prev, content: e.target.value }))
              }
              className="min-h-[150px] resize-none border-slate-200 focus:border-orange-300 focus:ring-orange-200 text-sm"
            />
          </div>

          {/* Drawer Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="px-6"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="px-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
