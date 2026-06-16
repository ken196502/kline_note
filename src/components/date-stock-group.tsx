"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  Edit3,
  Trash2,
  GripVertical,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CustomDate } from "@/types/custom-date";
import { AddStockDialog } from "@/components/add-stock-dialog";

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
  nameColor?: string; // 股票名称字体颜色
  daysInBlock?: number; // 该股票在板块中录入的天数
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
  /** 添加股票到日期 */
  onAddStock?: (stockCode: string, stockName: string) => Promise<boolean>;
  /** 更新股票名称颜色 */
  onUpdateStockColor?: (stockCode: string, color: string) => Promise<boolean>;
  /** 添加股票弹窗关闭后刷新数据 */
  onStocksChanged?: () => void;

  // 批量编辑模式
  editMode?: boolean;
  checkedStocks?: Set<string>;
  broadcastStocks?: Set<string>;
  broadcastItems?: { code: string; name: string; blockName: string }[];
  onToggleStockCheck?: (dateId: number, stockCode: string) => void;
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
  onAddStock,
  onUpdateStockColor,
  onStocksChanged,
  editMode = false,
  checkedStocks = new Set(),
  broadcastStocks = new Set(),
  broadcastItems = [],
  onToggleStockCheck,
}: DateStockGroupProps) {
  const isSelected = (code: string) => selectedCode === code && selectedDate === date;

  // 删除日期二次确认
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // 添加股票弹窗
  const [addStockOpen, setAddStockOpen] = useState(false);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    stockCode: string;
    stockName: string;
    currentColor: string;
  } | null>(null);

  // 可选的颜色列表
  const colorOptions = [
    { label: "默认", value: "" },
    { label: "红色", value: "#dc2626" },
    { label: "蓝色", value: "#2563eb" },
    { label: "绿色", value: "#16a34a" },
    { label: "紫色", value: "#9333ea" },
    { label: "橙色", value: "#ea580c" },
    { label: "粉色", value: "#db2777" },
    { label: "青色", value: "#0891b2" },
    { label: "灰色", value: "#6b7280" },
  ];

  const handleContextMenu = (e: React.MouseEvent, stock: DateStockItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      stockCode: stock.code,
      stockName: stock.name,
      currentColor: stock.nameColor || "",
    });
  };

  const handleColorSelect = async (color: string) => {
    if (!contextMenu || !onUpdateStockColor) return;
    setContextMenu(null);
    await onUpdateStockColor(contextMenu.stockCode, color);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (customDateId) setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    setDeleteConfirmOpen(false);
    onDelete(customDateId);
  };

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
          onClick={handleDeleteClick}
          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* 该日期下的股票列表 - 支持拖动排序 */}
      {!collapsed && (
        <div className="flex flex-wrap gap-1">
          {stocks.map((stock) => {
            const isChecked = checkedStocks.has(stock.code);
            return (
            <div
              key={`${date}-${stock.code}`}
              draggable={!editMode}
              onDragStart={editMode ? undefined : (e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", stock.code);
                onDragStart(stock.code, customDateId);
              }}
              onDragOver={editMode ? undefined : (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                onDragOver(stock.code, customDateId);
              }}
              onDragEnd={editMode ? undefined : onDragEnd}
              onClick={editMode && onToggleStockCheck ? () => onToggleStockCheck(customDateId, stock.code) : () => onSelectStock(stock)}
              onContextMenu={editMode ? undefined : (e) => handleContextMenu(e, stock)}
              className={cn(
                "w-[120px] h-8 shrink-0 flex items-stretch border hover:bg-orange-50/50 transition-colors text-xs cursor-pointer relative",
                !stock.hasPrice && "border-dashed border-slate-200/60",
                isSelected(stock.code) &&
                  "bg-orange-50/60 border-orange-200 border-solid",
                draggingStock === stock.code && "opacity-50",
                dragOverStock === stock.code &&
                  dragDateId === customDateId &&
                  "border-orange-400 border-solid",
                editMode && isChecked && "border-blue-400 border-solid",
                editMode && !isChecked && "opacity-40 bg-slate-50 border-slate-300 border-dashed",
              )}
            >
              {/* 板块录入天数 - 右上角灰色小字 */}
              {stock.daysInBlock != null && stock.daysInBlock > 0 && (
                <span className="absolute top-0 right-0.5 text-[9px] text-slate-500 leading-none select-none">
                  {stock.daysInBlock}
                </span>
              )}
              {/* 编辑模式勾选指示器 */}
              {editMode && (
                <div className="flex items-center pl-1.5 pr-0.5">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-sm border flex items-center justify-center transition-colors",
                      isChecked
                        ? "bg-blue-500 border-blue-500"
                        : "border-slate-300 bg-white"
                    )}
                  >
                    {isChecked && (
                      <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
              {/* 左侧拖动区域 - 编辑模式隐藏 */}
              {!editMode && (
              <div
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
                className="flex items-center cursor-grab active:cursor-grabbing px-0.5 border-r border-slate-100"
              >
                <GripVertical className="w-2.5 h-2.5 text-slate-300" />
              </div>
              )}
              {/* 右侧股票信息 */}
              <div
                className="flex-1 flex flex-col justify-center px-1.5 py-1"
                onClick={editMode ? undefined : () => onSelectStock(stock)}
              >
                <div className="flex items-center">
                  <span
                    className={cn(
                      "truncate",
                      editMode && !isChecked && "text-slate-400",
                      !editMode && broadcastStocks.has(stock.code) && "font-bold",
                      stock.nameColor ? "" : "text-slate-900"
                    )}
                    style={stock.nameColor ? { color: stock.nameColor } : undefined}
                  >
                    {stock.name}
                  </span>
                  {stock.hasPrice ? (
                    <span
                      className={cn(
                        "text-[11px] shrink-0",
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
                  ) : (
                    <span className="font-mono text-[10px] text-slate-300 shrink-0">--</span>
                  )}
                </div>
              </div>
            </div>
            );
          })}
          {/* 小加号：快速添加股票 */}
          {onAddStock && (
            <button
              onClick={() => setAddStockOpen(true)}
              className="shrink-0 flex items-center justify-center w-6 h-6 text-slate-300 hover:text-orange-500 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 删除日期确认弹窗 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除日期</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 {formatDate(date)} 吗？删除后该日期下的所有股票数据也将被清除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加股票弹窗 */}
      {onAddStock && (
        <AddStockDialog
          open={addStockOpen}
          onOpenChange={(nextOpen) => {
            setAddStockOpen(nextOpen);
            if (!nextOpen) onStocksChanged?.();
          }}
          existingStockCodes={stocks.map((s) => s.code)}
          onAddStock={onAddStock}
        />
      )}

      {/* 右键菜单 - 修改股票名称颜色 */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            className="fixed bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-50 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1 text-xs text-slate-500 border-b border-slate-100 mb-1">
              {contextMenu.stockName}
            </div>
            <div className="px-2 py-1">
              <div className="grid grid-cols-3 gap-1">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleColorSelect(opt.value)}
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-1 rounded text-[11px] hover:bg-slate-50 transition-colors w-full",
                      contextMenu.currentColor === opt.value && "bg-orange-50 ring-1 ring-orange-200"
                    )}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-200 shrink-0"
                      style={opt.value ? { backgroundColor: opt.value } : { background: "linear-gradient(135deg, #f1f5f9 50%, #94a3b8 50%)" }}
                    />
                    <span className="text-slate-700 truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}