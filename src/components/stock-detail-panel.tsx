"use client";

import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { KLineChart } from "@/components/kline-chart";
import { TimePreviewChartLarge } from "@/components/time-preview-chart";

/** 右侧面板所需的股票信息 */
export interface StockDetailInfo {
  code: string;
  name: string;
  marketType: string;
  date: string;
  blockName: string;
}

interface StockDetailPanelProps {
  /** 当前选中的股票，null 则显示空状态 */
  selectedStock: StockDetailInfo | null;

  /** 获取备注内容 */
  getNote: (stockCode: string, stockDate: string) => string | undefined;

  /** 保存备注 */
  saveNote: (stockCode: string, stockDate: string, content: string) => Promise<boolean | void>;

  /** 格式化日期 */
  formatDate: (dateStr: string) => string;

  /** 用户名（用于保存备注校验） */
  username: string | null | undefined;

  /** 备注区域高度（桌面端） */
  noteHeightClass?: string;

  /** 空状态文案 */
  emptyText?: string;

  /** lg 以下的 Sheet 是否打开 */
  stockDetailOpen: boolean;

  /** lg 以下 Sheet 状态变更 */
  setStockDetailOpen: (open: boolean) => void;

  /** 外部请求打开备注编辑的触发器，每次递增即触发一次 */
  openNoteRequest?: number;
}

export function StockDetailPanel({
  selectedStock,
  getNote,
  saveNote,
  formatDate,
  username,
  noteHeightClass = "h-28",
  emptyText = "点击左侧个股查看详情",
  stockDetailOpen,
  setStockDetailOpen,
  openNoteRequest = 0,
}: StockDetailPanelProps) {
  // 在线分时数据状态
  const [onlineTimePreview, setOnlineTimePreview] = useState<number[]>([]);
  const [timePreviewLoading, setTimePreviewLoading] = useState(false);
  const timePreviewAbortControllerRef = useRef<AbortController | null>(null);

  // 备注编辑状态
  const [editingNote, setEditingNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // 获取在线分时数据
  const fetchOnlineTimePreview = useCallback(
    async (stockCode: string, marketType: string) => {
      if (timePreviewAbortControllerRef.current) {
        timePreviewAbortControllerRef.current.abort();
      }
      timePreviewAbortControllerRef.current = new AbortController();

      setTimePreviewLoading(true);
      setOnlineTimePreview([]);

      const res = await fetch(
        `/api/time-preview?code=${stockCode}&marketType=${marketType}`,
        { signal: timePreviewAbortControllerRef.current.signal }
      );

      if (!res.ok) {
        setTimePreviewLoading(false);
        return;
      }

      const result = await res.json();
      if (result.success && result.data?.prices) {
        setOnlineTimePreview(result.data.prices);
      }
      setTimePreviewLoading(false);
    },
    []
  );

  // 外部触发进入备注编辑
  useEffect(() => {
    if (openNoteRequest > 0 && selectedStock) {
      startEditing();
    }
  }, [openNoteRequest, selectedStock]);

  // 选中股票变化时获取分时数据，并退出编辑
  useEffect(() => {
    if (selectedStock) {
      fetchOnlineTimePreview(selectedStock.code, selectedStock.marketType);
    } else {
      setOnlineTimePreview([]);
    }
    setEditingNote(false);

    return () => {
      if (timePreviewAbortControllerRef.current) {
        timePreviewAbortControllerRef.current.abort();
      }
    };
  }, [selectedStock?.code, selectedStock?.marketType, fetchOnlineTimePreview]);

  // 计算 symbol
  const selectedSymbol = useMemo(() => {
    if (!selectedStock) return "";
    const marketPrefix =
      selectedStock.marketType === "SH" || selectedStock.code.startsWith("6")
        ? "sh"
        : "sz";
    return `${marketPrefix}${selectedStock.code}`;
  }, [selectedStock]);

  // 备注编辑相关
  const startEditing = useCallback(() => {
    if (!selectedStock) return;
    const existingNote = getNote(selectedStock.code, selectedStock.date);
    setNoteContent(existingNote || "");
    setEditingNote(true);
  }, [selectedStock, getNote]);

  const handleSaveNote = async () => {
    if (!selectedStock || !username) return;
    setSavingNote(true);
    await saveNote(selectedStock.code, selectedStock.date, noteContent);
    setEditingNote(false);
    setNoteContent("");
    setSavingNote(false);
  };

  const handleCancelEdit = () => {
    setEditingNote(false);
    setNoteContent("");
  };

  // 通用内容块（K线 + 备注 + 分时）
  const detailContent = (noteHeight: string, isSheet?: boolean) => {
    if (!selectedStock) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-slate-400">
          {emptyText}
        </div>
      );
    }

    return (
      <div className="flex flex-col overflow-hidden flex-1 min-h-0">
        {/* K线图（上）填满剩余空间 */}
        <div className={cn("overflow-hidden border-b border-slate-200", isSheet ? "h-[45%] shrink-0" : "flex-1 shrink-0")}>
          <KLineChart symbol={selectedSymbol} stockName={selectedStock.name} />
        </div>

        {/* 备注（中）固定高度 */}
        <div
          className={`${noteHeight} shrink-0 border-b border-slate-200 flex flex-col overflow-hidden`}
        >
          {editingNote ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 shrink-0">
                <StickyNote className="w-3 h-3 text-orange-500" />
                <span className="text-xs font-semibold text-slate-700">
                  {selectedStock.name} {selectedStock.code}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={savingNote}
                    className="h-5 px-2 text-[11px] text-slate-500"
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    className="h-5 px-2 text-[11px]"
                  >
                    {savingNote ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0 px-3 py-1">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="输入备注内容..."
                  className="w-full h-full resize-none border-0 focus-visible:ring-0 p-0 text-sm text-slate-700 placeholder:text-slate-400"
                  autoFocus
                />
              </div>
            </>
          ) : (
            <div
              className="flex-1 min-h-0 px-3 py-2 cursor-pointer hover:bg-slate-50/50 transition-colors flex flex-col"
              onClick={startEditing}
            >
              <div className="flex items-center gap-2 mb-1 shrink-0">
                <StickyNote className="w-3 h-3 text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">
                  {selectedStock.name} {selectedStock.code}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto">点击编辑</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto text-sm text-slate-600">
                {getNote(selectedStock.code, selectedStock.date) || (
                  <span className="text-slate-400">暂无备注</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 分时缩略图（下）固定高度置底 */}
        <div className={cn("shrink-0 flex items-center justify-center p-2 overflow-hidden", isSheet ? "h-[25%]" : "h-[30%]")}>
          <TimePreviewChartLarge
            data={onlineTimePreview}
            loading={timePreviewLoading}
            onRefresh={() =>
              fetchOnlineTimePreview(selectedStock.code, selectedStock.marketType)
            }
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 桌面端 - 右侧面板 */}
      <div className="hidden lg:flex w-[50vh] bg-white flex-col overflow-hidden">
        {detailContent(noteHeightClass)}
      </div>

      {/* 移动端 - Sheet */}
      <Sheet open={stockDetailOpen} onOpenChange={setStockDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden">
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-slate-200 shrink-0">
            <SheetTitle className="flex items-center gap-2">
              {selectedStock ? (
                <>
                  <span>{selectedStock.name}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedStock.code}
                  </span>
                </>
              ) : (
                <span>股票详情</span>
              )}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {selectedStock ? `${selectedStock.name} 股票详情` : "股票详情"}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            {detailContent("h-24", true)}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}