"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Trash2,
  ArrowLeft,
  Check,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomDate, CustomDateStock } from "@/types/custom-date";
import { QuickAddBlockStocksDialog } from "@/components/quick-add-block-stocks-dialog";

interface EditDatePanelProps {
  customDate: CustomDate;
  onAddStock: (stockCode: string, stockName: string) => Promise<boolean>;
  onRemoveStock: (stockCode: string) => Promise<boolean>;
  onDeleteDate: () => void;
  onBack: () => void;
}

export function EditDatePanel({
  customDate,
  onAddStock,
  onRemoveStock,
  onDeleteDate,
  onBack,
}: EditDatePanelProps) {
  const [stockCodeInput, setStockCodeInput] = useState("");
  const [stockNameInput, setStockNameInput] = useState("");
  const [addingCode, setAddingCode] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoNameLoading, setAutoNameLoading] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // 手动股票列表排序
  const [sortField, setSortField] = useState<"code" | "name">("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // 记录上次查询过的代码，避免重复查询
  const lastFetchedCode = useRef<string>("");

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

  const handleAddStock = async () => {
    if (!stockCodeInput.trim() || stockCodeInput.length !== 6) return;
    if (customDate.stocks.some((s) => s.stockCode === stockCodeInput)) {
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
            编辑: {dateTitle}
          </h1>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* 手动添加股票 */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-orange-600" />
              添加股票
            </h2>
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
          <p className="text-xs text-slate-400 mb-3">
            输入6位股票代码和名称，回车添加
          </p>

          <div className="flex items-center gap-2 mb-3">
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
                  handleAddStock();
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
                    handleAddStock();
                  }
                }}
              />
              {autoNameLoading && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />
              )}
            </div>
            <Button
              size="sm"
              onClick={handleAddStock}
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
    </div>
  );
}