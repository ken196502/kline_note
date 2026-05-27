"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { pinyin } from "pinyin-pro";
import {
  ArrowLeft,
  TrendingUp,
  SortAsc,
  SortDesc,
  Calendar,
  StickyNote,
  LogOut,
  ChevronDown,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useNotes } from "@/hooks/use-notes";
import { useBlockDetail } from "@/hooks/use-block-detail";
import { type BlockData, type StockData } from "@/types/block-data";
import { TimePreviewChart } from "@/components/time-preview-chart";
import { StockDetailPanel, type StockDetailInfo } from "@/components/stock-detail-panel";

type SortField =
  | "name"
  | "latest"
  | "changeRate"
  | "continueNum"
  | "firstLimitUpTime"
  | "lastLimitUpTime";
type SortDir = "asc" | "desc";

const SortableHeader = ({
  field,
  label,
  currentField,
  currentDir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) => {
  const isActive = currentField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={cn(
        "px-1 py-1 text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-50 select-none text-left",
        className
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
  const { data, loading, error, hasMore, loadMore, allBlocks } =
    useBlockDetail(code);
  const { saveNote, getNote, preloadNotes } =
    useNotes();

  // 当前选中的股票（用于右侧面板）
  const [selectedStock, setSelectedStock] = useState<StockDetailInfo | null>(null);

  // 股票详情抽屉状态（lg以下使用）
  const [stockDetailOpen, setStockDetailOpen] = useState(false);

  // 外部触发打开备注的计数器
  const [openNoteRequest, setOpenNoteRequest] = useState(0);

  // 按拼音首字母分组的板块列表（类似通讯录）
  const groupedBlocks = useMemo(() => {
    const blockMap = new Map<string, { code: string; name: string }>();
    allBlocks.forEach((block) => {
      if (!blockMap.has(block.code)) {
        blockMap.set(block.code, { code: block.code, name: block.name });
      }
    });

    // 按拼音排序
    const sortedBlocks = Array.from(blockMap.values()).sort((a, b) => {
      const pinyinA = pinyin(a.name, {
        pattern: "first",
        toneType: "none",
      }).toLowerCase();
      const pinyinB = pinyin(b.name, {
        pattern: "first",
        toneType: "none",
      }).toLowerCase();
      return pinyinA.localeCompare(pinyinB);
    });

    // 按拼音首字母分组
    const groups: {
      [key: string]: Array<{ code: string; name: string }>;
    } = {};
    sortedBlocks.forEach((block) => {
      const firstLetter = pinyin(block.name, {
        pattern: "first",
        toneType: "none",
      })
        .charAt(0)
        .toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(block);
    });
    return groups;
  }, [allBlocks]);

  // 首字母分组的排序键
  const groupKeys = useMemo(() => {
    return Object.keys(groupedBlocks).sort((a, b) => a.localeCompare(b));
  }, [groupedBlocks]);

  // 板块切换drawer状态
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);

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
      data.forEach((dayData) => {
        dayData.stocks.forEach((stock) => {
          stockKeyList.push({ stockCode: stock.code, stockDate: dayData.date });
        });
      });
      preloadNotes(stockKeyList);
    }
  }, [data, authenticated, username, preloadNotes]);

  // 默认选中第一个股票
  useEffect(() => {
    if (!selectedStock && data.length > 0 && data[0].stocks.length > 0) {
      const firstStock = data[0].stocks[0];
      setSelectedStock({
        code: firstStock.code,
        name: firstStock.name,
        marketType: firstStock.marketType,
        date: data[0].date,
        blockName: data[0].block.name,
      });
    }
  }, [data, selectedStock]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  const sortStocks = useCallback(
    (stocks: StockData[]) => {
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
          return sortDir === "asc"
            ? aVal.localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal);
        }
        return sortDir === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    },
    [sortField, sortDir]
  );

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

  const handleBlockSelect = (selectedCode: string) => {
    setBlockPickerOpen(false);
    router.push(`/block-history/${selectedCode}`);
  };

  const currentBlockName = useMemo(() => {
    if (data.length > 0) {
      return data[0].block.name;
    }
    const block = allBlocks.find((b) => b.code === code);
    return block ? block.name : code;
  }, [data, allBlocks, code]);

  // 初始加载中（没有数据时的loading）
  const isInitialLoading = loading && data.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/block-history")}
                className="text-slate-500 hover:text-slate-900 h-8 w-8 p-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <h1 className="text-lg font-bold text-slate-900">
                  {currentBlockName}
                </h1>
                <Sheet
                  open={blockPickerOpen}
                  onOpenChange={setBlockPickerOpen}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-400 hover:text-slate-700"
                    >
                      <ChevronDown className="w-3.5 h-3.5 mr-1" />
                      切换板块
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-[320px] sm:w-[400px]"
                  >
                    <SheetHeader>
                      <SheetTitle>选择板块</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 max-h-[calc(100vh-120px)] overflow-y-auto">
                      <div className="space-y-2">
                        {groupKeys.map((letter) => (
                          <div key={letter} className="space-y-1">
                            <div className="px-2 py-1 text-xs font-semibold text-slate-400 bg-slate-100 rounded-sm">
                              {letter}
                            </div>
                            <div className="space-y-0.5">
                              {groupedBlocks[letter].map((block) => (
                                <button
                                  key={block.code}
                                  onClick={() =>
                                    handleBlockSelect(block.code)
                                  }
                                  className={cn(
                                    "w-full text-left px-2 py-1.5 text-sm rounded transition-colors",
                                    block.code === code
                                      ? "bg-orange-50 text-orange-700 font-medium"
                                      : "hover:bg-slate-50 text-slate-700"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="truncate">
                                      {block.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {block.code}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
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

      {/* Main Content - 左右两列布局 */}
      <main className="flex h-[calc(100vh-57px)]">
        {/* 左侧 - 个股列表 */}
        <div className="flex-1 lg:min-w-[50%] lg:border-r lg:border-slate-200 bg-white overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
              加载失败: {error.message}
            </div>
          )}

          {/* 初始加载中 */}
          {isInitialLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
              <p className="mt-3 text-sm text-slate-400">
                正在加载 {currentBlockName} 数据...
              </p>
            </div>
          )}

          <div className="space-y-6 p-4">
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
                      涨停{dayData.block.limitUpNum} · 连板
                      {dayData.block.continuousPlateNum} · 最高
                      {dayData.block.high}
                    </span>
                  </div>

                  {/* Stock Table */}
                  <div className="bg-white border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <SortableHeader
                            field="name"
                            label="股票"
                            currentField={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                            className="w-28"
                          />
                          <SortableHeader
                            field="latest"
                            label="最新价"
                            currentField={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                            className="w-[114px]"
                          />
                          <SortableHeader
                            field="changeRate"
                            label="涨幅"
                            currentField={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                            className="w-[114px]"
                          />
                          <SortableHeader
                            field="continueNum"
                            label="板数"
                            currentField={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                            className="w-[130px]"
                          />
                          <th className="px-1 py-1 text-xs font-medium text-slate-500 text-left w-32">
                            分时
                          </th>
                          <th className="px-1 py-1 text-xs font-medium text-slate-500 text-left">
                            备注
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedStocks.map((stock) => {
                          const note = getNote(stock.code, dayData.date);
                          const isSelected =
                            selectedStock?.code === stock.code;
                          return (
                            <tr
                              key={stock.code}
                              onClick={() => {
                                setSelectedStock({
                                  code: stock.code,
                                  name: stock.name,
                                  marketType: stock.marketType,
                                  date: dayData.date,
                                  blockName: dayData.block.name,
                                });
                                // lg以下打开抽屉
                                if (window.innerWidth < 1024) {
                                  setStockDetailOpen(true);
                                }
                              }}
                              className={cn(
                                "hover:bg-slate-50/50 cursor-pointer transition-colors",
                                isSelected && "bg-orange-50/60"
                              )}
                            >
                              <td className="px-1 py-1.5">
                                <div className="flex items-center gap-1">
                                  <span
                                    className={cn(
                                      "font-medium text-sm truncate",
                                      isSelected
                                        ? "text-orange-700"
                                        : "text-slate-900"
                                    )}
                                  >
                                    {stock.name}
                                  </span>
                                  <span className="text-[10px] text-slate-600 font-mono">
                                    {stock.code}
                                  </span>
                                </div>
                              </td>
                              <td className="px-1 py-1.5">
                                <span className="font-mono text-sm text-slate-700">
                                  {stock.latest.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-1 py-1.5">
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
                              <td className="px-1 py-1.5">
                                <span className="text-sm">
                                  <span
                                    className={cn(
                                      "font-mono",
                                      stock.continueNum === 1
                                        ? "text-slate-500"
                                        : "text-purple-600 font-medium"
                                    )}
                                  >
                                    {stock.continueNum}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-0.5">
                                    板
                                  </span>
                                </span>
                                {stock.high && stock.high !== "0" && (
                                  <span className="text-[10px] text-slate-400 ml-0.5">
                                    /{stock.high}
                                  </span>
                                )}
                              </td>
                              <td className="px-1 py-1.5">
                                <TimePreviewChart data={stock.timePreview} />
                              </td>
                              <td className="px-1 py-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStock({
                                      code: stock.code,
                                      name: stock.name,
                                      marketType: stock.marketType,
                                      date: dayData.date,
                                      blockName: dayData.block.name,
                                    });
                                    setOpenNoteRequest((n) => n + 1);
                                  }}
                                  className="inline-flex items-center justify-center h-5 px-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                >
                                  {note ? (
                                    <span
                                      className="text-xs text-slate-700 truncate"
                                      title={note}
                                    >
                                      {note.length > 10
                                        ? note.substring(0, 10) + "…"
                                        : note}
                                    </span>
                                  ) : (
                                    <StickyNote className="w-3 h-3" />
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

          {/* Loading - 加载更多时的骨架屏 */}
          {loading && data.length > 0 && (
            <div className="p-4">
              <div className="bg-white border border-slate-200 overflow-x-auto">
                <div className="px-4 py-3 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-28" />
                      <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-14" />
                      <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-14" />
                      <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-16" />
                      <th className="px-2 py-1.5 text-xs font-medium text-slate-500 w-32" />
                      <th className="px-2 py-1.5 text-xs font-medium text-slate-500" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-1 py-1">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-1 py-1">
                          <Skeleton className="h-4 w-10" />
                        </td>
                        <td className="px-1 py-1">
                          <Skeleton className="h-4 w-10" />
                        </td>
                        <td className="px-1 py-1">
                          <Skeleton className="h-4 w-12" />
                        </td>
                        <td className="px-1 py-1">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-1 py-1">
                          <Skeleton className="h-4 w-6" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Load More */}
          <div className="py-4 flex justify-center">
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
        </div>

        <StockDetailPanel
          selectedStock={selectedStock}
          getNote={getNote}
          saveNote={saveNote}
          formatDate={formatDate}
          username={username}
          noteHeightClass="h-42"
          emptyText="点击左侧个股查看详情"
          stockDetailOpen={stockDetailOpen}
          setStockDetailOpen={setStockDetailOpen}
          openNoteRequest={openNoteRequest}
        />
      </main>
    </div>
  );
}