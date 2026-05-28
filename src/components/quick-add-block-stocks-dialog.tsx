"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Check, Loader2, ArrowLeft } from "lucide-react";
import { pinyin } from "pinyin-pro";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StockItem {
  code: string;
  name: string;
}

interface BlockItem {
  code: string;
  name: string;
}

interface QuickAddBlockStocksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingStockCodes: string[];
  onAddStocks: (stocks: StockItem[]) => Promise<void>;
}

export function QuickAddBlockStocksDialog({
  open,
  onOpenChange,
  existingStockCodes,
  onAddStocks,
}: QuickAddBlockStocksDialogProps) {
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [selectedBlockCode, setSelectedBlockCode] = useState<string | null>(null);
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [blockStocks, setBlockStocks] = useState<StockItem[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [adding, setAdding] = useState(false);

  const existingSet = useMemo(() => new Set(existingStockCodes), [existingStockCodes]);

  const [allBlocks, setAllBlocks] = useState<BlockItem[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // 加载板块列表
  useEffect(() => {
    if (!open) return;
    setLoadingBlocks(true);
    fetch("/api/block-history?days=1")
      .then((res) => res.json())
      .then((result) => {
        const blocks: BlockItem[] = [];
        const seen = new Set<string>();
        if (result.data && result.data.length > 0) {
          result.data[0].blocks.forEach((b: any) => {
            if (!seen.has(b.code)) {
              seen.add(b.code);
              blocks.push({ code: b.code, name: b.name });
            }
          });
        }
        setAllBlocks(blocks);
      })
      .finally(() => setLoadingBlocks(false));
  }, [open]);

  // 按拼音首字母分组板块列表
  const groupedBlocks = useMemo(() => {
    let source = allBlocks;
    if (blockSearchQuery) {
      const q = blockSearchQuery.toLowerCase();
      source = allBlocks.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.code.includes(q) ||
          pinyin(b.name, { pattern: "first", toneType: "none" })
            .toLowerCase()
            .includes(q)
      );
    }

    const sorted = [...source].sort((a, b) => {
      const pA = pinyin(a.name, { pattern: "first", toneType: "none" }).toLowerCase();
      const pB = pinyin(b.name, { pattern: "first", toneType: "none" }).toLowerCase();
      return pA.localeCompare(pB);
    });

    const groups: Record<string, Array<{ code: string; name: string }>> = {};
    sorted.forEach((b) => {
      const firstLetter = pinyin(b.name, { pattern: "first", toneType: "none" })
        .charAt(0)
        .toUpperCase();
      if (!groups[firstLetter]) groups[firstLetter] = [];
      groups[firstLetter].push({ code: b.code, name: b.name });
    });
    return groups;
  }, [allBlocks, blockSearchQuery]);

  const groupKeys = useMemo(
    () => Object.keys(groupedBlocks).sort((a, b) => a.localeCompare(b)),
    [groupedBlocks]
  );

  // 选中板块后获取该板块的股票列表
  useEffect(() => {
    if (!selectedBlockCode || !open) {
      setBlockStocks([]);
      return;
    }

    setLoadingStocks(true);
    fetch(`/api/block-detail?code=${selectedBlockCode}&days=10`)
      .then((res) => res.json())
      .then((result) => {
        const stocks: StockItem[] = [];
        const seen = new Set<string>();
        if (result.data && result.data.length > 0) {
          // 遍历所有日期的股票，去重合并
          for (const dayData of result.data) {
            if (dayData.stocks) {
              for (const s of dayData.stocks) {
                if (!seen.has(s.code)) {
                  seen.add(s.code);
                  stocks.push({ code: s.code, name: s.name });
                }
              }
            }
          }
        }
        setBlockStocks(stocks);
      })
      .finally(() => setLoadingStocks(false));
  }, [selectedBlockCode, open]);

  const toggleStock = (code: string) => {
    setSelectedStocks((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSelectAll = () => {
    const selectable = blockStocks.filter((s) => !existingSet.has(s.code));
    const selectableCodes = selectable.map((s) => s.code);
    setSelectedStocks((prev) => {
      const next = new Set(prev);
      const allSelected = selectableCodes.every((c) => next.has(c));
      if (allSelected) {
        selectableCodes.forEach((c) => next.delete(c));
      } else {
        selectableCodes.forEach((c) => next.add(c));
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedStocks.size === 0) return;
    const stocksToAdd = blockStocks
      .filter((s) => selectedStocks.has(s.code))
      .map((s) => ({ code: s.code, name: s.name }));
    setAdding(true);
    await onAddStocks(stocksToAdd);
    setAdding(false);
    setSelectedStocks(new Set());
    setSelectedBlockCode(null);
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedBlockCode(null);
    setSelectedStocks(new Set());
    setBlockSearchQuery("");
    onOpenChange(false);
  };

  const selectedBlockName = useMemo(() => {
    if (!selectedBlockCode) return "";
    const block = allBlocks.find((b) => b.code === selectedBlockCode);
    return block?.name || selectedBlockCode;
  }, [selectedBlockCode, allBlocks]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {selectedBlockCode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedBlockCode(null);
                  setSelectedStocks(new Set());
                }}
                className="h-7 w-7 p-0 text-slate-500"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {selectedBlockCode ? selectedBlockName : "快捷添加板块股票"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 px-4 pb-4">
          {!selectedBlockCode ? (
            <>
              {/* 搜索 */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  value={blockSearchQuery}
                  onChange={(e) => setBlockSearchQuery(e.target.value)}
                  placeholder="搜索板块名称或代码"
                  className="h-8 pl-8 text-sm"
                />
              </div>

              {/* 板块列表 */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {loadingBlocks ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : groupKeys.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">
                    无匹配板块
                  </div>
                ) : (
                  groupKeys.map((letter) => (
                    <div key={letter} className="space-y-1">
                      <div className="px-2 py-1 text-xs font-semibold text-slate-400 bg-slate-100 rounded-sm">
                        {letter}
                      </div>
                      <div className="space-y-0.5">
                        {groupedBlocks[letter].map((b) => (
                          <button
                            key={b.code}
                            onClick={() => setSelectedBlockCode(b.code)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-sm rounded transition-colors hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{b.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {b.code}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              {/* 股票列表 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  共 {blockStocks.length} 只，已选 {selectedStocks.size} 只
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-6 text-[11px] text-slate-500"
                >
                  全选
                </Button>
              </div>

              {loadingStocks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : blockStocks.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-8">
                  该板块暂无股票数据
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded">
                  <div className="divide-y divide-slate-50">
                    {blockStocks.map((stock) => {
                      const isExisting = existingSet.has(stock.code);
                      const isSelected = selectedStocks.has(stock.code);
                      return (
                        <button
                          key={stock.code}
                          onClick={() => !isExisting && toggleStock(stock.code)}
                          disabled={isExisting}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors",
                            isExisting
                              ? "opacity-40 cursor-not-allowed"
                              : isSelected
                                ? "bg-orange-50"
                                : "hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center",
                                isSelected
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-slate-300"
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-mono text-slate-500 w-14">
                              {stock.code}
                            </span>
                            <span className="text-sm text-slate-900">
                              {stock.name}
                            </span>
                          </div>
                          {isExisting && (
                            <span className="text-[10px] text-slate-400">已添加</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 底部操作 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-7 text-xs"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={selectedStocks.size === 0 || adding}
                  className="h-7 text-xs"
                >
                  {adding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      添加 {selectedStocks.size > 0 ? `(${selectedStocks.size})` : ""}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}