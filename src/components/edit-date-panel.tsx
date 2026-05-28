"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  X,
  Trash2,
  ArrowLeft,
  Search,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomDate, CustomDateStock } from "@/types/custom-date";
import { QuickAddBlockStocksDialog } from "@/components/quick-add-block-stocks-dialog";
import { ManualAddStockDialog } from "@/components/manual-add-stock-dialog";

interface EditDatePanelProps {
  customDate: CustomDate;
  blockName?: string;
  onAddStock: (stockCode: string, stockName: string) => Promise<boolean>;
  onRemoveStock: (stockCode: string) => Promise<boolean>;
  onDeleteDate: () => void;
  onBack: () => void;
}

export function EditDatePanel({
  customDate,
  blockName,
  onAddStock,
  onRemoveStock,
  onDeleteDate,
  onBack,
}: EditDatePanelProps) {
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);

  // 搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ code: string; name: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 手动股票列表排序
  const [sortField, setSortField] = useState<"code" | "name">("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // 排序后的股票列表
  const sortedStocks = useMemo(() => {
    const list = [...customDate.stocks];
    list.sort((a, b) => {
      const va = sortField === "code" ? a.stockCode : (a.stockName || "");
      const vb = sortField === "code" ? b.stockCode : (b.stockName || "");
      const cmp = va.localeCompare(vb, "zh-CN");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [customDate.stocks, sortField, sortDir]);

  const toggleSort = (field: "code" | "name") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: "code" | "name" }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-orange-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-orange-500" />
    );
  };

  const handleRemoveStock = async (code: string) => {
    setRemovingCode(code);
    await onRemoveStock(code);
    setRemovingCode(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDeleteDate();
  };

  // 快捷添加板块股票
  const handleQuickAddStocks = async (stocks: { code: string; name: string }[]) => {
    for (const stock of stocks) {
      if (!customDate.stocks.some((s) => s.stockCode === stock.code)) {
        await onAddStock(stock.code, stock.name);
      }
    }
  };

  const existingStockCodes = useMemo(
    () => customDate.stocks.map((s) => s.stockCode),
    [customDate.stocks]
  );
  const existingSet = useMemo(() => new Set(existingStockCodes), [existingStockCodes]);

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

  const handleSearchAdd = async (code: string, name: string) => {
    if (existingStockCodes.includes(code)) return;
    await onAddStock(code, name);
  };

  // 格式化日期标题
  const dateTitle = (() => {
    const d = new Date(customDate.date + "T00:00:00");
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}月${day}日 ${weekdays[d.getDay()]}`;
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-slate-500 hover:text-slate-900 h-8 w-8 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-bold text-slate-900 truncate">
            {blockName ? `${blockName} ${dateTitle}` : dateTitle}
          </h1>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* 添加股票 */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-orange-600" />
              添加股票
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManualAddOpen(true)}
                className="h-7 text-[11px] text-slate-600"
              >
                <PenLine className="w-3 h-3 mr-1" />
                手动添加
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickAddOpen(true)}
                className="h-7 text-[11px] text-slate-600"
              >
                <Layers className="w-3 h-3 mr-1" />
                快捷添加板块股票
              </Button>
            </div>
          </div>

          {/* 搜索添加 */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入股票名称或代码搜索添加"
                className="h-8 pl-8 text-sm"
              />
            </div>
            {searchLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : searchQuery.trim() && searchResults.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-2">
                未找到匹配的股票
              </div>
            ) : searchResults.length > 0 ? (
              <div className="mt-1 border border-slate-200 rounded divide-y divide-slate-50 max-h-48 overflow-y-auto">
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
            ) : null}
          </div>

          {customDate.stocks.length > 0 ? (
            <div className="border border-slate-200 rounded bg-white">
              {/* 表头：可排序 */}
              <div className="flex items-center border-b border-slate-100 text-xs text-slate-500">
                <button
                  onClick={() => toggleSort("code")}
                  className="flex items-center gap-0.5 px-3 py-1.5 hover:text-slate-700 transition-colors"
                >
                  代码
                  <SortIcon field="code" />
                </button>
                <button
                  onClick={() => toggleSort("name")}
                  className="flex items-center gap-0.5 px-3 py-1.5 hover:text-slate-700 transition-colors flex-1"
                >
                  名称
                  <SortIcon field="name" />
                </button>
                <span className="px-3 py-1.5 w-8" />
              </div>
              <div className="max-h-[calc(100vh-320px)] min-h-48 overflow-y-auto divide-y divide-slate-50">
                {sortedStocks.map((stock) => (
                  <div
                    key={stock.stockCode}
                    className="flex items-center justify-between px-3 py-1.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 w-14">
                        {stock.stockCode}
                      </span>
                      <span className="text-sm text-slate-900">
                        {stock.stockName || stock.stockCode}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveStock(stock.stockCode)}
                      disabled={removingCode === stock.stockCode}
                      className="text-slate-400 hover:text-red-500 disabled:opacity-50 p-1 shrink-0"
                    >
                      {removingCode === stock.stockCode ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded">
              暂无股票，请手动添加
            </div>
          )}
        </section>

        {/* 删除日期 */}
        <section className="pt-4 border-t border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className={cn(
              "w-full text-sm",
              confirmDelete
                ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                : "text-slate-400 hover:text-red-500"
            )}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {confirmDelete ? "再次点击确认删除此日期" : "删除此日期"}
          </Button>
          {confirmDelete && (
            <div className="text-xs text-red-400 text-center mt-1">
              删除后无法恢复，日期内的股票也会被清除
            </div>
          )}
        </section>
      </div>

      {/* 快捷添加板块股票弹窗 */}
      <QuickAddBlockStocksDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        existingStockCodes={existingStockCodes}
        onAddStocks={handleQuickAddStocks}
      />

      {/* 手动添加股票弹窗 */}
      <ManualAddStockDialog
        open={manualAddOpen}
        onOpenChange={setManualAddOpen}
        existingStockCodes={existingStockCodes}
        onAddStock={onAddStock}
      />
    </div>
  );
}