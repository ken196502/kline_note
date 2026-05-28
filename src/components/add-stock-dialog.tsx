"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SearchResult {
  code: string;
  name: string;
}

interface AddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingStockCodes: string[];
  onAddStock: (stockCode: string, stockName: string) => Promise<boolean>;
}

export function AddStockDialog({
  open,
  onOpenChange,
  existingStockCodes,
  onAddStock,
}: AddStockDialogProps) {
  // 手动输入
  const [stockCodeInput, setStockCodeInput] = useState("");
  const [stockNameInput, setStockNameInput] = useState("");
  const [addingCode, setAddingCode] = useState(false);
  const [autoNameLoading, setAutoNameLoading] = useState(false);
  const lastFetchedCode = useRef<string>("");

  // 搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const existingSet = useMemo(() => new Set(existingStockCodes), [existingStockCodes]);

  // 输入满6位代码时自动查询名称
  useEffect(() => {
    if (stockCodeInput.length === 6 && stockCodeInput !== lastFetchedCode.current) {
      lastFetchedCode.current = stockCodeInput;
      setAutoNameLoading(true);
      fetch(`/api/stock-info?code=${stockCodeInput}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.name) {
            setStockNameInput(data.name);
          }
        })
        .finally(() => setAutoNameLoading(false));
    }
    if (stockCodeInput.length < 6) {
      lastFetchedCode.current = "";
      setStockNameInput("");
    }
  }, [stockCodeInput]);

  // 搜索防抖
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchLoading(true);
      fetch(`/api/stock-search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          setSearchResults(data.results || []);
        })
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const handleManualAdd = async () => {
    if (!stockCodeInput.trim() || stockCodeInput.length !== 6) return;
    if (existingStockCodes.includes(stockCodeInput)) {
      setStockCodeInput("");
      setStockNameInput("");
      return;
    }
    setAddingCode(true);
    await onAddStock(stockCodeInput, stockNameInput.trim());
    setStockCodeInput("");
    setStockNameInput("");
    setAddingCode(false);
  };

  const handleSearchAdd = async (code: string, name: string) => {
    if (existingStockCodes.includes(code)) return;
    await onAddStock(code, name);
  };

  const handleClose = () => {
    setStockCodeInput("");
    setStockNameInput("");
    setSearchQuery("");
    setSearchResults([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">添加股票</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 px-4 pb-4">
          {/* 手动输入代码 + 名称 */}
          <div>
            <p className="text-xs text-slate-400 mb-2">
              输入6位股票代码，自动获取名称
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={stockCodeInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setStockCodeInput(val);
                }}
                placeholder="6位代码"
                className="h-9 text-sm font-mono w-28"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && stockCodeInput.length === 6 && stockNameInput.trim()) {
                    handleManualAdd();
                  }
                }}
              />
              <div className="relative flex-1">
                <Input
                  value={stockNameInput}
                  onChange={(e) => setStockNameInput(e.target.value)}
                  placeholder="股票名称"
                  className="h-9 text-sm w-full"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && stockCodeInput.length === 6 && stockNameInput.trim()) {
                      handleManualAdd();
                    }
                  }}
                />
                {autoNameLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />
                )}
              </div>
              <Button
                size="sm"
                onClick={handleManualAdd}
                disabled={stockCodeInput.length !== 6 || !stockNameInput.trim() || addingCode}
                className="h-9 px-3"
              >
                {addingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 分隔线 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">或按名称搜索添加</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* 搜索添加 */}
          <div className="flex-1 overflow-hidden flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入股票名称或代码搜索"
                className="h-8 pl-8 text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {searchLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : searchQuery.trim() && searchResults.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">
                  未找到匹配的股票
                </div>
              ) : !searchQuery.trim() ? (
                <div className="text-xs text-slate-400 text-center py-6">
                  输入名称或代码开始搜索
                </div>
              ) : (
                <div className="border border-slate-200 rounded divide-y divide-slate-50">
                  {searchResults.map((stock) => {
                    const isExisting = existingSet.has(stock.code);
                    return (
                      <div
                        key={stock.code}
                        className={cn(
                          "flex items-center justify-between px-3 py-1.5",
                          isExisting ? "opacity-40" : ""
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-500 w-14">
                            {stock.code}
                          </span>
                          <span className="text-sm text-slate-900">
                            {stock.name}
                          </span>
                        </div>
                        {isExisting ? (
                          <span className="text-[10px] text-slate-400">已添加</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSearchAdd(stock.code, stock.name)}
                            className="h-6 text-[11px] text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2"
                          >
                            <Plus className="w-3 h-3 mr-0.5" />
                            添加
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}