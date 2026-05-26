"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowLeft,
  TrendingUp,
  SortAsc,
  SortDesc,
  Calendar,
  StickyNote,
  X,
  LogOut,
  Menu,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useNotes } from "@/hooks/use-notes";
import { useBlockDetail } from "@/hooks/use-block-detail";
import { type BlockData, type StockData } from "@/types/block-data";

type SortField = "name" | "latest" | "changeRate" | "continueNum" | "firstLimitUpTime" | "lastLimitUpTime";
type SortDir = "asc" | "desc";

const SortableHeader = ({
  field,
  label,
  currentField,
  currentDir,
  onSort,
  justify = "start"
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  justify?: "start" | "end";
}) => {
  const isActive = currentField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-50 select-none",
        justify === "end" ? "text-right" : "text-left"
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <SortAsc className="w-3 h-3 text-orange-600" />
          ) : (
            <SortDesc className="w-3 h-3 text-orange-600" />
          )
        ) : (
          <span className="w-3 h-3" />
        )}
      </span>
    </th>
  );
};

export default function BlockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const { authenticated, username, loading: authLoading, logout } = useAuth();
  const { data, loading, error, hasMore, loadMore, allBlocks } = useBlockDetail(code);
  const { notes, loading: notesLoading, saveNote, getNote, preloadNotes } = useNotes();

  // 所有去重板块列表，按字母排序
  const uniqueBlocks = useMemo(() => {
    const blockMap = new Map<string, { code: string; name: string }>();
    allBlocks.forEach(block => {
      if (!blockMap.has(block.code)) {
        blockMap.set(block.code, { code: block.code, name: block.name });
      }
    });
    return Array.from(blockMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allBlocks]);

  // 板块切换drawer状态
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);

  // 备注drawer状态
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false);
  const [currentNoteStock, setCurrentNoteStock] = useState<{
    stock: StockData;
    date: string;
    blockName: string;
  } | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // 排序状态
  const [sortField, setSortField] = useState<SortField>("changeRate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // 登录检查
  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push("/");
    }
  }, [authLoading, authenticated, router]);

  // 预加载所有备注
  useEffect(() => {
    if (data.length > 0 && authenticated && username) {
      const stockKeyList: Array<{ stockCode: string; stockDate: string }> = [];
      data.forEach(dayData => {
        dayData.stocks.forEach(stock => {
          stockKeyList.push({ stockCode: stock.code, stockDate: dayData.date });
        });
      });
      preloadNotes(stockKeyList);
    }
  }, [data, authenticated, username, preloadNotes]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const sortStocks = useCallback((stocks: StockData[]) => {
    return [...stocks].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (sortField) {
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "latest":
          aVal = a.latest;
          bVal = b.latest;
          break;
        case "changeRate":
          aVal = a.changeRate;
          bVal = b.changeRate;
          break;
        case "continueNum":
          aVal = a.continueNum;
          bVal = b.continueNum;
          break;
        case "firstLimitUpTime":
          aVal = a.firstLimitUpTime;
          bVal = b.firstLimitUpTime;
          break;
        case "lastLimitUpTime":
          aVal = a.lastLimitUpTime;
          bVal = b.lastLimitUpTime;
          break;
      }
      if (typeof aVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [sortField, sortDir]);

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const weekday = format(date, "EEEE", { locale: zhCN });
      const formattedDate = format(date, "yyyy年MM月dd日", { locale: zhCN });
      return `${formattedDate} ${weekday}`;
    } catch {
      return dateStr;
    }
  };

  const openNoteDrawer = (stock: StockData, date: string, blockName: string) => {
    const existingNote = getNote(stock.code, date);
    setCurrentNoteStock({ stock, date, blockName });
    setNoteContent(existingNote || "");
    setNoteDrawerOpen(true);
  };

  const handleSaveNote = async () => {
    if (!currentNoteStock || !username) return;
    setSavingNote(true);
    try {
      await saveNote(currentNoteStock.stock.code, currentNoteStock.date, noteContent);
      setNoteDrawerOpen(false);
      setCurrentNoteStock(null);
    } catch (err) {
      console.error("保存备注失败", err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleBlockSelect = (selectedCode: string) => {
    setBlockPickerOpen(false);
    router.push(`/block-history/${selectedCode}`);
  };

  const currentBlockName = useMemo(() => {
    if (data.length > 0) {
      return data[0].block.name;
    }
    const block = uniqueBlocks.find(b => b.code === code);
    return block ? block.name : code;
  }, [data, uniqueBlocks, code]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-slate-500 hover:text-slate-900 h-8 w-8 p-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <h1 className="text-lg font-bold text-slate-900">{currentBlockName}</h1>
                <Sheet open={blockPickerOpen} onOpenChange={setBlockPickerOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-slate-700">
                      <ChevronDown className="w-3.5 h-3.5 mr-1" />
                      切换板块
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[320px] sm:w-[400px]">
                    <SheetHeader>
                      <SheetTitle>选择板块</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 max-h-[calc(100vh-120px)] overflow-y-auto">
                      <div className="space-y-1">
                        {uniqueBlocks.map((block) => (
                          <button
                            key={block.code}
                            onClick={() => handleBlockSelect(block.code)}
                            className={cn(
                              "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors",
                              block.code === code
                                ? "bg-orange-50 text-orange-700 font-medium"
                                : "hover:bg-slate-100 text-slate-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{block.name}</span>
                              <span className="text-xs text-slate-400 font-mono">{block.code}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {authenticated && username && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{username}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-slate-400 hover:text-red-500 h-7 w-7 p-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            加载失败: {error.message}
          </div>
        )}

        <div className="space-y-8">
          {data.map((dayData) => {
            const sortedStocks = sortStocks(dayData.stocks);
            return (
              <div key={dayData.date}>
                {/* Date and Summary */}
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">
                    {formatDate(dayData.date)}
                  </span>
                  <span className="text-xs text-slate-400">
                    涨停{dayData.block.limitUpNum} · 连板{dayData.block.continuousPlateNum} · 最高{dayData.block.high}
                  </span>
                </div>

                {/* Stock Table */}
                <div className="bg-white border border-slate-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <SortableHeader
                          field="name"
                          label="股票名称"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          field="latest"
                          label="最新价"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                          justify="end"
                        />
                        <SortableHeader
                          field="changeRate"
                          label="涨幅"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                          justify="end"
                        />
                        <SortableHeader
                          field="continueNum"
                          label="板数"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                          justify="end"
                        />
                        <SortableHeader
                          field="firstLimitUpTime"
                          label="首封"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                          justify="end"
                        />
                        <SortableHeader
                          field="lastLimitUpTime"
                          label="末封"
                          currentField={sortField}
                          currentDir={sortDir}
                          onSort={handleSort}
                          justify="end"
                        />
                        <th className="px-2 py-1.5 text-xs font-medium text-slate-500 text-center w-16">
                          备注
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedStocks.map((stock) => {
                        const note = getNote(stock.code, dayData.date);
                        return (
                          <tr key={stock.code} className="hover:bg-slate-50/50">
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm text-slate-900 truncate max-w-[120px]">
                                  {stock.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {stock.code}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono text-sm text-slate-700">
                                {stock.latest.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span
                                className={cn(
                                  "font-mono text-sm",
                                  stock.changeRate > 0
                                    ? "text-red-600"
                                    : stock.changeRate < 0
                                    ? "text-green-600"
                                    : "text-slate-400"
                                )}
                              >
                                {stock.changeRate > 0 ? "+" : ""}
                                {stock.changeRate.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="text-sm">
                                <span className={cn(
                                  "font-mono",
                                  stock.continueNum === 1
                                    ? "text-slate-500"
                                    : "text-purple-600 font-medium"
                                )}>
                                  {stock.continueNum}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-0.5">板</span>
                              </span>
                              {stock.high && stock.high !== "0" && (
                                <span className="text-[10px] text-slate-400 ml-1">
                                  /{stock.high}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono text-xs text-slate-500">
                                {stock.firstLimitUpTime}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="font-mono text-xs text-slate-500">
                                {stock.lastLimitUpTime}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => openNoteDrawer(stock, dayData.date, dayData.block.name)}
                                className="inline-flex items-center justify-center h-6 px-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                              >
                                {note ? (
                                  <span className="text-xs text-slate-700 truncate max-w-[60px]" title={note}>
                                    {note.length > 8 ? note.substring(0, 8) + "…" : note}
                                  </span>
                                ) : (
                                  <StickyNote className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="mt-6 bg-white border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-40" />
                  <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-20" />
                  <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-20" />
                  <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-24" />
                  <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-20" />
                  <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-20" />
                  <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Skeleton className="h-4 w-10" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Skeleton className="h-4 w-10" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More */}
        <div className="mt-6 py-4 flex justify-center">
          {hasMore && !loading && (
            <Button
              onClick={loadMore}
              variant="outline"
              size="sm"
              className="text-slate-600 border-slate-200"
            >
              <Menu className="w-3.5 h-3.5 mr-1.5" />
              加载更多
            </Button>
          )}
          {!hasMore && data.length > 0 && (
            <div className="text-xs text-slate-400">已加载全部数据</div>
          )}
        </div>

        {/* Initial Loading */}
        {loading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-slate-400">加载中...</p>
          </div>
        )}
      </main>

      {/* Note Drawer */}
      <Drawer open={noteDrawerOpen} onOpenChange={setNoteDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {currentNoteStock && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{currentNoteStock.stock.name}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    {currentNoteStock.stock.code}
                  </span>
                  <span className="text-xs text-slate-400">
                    {currentNoteStock.date}
                  </span>
                </div>
              )}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="输入备注内容..."
              className="min-h-[120px] resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNoteDrawerOpen(false)}
                disabled={savingNote}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {savingNote ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
