"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  X,
  Filter,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DateStockGroup, type DateStockItem } from "@/components/date-stock-group";
import { StockHistorySearch } from "@/components/stock-history-search";
import type { CustomDate } from "@/types/custom-date";

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

  // 批量编辑模式
  editMode?: boolean;
  checkedStocks?: Set<string>;
  broadcastStocks?: Set<string>;
  broadcastItems?: { code: string; name: string; blockName: string }[];
  onToggleStockCheck?: (dateId: number, stockCode: string) => void;
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
  editMode = false,
  checkedStocks = new Set(),
  broadcastStocks = new Set(),
  broadcastItems = [],
  onToggleStockCheck,
}: BlockHistoryListProps) {
  const [addingDate, setAddingDate] = useState(false);
  const [newDateValue, setNewDateValue] = useState("");
  // 筛选状态
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterDays, setFilterDays] = useState(1);

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

  const handleJumpToDate = useCallback(
    (stockCode: string, date: string) => {
      if (collapsedDates.has(date)) {
        onToggleCollapse(date);
      }
      const group = historyData.find((g) => g.date === date);
      const stock = group?.stocks.find((s) => s.code === stockCode);
      if (!stock) return;

      // 等待折叠展开后再滚动和选中
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.getElementById(`history-date-${date}`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
          onSelectStock(stock, date);
        }, 80);
      });
    },
    [collapsedDates, historyData, onToggleCollapse, onSelectStock]
  );

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
      {/* 板块内容区域 */}
      <div className="p-3">
        {/* 顶部：添加日期按钮 + 操作按钮 */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {/* 添加日期按钮 - 左上角 */}
          {!editMode && (addingDate ? (
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
          ))}

          <div className="flex-1" />

          {/* 右侧操作按钮 - 非编辑模式显示 */}
          {!editMode && (
          <>
            <StockHistorySearch
              historyData={historyData}
              onJumpToDate={handleJumpToDate}
            />
            <Popover onOpenChange={(open) => setFilterOpen(open)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-6 px-2 text-[11px]", filterOpen && "border-orange-400 text-orange-600")}
                >
                  <Filter className="w-3 h-3 mr-1" />
                  筛选
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[180px] p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    checked={filterEnabled}
                    onCheckedChange={(checked) => setFilterEnabled(checked === true)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs text-slate-600 select-none">{filterEnabled ? "≥" : "="}</span>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums w-4 text-center">
                    {filterDays}
                  </span>
                  <span className="text-xs text-slate-500 select-none">天</span>
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[filterDays]}
                  onValueChange={(v) => setFilterDays(v[0])}
                  className="w-full"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-400">1</span>
                  <span className="text-[10px] text-slate-400">10</span>
                </div>
              </PopoverContent>
            </Popover>
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
          )}
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
                  editMode={editMode}
                  checkedStocks={checkedStocks}
                  broadcastStocks={broadcastStocks}
                  broadcastItems={broadcastItems}
                  onToggleStockCheck={onToggleStockCheck}
                  filterDaysInBlock={filterOpen ? { min: filterDays, gte: filterEnabled } : undefined}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}