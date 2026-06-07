"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Activity,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DateStockGroup, type DateStockItem } from "@/components/date-stock-group";
import type { CustomDate } from "@/types/custom-date";
import type { StockChangeItem } from "@/hooks/use-stock-changes";

// 历史行情日期分组类型
export interface HistoryDayGroup {
  date: string;
  customDateId: number;
  stocks: DateStockItem[];
}

interface BlockHistoryListProps {
  /** 当前选中的板块，null 则显示占位 */
  selectedBlock: { id: number; name: string } | null;
  /** 历史行情数据 */
  historyData: HistoryDayGroup[];
  /** 是否正在加载 */
  historyLoading: boolean;
  /** 自定义日期列表（用于查找编辑对象） */
  customDates: CustomDate[];
  /** 当前选中的股票 code */
  selectedStockCode: string | null;
  /** 当前选中的股票 date */
  selectedStockDate: string | null;

  // 拖拽排序
  draggingStock: string | null;
  dragOverStock: string | null;
  dragDateId: number | null;

  // 添加日期
  onAddDate: (date: string) => Promise<void>;

  // 删除日期
  onDeleteDate: (dateId: number) => void;

  // 折叠
  collapsedDates: Set<string>;
  onToggleCollapse: (date: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;

  // 选中股票
  onSelectStock: (stock: DateStockItem, date: string) => void;

  // 编辑日期
  onEditDate: (customDate: CustomDate) => void;

  // 拖拽
  onDragStart: (stockCode: string, dateId: number) => void;
  onDragOver: (stockCode: string, dateId: number) => void;
  onDragEnd: () => void;

  // 添加股票到日期
  onAddStock: (dateId: number, stockCode: string, stockName: string) => Promise<boolean>;

  // 更新股票颜色
  onUpdateStockColor: (dateId: number, stockCode: string, color: string) => Promise<boolean>;

  // 添加股票弹窗关闭后刷新数据
  onStocksChanged?: () => void;

  // 异动播报数据
  stockChanges?: StockChangeItem[];
  isTrading?: boolean;
  changesLoading?: boolean;
  changesBlocked?: boolean;
  onRefreshChanges?: () => void;
  ttsEnabled?: boolean;
  onToggleTts?: () => void;
}

export function BlockHistoryList({
  selectedBlock,
  historyData,
  historyLoading,
  customDates,
  selectedStockCode,
  selectedStockDate,
  draggingStock,
  dragOverStock,
  dragDateId,
  onAddDate,
  onDeleteDate,
  collapsedDates,
  onToggleCollapse,
  onCollapseAll,
  onExpandAll,
  onSelectStock,
  onEditDate,
  onDragStart,
  onDragOver,
  onDragEnd,
  onAddStock,
  onUpdateStockColor,
  onStocksChanged,
  stockChanges = [],
  isTrading = false,
  changesLoading = false,
  changesBlocked = false,
  onRefreshChanges,
  ttsEnabled = false,
  onToggleTts,
}: BlockHistoryListProps) {
  // 添加日期相关本地状态
  const [addingDate, setAddingDate] = useState(false);
  const [newDateValue, setNewDateValue] = useState("");

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    const weekday = format(date, "EEEE", { locale: zhCN });
    const formattedDate = format(date, "MM月dd日", { locale: zhCN });
    return `${formattedDate} ${weekday}`;
  };

  const handleAddDate = async () => {
    if (!newDateValue) return;
    await onAddDate(newDateValue);
    setAddingDate(false);
    setNewDateValue("");
  };

  // 异动播报 - 新条目从左滑入，旧条目被推右，始终最新在第一个
  const tickerItems = stockChanges;

  // 跟踪上次已显示的条目 key 列表，用于检测新增
  const prevTickerKeysRef = useRef<string>("");
  // 板块切换时重置，避免首次加载触发滑入动画
  const prevBlockIdRef = useRef<string | number | null>(null);
  // 新条目滑入动画：检测新增条目时触发
  const [newItemKey, setNewItemKey] = useState<string | null>(null);

  useEffect(() => {
    // 板块切换时重置追踪
    const blockId = selectedBlock?.id ?? null;
    if (blockId !== prevBlockIdRef.current) {
      prevBlockIdRef.current = blockId;
      prevTickerKeysRef.current = "";
      setNewItemKey(null);
      return;
    }

    const currentKey = tickerItems.map((item) => `${item.code}_${item.type}`).join("|");
    if (currentKey !== prevTickerKeysRef.current && tickerItems.length > 0 && prevTickerKeysRef.current !== "") {
      // 有新数据变化，找到新增的条目
      const prevKeys = new Set(prevTickerKeysRef.current.split("|").filter(Boolean));
      const newItems = tickerItems.filter((item) => !prevKeys.has(`${item.code}_${item.type}`));
      if (newItems.length > 0) {
        // 触发新条目的滑入动画
        setNewItemKey(`${newItems[0].code}_${newItems[0].type}`);
        // 动画结束后清除
        const timer = setTimeout(() => setNewItemKey(null), 600);
        prevTickerKeysRef.current = currentKey;
        return () => clearTimeout(timer);
      }
    }
    prevTickerKeysRef.current = currentKey;
  }, [tickerItems, selectedBlock?.id]);

  if (!selectedBlock) {
    return (
      <div className="flex-1 lg:min-w-[40%] lg:border-r lg:border-slate-200 bg-white overflow-y-auto relative">
        <div className="flex items-center justify-center h-full text-sm text-slate-400">
          请先选择或创建一个自定义板块
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 lg:min-w-[40%] lg:border-r lg:border-slate-200 bg-white overflow-y-auto relative">
        {/* 异动播报条 - 始终显示 */}
        <div
          className={cn(
            "border-b overflow-hidden",
            changesBlocked ? "border-red-200" : "border-slate-200"
          )}
        >
          <div className="flex items-center gap-1.5 px-3 h-5">
            <Activity className={cn("w-2.5 h-2.5 shrink-0", changesBlocked ? "text-red-500" : isTrading && tickerItems.length > 0 ? "text-amber-500" : "text-slate-400")} />
            <span className={cn("text-[10px] font-medium shrink-0", changesBlocked ? "text-red-500" : "text-slate-500")}>异动</span>
            {changesBlocked && (
              <span className="text-[10px] text-red-500 font-medium shrink-0">请求过频，稍后自动恢复</span>
            )}
            {!isTrading && tickerItems.length === 0 && (
              <span className="text-[10px] text-slate-400 shrink-0">非交易时段</span>
            )}
            {!changesBlocked && changesLoading && (
              <span className="text-[10px] text-slate-400 shrink-0">...</span>
            )}
            {!changesBlocked && (
              <div
                className="flex-1 overflow-hidden relative h-5 flex items-center"
              >
                {tickerItems.length > 0 ? (
                  <div className="flex gap-3 whitespace-nowrap flex items-center">
                    {tickerItems.map((item, i) => {
                      const itemKey = `${item.code}_${item.type}`;
                      const isNew = itemKey === newItemKey;
                      return (
                        <span
                          key={itemKey}
                          className={cn(
                            "inline-flex items-center gap-0.5 text-[10px] px-1",
                            isNew && "animate-ticker-slide-in"
                          )}
                        >
                          <span className="text-slate-500">{item.time}</span>
                          <span className={cn("font-medium", item.changeRate >= 0 ? "text-red-600" : "text-green-600")}>
                            {item.name}
                          </span>
                          <span className="text-amber-600">{item.type}</span>
                          <span className={cn(item.changeRate >= 0 ? "text-red-500" : "text-green-500")}>
                            {item.changeRate >= 0 ? "+" : ""}{(item.changeRate * 100).toFixed(2)}%
                          </span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400">当前板块暂无异动</span>
                )}
              </div>
            )}
            {/* 朗读/静音按钮 */}
            {onToggleTts && (
              <button
                onClick={onToggleTts}
                className={cn("shrink-0 transition-colors", ttsEnabled ? "text-amber-500 hover:text-amber-600" : "text-slate-400 hover:text-slate-600")}
                title={ttsEnabled ? "关闭朗读" : "开启朗读"}
              >
                {ttsEnabled ? (
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>
            )}
            {/* 手动刷新按钮 */}
            {onRefreshChanges && (
              <button
                onClick={onRefreshChanges}
                disabled={changesLoading}
                className="shrink-0 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-40"
                title="刷新异动"
              >
                <svg className={cn("w-2.5 h-2.5", changesLoading && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>

      {/* 板块内容区域 */}
      <div className="p-3">
        {/* 顶部：添加日期按钮 + 操作按钮 */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {/* 添加日期按钮 - 左上角 */}
          {addingDate ? (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={newDateValue}
                onChange={(e) => setNewDateValue(e.target.value)}
                className="h-6 text-xs w-[140px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddDate();
                  if (e.key === "Escape") { setAddingDate(false); setNewDateValue(""); }
                }}
              />
              <Button
                size="sm"
                onClick={handleAddDate}
                disabled={!newDateValue}
                className="h-6 px-2 text-[11px]"
              >
                确定
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAddingDate(false); setNewDateValue(""); }}
                className="h-6 px-1.5 text-slate-400"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingDate(true)}
              className="h-6 px-2 text-[11px] text-slate-600"
            >
              <Plus className="w-3 h-3 mr-1" />
              添加日期
            </Button>
          )}

          <div className="flex-1" />

          {/* 右侧操作按钮 - 始终显示 */}
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={onCollapseAll}
            >
              折叠全部
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={onExpandAll}
            >
              打开全部
            </Button>
          </>
        </div>

        {/* 按日期分组的历史行情 */}
        {historyLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-2" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-8 w-16" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : historyData.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-8">
            暂无数据，请点击左上角"添加日期"
          </div>
        ) : (
          <div className="space-y-4">
            {historyData
              .map((dayGroup) => dayGroup)
              .map((dayGroup) => (
                <DateStockGroup
                  key={dayGroup.date}
                  date={dayGroup.date}
                  customDateId={dayGroup.customDateId}
                  stocks={dayGroup.stocks}
                  collapsed={collapsedDates.has(dayGroup.date)}
                  selectedCode={selectedStockCode}
                  selectedDate={selectedStockDate}
                  draggingStock={draggingStock}
                  dragOverStock={dragOverStock}
                  dragDateId={dragDateId}
                  formatDate={formatDate}
                  customDates={customDates}
                  onToggleCollapse={onToggleCollapse}
                  onEdit={onEditDate}
                  onDelete={onDeleteDate}
                  onSelectStock={(stock) => onSelectStock(stock, dayGroup.date)}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDragEnd={onDragEnd}
                  onAddStock={dayGroup.customDateId ? async (stockCode: string, stockName: string) => {
                    return onAddStock(dayGroup.customDateId, stockCode, stockName);
                  } : undefined}
                  onUpdateStockColor={dayGroup.customDateId ? async (stockCode: string, color: string) => {
                    return onUpdateStockColor(dayGroup.customDateId, stockCode, color);
                  } : undefined}
                  onStocksChanged={onStocksChanged}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}