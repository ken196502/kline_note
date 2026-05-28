"use client";

import {
  Calendar,
  ChevronDown,
  Edit3,
  Trash2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CustomDate } from "@/types/custom-date";

export interface DateStockItem {
  code: string;
  name: string;
  latest: number;
  changeRate: number;
  marketType: string;
  source: "limitUp" | "nonLimitUp";
  sourceBlockName?: string;
  timePreview?: number[];
  hasPrice?: boolean;
  remark?: string;
}

interface DateStockGroupProps {
  /** 日期字符串 YYYY-MM-DD */
  date: string;
  /** custom_dates 表的 id */
  customDateId: number;
  /** 该日期下的股票列表 */
  stocks: DateStockItem[];
  /** 是否折叠 */
  collapsed: boolean;
  /** 当前选中的股票 code + date */
  selectedCode: string | null;
  selectedDate: string | null;
  /** 拖动排序状态 */
  draggingStock: string | null;
  dragOverStock: string | null;
  dragDateId: number | null;
  /** 格式化日期的函数 */
  formatDate: (dateStr: string) => string;
  /** customDates 列表（用于查找编辑对象） */
  customDates: CustomDate[];
  /** 切换折叠 */
  onToggleCollapse: (date: string) => void;
  /** 点击编辑 */
  onEdit: (customDate: CustomDate) => void;
  /** 点击删除日期 */
  onDelete: (customDateId: number) => void;
  /** 选中股票 */
  onSelectStock: (stock: DateStockItem) => void;
  /** 拖动开始 */
  onDragStart: (stockCode: string, dateId: number) => void;
  /** 拖动经过 */
  onDragOver: (stockCode: string, dateId: number) => void;
  /** 拖动结束 */
  onDragEnd: () => void;
}

export function DateStockGroup({
  date,
  customDateId,
  stocks,
  collapsed,
  selectedCode,
  selectedDate,
  draggingStock,
  dragOverStock,
  dragDateId,
  formatDate,
  customDates,
  onToggleCollapse,
  onEdit,
  onDelete,
  onSelectStock,
  onDragStart,
  onDragOver,
  onDragEnd,
}: DateStockGroupProps) {
  const isSelected = (code: string) => selectedCode === code && selectedDate === date;

  return (
    <div>
      {/* 日期标题 - 可点击折叠 */}
      <div
        className="flex items-center gap-1.5 mb-2 cursor-pointer select-none group"
        onClick={() => onToggleCollapse(date)}
      >
        <ChevronDown
          className={cn(
            "w-3 h-3 text-slate-400 transition-transform",
            collapsed && "-rotate-90"
          )}
        />
        <Calendar className="w-3 h-3 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">
          {formatDate(date)}
        </span>
        <span className="text-[10px] text-slate-400">
          {stocks.length}只
        </span>
        {/* 编辑日期按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            const cd = customDates.find((d) => d.id === customDateId);
            if (cd) onEdit(cd);
          }}
          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-orange-600 shrink-0"
        >
          <Edit3 className="w-3 h-3" />
        </Button>
        {/* 删除日期按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (customDateId) onDelete(customDateId);
          }}
          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* 该日期下的股票列表 - 支持拖动排序 */}
      {!collapsed && (
        <div className="flex flex-wrap gap-1.5">
          {stocks.map((stock) => (
            <div
              key={`${date}-${stock.code}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", stock.code);
                onDragStart(stock.code, customDateId);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                onDragOver(stock.code, customDateId);
              }}
              onDragEnd={onDragEnd}
              onClick={() => onSelectStock(stock)}
              className={cn(
                "w-[140px] shrink-0 flex flex-col px-2 py-1 border cursor-grab active:cursor-grabbing hover:bg-orange-50/50 transition-colors text-xs",
                !stock.hasPrice && "border-dashed border-slate-200/60",
                isSelected(stock.code) &&
                  "bg-orange-50/60 border-orange-200 border-solid",
                draggingStock === stock.code && "opacity-50",
                dragOverStock === stock.code &&
                  dragDateId === customDateId &&
                  "border-orange-400 border-solid"
              )}
            >
              <div className="flex items-center gap-1">
                <GripVertical className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                <span
                  className={cn(
                    "font-medium truncate",
                    isSelected(stock.code)
                      ? "text-orange-700"
                      : "text-slate-900"
                  )}
                >
                  {stock.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {stock.code}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {stock.hasPrice ? (
                  <>
                    <span className="font-mono text-[11px] text-slate-600">
                      {stock.latest.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[11px]",
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
                  </>
                ) : (
                  <span className="font-mono text-[11px] text-slate-300">
                    --
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}