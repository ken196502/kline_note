"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  X,
  Trash2,
  Link2,
  Search,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";
import { pinyin } from "pinyin-pro";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { CustomBlock } from "@/types/custom-block";
import type { BlockData } from "@/types/block-data";

interface EditBlockPanelProps {
  block: CustomBlock;
  allAvailableBlocks: BlockData[];
  onLinkBlock: (blockCode: string, blockName: string) => Promise<CustomBlock | null>;
  onUnlinkBlock: (blockCode: string) => Promise<CustomBlock | null>;
  onAddStock: (code: string, name: string) => Promise<CustomBlock | null>;
  onRemoveStock: (code: string) => Promise<CustomBlock | null>;
  onDeleteBlock: () => void;
  onBack: () => void;
}

export function EditBlockPanel({
  block,
  allAvailableBlocks,
  onLinkBlock,
  onUnlinkBlock,
  onAddStock,
  onRemoveStock,
  onDeleteBlock,
  onBack,
}: EditBlockPanelProps) {
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [blockSearchQuery, setBlockSearchQuery] = useState("");
  const [linkingCode, setLinkingCode] = useState<string | null>(null);
  const [unlinkingCode, setUnlinkingCode] = useState<string | null>(null);

  const [stockCodeInput, setStockCodeInput] = useState("");
  const [stockNameInput, setStockNameInput] = useState("");
  const [addingCode, setAddingCode] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 按拼音首字母分组（参考板块详情页的板块菜单）
  const groupedBlocks = useMemo(() => {
    let source = allAvailableBlocks;
    if (blockSearchQuery) {
      const q = blockSearchQuery.toLowerCase();
      source = allAvailableBlocks.filter(
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
  }, [allAvailableBlocks, blockSearchQuery]);

  const groupKeys = useMemo(
    () => Object.keys(groupedBlocks).sort((a, b) => a.localeCompare(b)),
    [groupedBlocks]
  );

  // 已关联板块的 code 集合
  const linkedBlockCodes = useMemo(
    () => new Set(block.linkedBlocks.map((b) => b.code)),
    [block.linkedBlocks]
  );

  const handleLink = async (code: string, name: string) => {
    setLinkingCode(code);
    await onLinkBlock(code, name);
    setLinkingCode(null);
  };

  const handleUnlink = async (code: string) => {
    setUnlinkingCode(code);
    await onUnlinkBlock(code);
    setUnlinkingCode(null);
  };

  const handleAddStock = async () => {
    if (!stockCodeInput.trim() || stockCodeInput.length !== 6) return;
    if (block.manualStocks.some((s) => s.code === stockCodeInput)) {
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
    onDeleteBlock();
  };

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
            编辑: {block.name}
          </h1>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* 关联板块 */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-orange-600" />
            关联板块
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            关联板块后，该板块最新一天的股票代码将自动加入
          </p>

          {/* 已关联板块标签 */}
          {block.linkedBlocks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {block.linkedBlocks.map((linked) => (
                <span
                  key={linked.code}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded border border-orange-200"
                >
                  {linked.name || linked.code}
                  <button
                    onClick={() => handleUnlink(linked.code)}
                    disabled={unlinkingCode === linked.code}
                    className="hover:text-red-500 disabled:opacity-50"
                  >
                    {unlinkingCode === linked.code ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 关联板块 Drawer */}
          <Sheet open={linkSheetOpen} onOpenChange={setLinkSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-slate-600"
              >
                <Link2 className="w-3.5 h-3.5 mr-1" />
                选择板块
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>关联板块</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                {/* 搜索 */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={blockSearchQuery}
                    onChange={(e) => setBlockSearchQuery(e.target.value)}
                    placeholder="搜索板块名称或代码"
                    className="h-8 pl-8 text-sm"
                  />
                </div>

                {/* 已关联板块标签 */}
                {block.linkedBlocks.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-slate-400 mb-1">已关联</div>
                    <div className="flex flex-wrap gap-1">
                      {block.linkedBlocks.map((linked) => (
                        <span
                          key={linked.code}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded"
                        >
                          {linked.name || linked.code}
                          <button
                            onClick={() => handleUnlink(linked.code)}
                            disabled={unlinkingCode === linked.code}
                            className="hover:text-red-500 disabled:opacity-50"
                          >
                            {unlinkingCode === linked.code ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 拼音首字母分组的板块列表 */}
                <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-2">
                  {groupKeys.length === 0 ? (
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
                          {groupedBlocks[letter].map((b) => {
                            const isLinked = linkedBlockCodes.has(b.code);
                            return (
                              <button
                                key={b.code}
                                onClick={() =>
                                  isLinked
                                    ? handleUnlink(b.code)
                                    : handleLink(b.code, b.name)
                                }
                                disabled={
                                  linkingCode === b.code ||
                                  unlinkingCode === b.code
                                }
                                className={cn(
                                  "w-full text-left px-2 py-1.5 text-sm rounded transition-colors disabled:opacity-50",
                                  isLinked
                                    ? "bg-orange-50 text-orange-700 font-medium"
                                    : "hover:bg-slate-50 text-slate-700"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="truncate">{b.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {b.code}
                                  </span>
                                  {linkingCode === b.code ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500 ml-1" />
                                  ) : isLinked ? (
                                    <Check className="w-3.5 h-3.5 text-orange-600 ml-1" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 text-slate-300 ml-1" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </section>

        {/* 手动添加股票 */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-orange-600" />
            手动添加股票
          </h2>
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
            <Input
              value={stockNameInput}
              onChange={(e) => setStockNameInput(e.target.value)}
              placeholder="股票名称"
              className="h-9 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && stockCodeInput.length === 6 && stockNameInput.trim()) {
                  handleAddStock();
                }
              }}
            />
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

          {block.manualStocks.length > 0 ? (
            <div className="border border-slate-200 rounded bg-white">
              <div className="px-3 py-1.5 border-b border-slate-100">
                <span className="text-xs text-slate-500">
                  股票 ({block.manualStocks.length})
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                {block.manualStocks.map((stock) => (
                  <div
                    key={stock.code}
                    className="flex items-center justify-between px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-900">
                        {stock.name || stock.code}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {stock.code}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveStock(stock.code)}
                      disabled={removingCode === stock.code}
                      className="text-slate-400 hover:text-red-500 disabled:opacity-50 p-1"
                    >
                      {removingCode === stock.code ? (
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
              暂无股票，请关联板块或手动添加
            </div>
          )}
        </section>

        {/* 删除板块 */}
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
            {confirmDelete ? "再次点击确认删除" : "删除此板块"}
          </Button>
          {confirmDelete && (
            <div className="text-xs text-red-400 text-center mt-1">
              删除后无法恢复，关联的股票也会被清除
            </div>
          )}
        </section>
      </div>
    </div>
  );
}