"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit3,
  LogOut,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useCustomBlocks } from "@/hooks/use-custom-blocks";
import { useNotes } from "@/hooks/use-notes";
import type { CustomBlock, CustomBlockStock } from "@/types/custom-block";
import type { BlockData } from "@/types/block-data";
import { EditBlockPanel } from "@/components/edit-block-panel";
import { StockDetailPanel, type StockDetailInfo } from "@/components/stock-detail-panel";

// 历史行情日期分组类型
interface HistoryStockDayData {
  code: string;
  name: string;
  latest: number;
  changeRate: number;
  marketType: string;
  source: "limitUp" | "nonLimitUp";
  sourceBlockName?: string;
  timePreview?: number[];
  hasPrice?: boolean;
}

interface HistoryDayGroup {
  date: string;
  stocks: HistoryStockDayData[];
}

export default function MyPage() {
  const router = useRouter();
  const { authenticated, username, loading: authLoading, logout } = useAuth();
  const {
    blocks,
    loading: blocksLoading,
    createBlock,
    deleteBlock,
    linkBlock,
    unlinkBlock,
    addStock,
    removeStock,
    renameBlock,
  } = useCustomBlocks();
  const { saveNote, getNote, preloadNotes } = useNotes();

  // 当前选中的自定义板块
  const [selectedBlock, setSelectedBlock] = useState<CustomBlock | null>(null);
  // 自定义板块的股票数据
  const [blockStocks, setBlockStocks] = useState<CustomBlockStock[]>([]);
  const [stocksDate, setStocksDate] = useState<string | null>(null);
  const [stocksLoading, setStocksLoading] = useState(false);

  // 历史行情数据（按日期分组）
  const [historyData, setHistoryData] = useState<HistoryDayGroup[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 当前选中的股票
  const [selectedStock, setSelectedStock] = useState<StockDetailInfo | null>(null);

  // 编辑模式
  const [editingBlock, setEditingBlock] = useState<CustomBlock | null>(null);

  // 内联重命名
  const [renamingBlockId, setRenamingBlockId] = useState<number | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [renamingLoading, setRenamingLoading] = useState(false);

  // 日期分组折叠状态
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  // 只看涨停
  const [showOnlyLimitUp, setShowOnlyLimitUp] = useState(false);

  // 创建板块
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");

  // 可用板块列表（编辑页使用）
  const [allAvailableBlocks, setAllAvailableBlocks] = useState<BlockData[]>([]);

  // 股票详情抽屉（lg以下）
  const [stockDetailOpen, setStockDetailOpen] = useState(false);

  // 外部触发打开备注的计数器
  const [openNoteRequest, setOpenNoteRequest] = useState(0);

  // 登录检查
  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push("/");
    }
  }, [authLoading, authenticated, router]);

  // 加载可用板块列表
  useEffect(() => {
    if (!authenticated) return;
    const fetchAllBlocks = async () => {
      const res = await fetch("/api/block-history?days=5");
      if (res.ok) {
        const result = await res.json();
        const blockMap = new Map<string, BlockData>();
        result.data.forEach((dayData: any) => {
          dayData.blocks.forEach((b: BlockData) => {
            if (!blockMap.has(b.code)) {
              blockMap.set(b.code, b);
            }
          });
        });
        setAllAvailableBlocks(Array.from(blockMap.values()));
      }
    };
    fetchAllBlocks();
  }, [authenticated]);

  // 默认选中第一个自定义板块
  useEffect(() => {
    if (!selectedBlock && blocks.length > 0) {
      setSelectedBlock(blocks[0]);
    }
  }, [blocks, selectedBlock]);

  // 选中自定义板块时加载历史行情
  useEffect(() => {
    if (!selectedBlock) {
      setHistoryData([]);
      setBlockStocks([]);
      setStocksDate(null);
      return;
    }
    const loadHistory = async () => {
      setHistoryLoading(true);
      setStocksLoading(true);
      const res = await fetch(`/api/custom-block-stocks/history?blockId=${selectedBlock.id}`);
      if (res.ok) {
        const result = await res.json();
        const groups: HistoryDayGroup[] = result.data || [];
        setHistoryData(groups);
        // 兼容：取最新一天的数据作为 blockStocks（供第三列详情使用）
        if (groups.length > 0) {
          const latestGroup = groups[0];
          setBlockStocks(
            latestGroup.stocks.map((s) => ({
              code: s.code,
              name: s.name,
              latest: s.latest,
              changeRate: s.changeRate,
              date: latestGroup.date,
              timePreview: s.timePreview,
              marketType: s.marketType,
              source: s.source,
              sourceBlockName: s.sourceBlockName,
            }))
          );
          setStocksDate(latestGroup.date);
        } else {
          setBlockStocks([]);
          setStocksDate(null);
        }
      } else {
        setHistoryData([]);
        setBlockStocks([]);
        setStocksDate(null);
      }
      setHistoryLoading(false);
      setStocksLoading(false);
      setSelectedStock(null);
    };
    loadHistory();
  }, [selectedBlock?.id]);

  // 预加载备注
  useEffect(() => {
    if (blockStocks.length > 0 && authenticated && username) {
      const stockKeyList = blockStocks
        .filter((s) => s.date)
        .map((s) => ({ stockCode: s.code, stockDate: s.date }));
      if (stockKeyList.length > 0) {
        preloadNotes(stockKeyList);
      }
    }
  }, [blockStocks, authenticated, username, preloadNotes]);

  // 创建板块
  const handleCreateBlock = async () => {
    if (!newBlockName.trim()) return;
    const block = await createBlock(newBlockName.trim());
    if (block) {
      setNewBlockName("");
      setCreatingBlock(false);
      setSelectedBlock(block);
    }
  };

  // 刷新历史行情数据（编辑后调用）
  const refreshStocks = useCallback(
    async (blockId: number) => {
      setHistoryLoading(true);
      const res = await fetch(`/api/custom-block-stocks/history?blockId=${blockId}`);
      if (res.ok) {
        const result = await res.json();
        const groups: HistoryDayGroup[] = result.data || [];
        setHistoryData(groups);
        if (groups.length > 0) {
          const latestGroup = groups[0];
          setBlockStocks(
            latestGroup.stocks.map((s) => ({
              code: s.code,
              name: s.name,
              latest: s.latest,
              changeRate: s.changeRate,
              date: latestGroup.date,
              timePreview: s.timePreview,
              marketType: s.marketType,
              source: s.source,
              sourceBlockName: s.sourceBlockName,
            }))
          );
          setStocksDate(latestGroup.date);
        } else {
          setBlockStocks([]);
          setStocksDate(null);
        }
      }
      setHistoryLoading(false);
    },
    []
  );

  // 编辑面板回调
  const handleLinkBlock = async (blockCode: string, blockName: string) => {
    if (!editingBlock) return null;
    const updated = await linkBlock(editingBlock.id, blockCode, blockName);
    if (updated) {
      setEditingBlock(updated);
      if (selectedBlock?.id === updated.id) {
        setSelectedBlock(updated);
        refreshStocks(updated.id);
      }
    }
    return updated;
  };

  const handleUnlinkBlock = async (blockCode: string) => {
    if (!editingBlock) return null;
    const updated = await unlinkBlock(editingBlock.id, blockCode);
    if (updated) {
      setEditingBlock(updated);
      if (selectedBlock?.id === updated.id) {
        setSelectedBlock(updated);
        refreshStocks(updated.id);
      }
    }
    return updated;
  };

  const handleAddStock = async (code: string, name: string) => {
    if (!editingBlock) return null;
    const updated = await addStock(editingBlock.id, code, name);
    if (updated) {
      setEditingBlock(updated);
      if (selectedBlock?.id === updated.id) {
        setSelectedBlock(updated);
        refreshStocks(updated.id);
      }
    }
    return updated;
  };

  const handleRemoveStock = async (code: string) => {
    if (!editingBlock) return null;
    const updated = await removeStock(editingBlock.id, code);
    if (updated) {
      setEditingBlock(updated);
      if (selectedBlock?.id === updated.id) {
        setSelectedBlock(updated);
        refreshStocks(updated.id);
      }
    }
    return updated;
  };

  const handleDeleteBlock = () => {
    if (!editingBlock) return;
    deleteBlock(editingBlock.id);
    if (selectedBlock?.id === editingBlock.id) {
      setSelectedBlock(blocks.find((b) => b.id !== editingBlock.id) || null);
    }
    setEditingBlock(null);
  };

  // 内联重命名处理
  const handleStartRename = (block: CustomBlock) => {
    setRenamingBlockId(block.id);
    setRenamingName(block.name);
  };

  const handleConfirmRename = async () => {
    if (!renamingBlockId) return;
    const trimmed = renamingName.trim();
    if (!trimmed) {
      setRenamingBlockId(null);
      return;
    }
    const block = blocks.find((b) => b.id === renamingBlockId);
    if (block && block.name === trimmed) {
      setRenamingBlockId(null);
      return;
    }
    setRenamingLoading(true);
    const updated = await renameBlock(renamingBlockId, trimmed);
    setRenamingLoading(false);
    if (updated) {
      if (selectedBlock?.id === updated.id) {
        setSelectedBlock(updated);
      }
    }
    setRenamingBlockId(null);
  };

  // 选中股票查看详情
  const handleSelectStock = (stock: CustomBlockStock) => {
    setSelectedStock({
      code: stock.code,
      name: stock.name,
      marketType: stock.marketType,
      date: stock.date || stocksDate || "",
      blockName: stock.sourceBlockName || stock.name,
    });
    if (window.innerWidth < 1024) {
      setStockDetailOpen(true);
    }
  };

  

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    const weekday = format(date, "EEEE", { locale: zhCN });
    const formattedDate = format(date, "MM月dd日", { locale: zhCN });
    return `${formattedDate} ${weekday}`;
  };

  

  // ===== 编辑模式 =====
  if (editingBlock) {
    return (
      <EditBlockPanel
        block={editingBlock}
        allAvailableBlocks={allAvailableBlocks}
        onLinkBlock={handleLinkBlock}
        onUnlinkBlock={handleUnlinkBlock}
        onAddStock={handleAddStock}
        onRemoveStock={handleRemoveStock}
        onDeleteBlock={handleDeleteBlock}
        onBack={() => setEditingBlock(null)}
      />
    );
  }

  // ===== 展示模式 =====
  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 z-40 bg-white border-b border-slate-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-900">复盘</h1>
            <div className="flex items-center gap-2">
              {authenticated && username && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{username}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-slate-400 hover:text-red-500 h-7 w-7 p-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 三列布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 第一列 - 自定义板块列表 */}
        <div className="w-48 lg:w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          {/* 板块列表 */}
          <div className="flex-1 overflow-y-auto p-1">
            {blocksLoading && blocks.length === 0 ? (
              <div className="p-2">
                <Skeleton className="h-6 w-full mb-1" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : blocks.length === 0 ? (
              <div className="p-3 text-xs text-slate-400 text-center">
                暂无自定义板块
              </div>
            ) : (
              blocks.map((block) => (
                <div
                  key={block.id}
                  className={cn(
                    "group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors text-sm",
                    selectedBlock?.id === block.id
                      ? "bg-orange-50 text-orange-700 font-medium"
                      : "hover:bg-slate-50 text-slate-700"
                  )}
                  onClick={() => {
                    if (renamingBlockId === block.id) return;
                    setSelectedBlock(block);
                  }}
                >
                  {renamingBlockId === block.id ? (
                    <Input
                      value={renamingName}
                      onChange={(e) => setRenamingName(e.target.value)}
                      className="h-6 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmRename();
                        if (e.key === "Escape") setRenamingBlockId(null);
                      }}
                      onBlur={handleConfirmRename}
                      disabled={renamingLoading}
                    />
                  ) : (
                    <>
                      <span
                        className="truncate flex-1"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(block);
                        }}
                      >
                        {block.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBlock(block);
                        }}
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-orange-600 shrink-0"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 添加板块按钮 - 置底 */}
          <div className="p-2 border-t border-slate-100">
            {creatingBlock ? (
              <div className="flex gap-1">
                <Input
                  value={newBlockName}
                  onChange={(e) => setNewBlockName(e.target.value)}
                  placeholder="板块名称"
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateBlock();
                    if (e.key === "Escape") setCreatingBlock(false);
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleCreateBlock}
                  className="h-7 px-2 text-xs"
                >
                  确定
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatingBlock(true)}
                className="w-full h-7 text-xs text-slate-500 hover:text-orange-600"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                添加板块
              </Button>
            )}
          </div>
        </div>

        {/* 第二列 - 历史行情（按日期分组） */}
        <div className="flex-1 lg:min-w-[40%] lg:border-r lg:border-slate-200 bg-white overflow-y-auto relative">
          {!selectedBlock ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              请先选择或创建一个自定义板块
            </div>
          ) : (
            <div className="p-3">
              {/* 固定在右上角的操作按钮 */}
              {!historyLoading && historyData.length > 0 && (
                <div className="sticky z-50 flex justify-end gap-1.5 -mt-3 -mr-3 mb-2 p-2 bg-white/80 backdrop-blur-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => {
                      setCollapsedDates(new Set(historyData.map((g) => g.date)));
                    }}
                  >
                    折叠全部
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => {
                      setCollapsedDates(new Set());
                    }}
                  >
                    打开全部
                  </Button>
                  <Button
                    variant={showOnlyLimitUp ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-6 px-2 text-[11px]",
                      showOnlyLimitUp && "bg-red-600 hover:bg-red-700 text-white"
                    )}
                    onClick={() => setShowOnlyLimitUp(!showOnlyLimitUp)}
                  >
                    只看涨停
                  </Button>
                </div>
              )}

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
                  暂无历史行情数据，点击编辑添加股票
                </div>
              ) : (
                <div className="space-y-4">

                  {historyData
                    .map((dayGroup) => ({
                      ...dayGroup,
                      stocks: showOnlyLimitUp
                        ? dayGroup.stocks.filter((s) => s.source === "limitUp")
                        : dayGroup.stocks,
                    }))
                    .filter((dayGroup) => dayGroup.stocks.length > 0)
                    .map((dayGroup) => (
                    <div key={dayGroup.date}>
                      {/* 日期标题 - 可点击折叠 */}
                      <div
                        className="flex items-center gap-1.5 mb-2 cursor-pointer select-none"
                        onClick={() => {
                          setCollapsedDates((prev) => {
                            const next = new Set(prev);
                            if (next.has(dayGroup.date)) {
                              next.delete(dayGroup.date);
                            } else {
                              next.add(dayGroup.date);
                            }
                            return next;
                          });
                        }}
                      >
                        <ChevronDown
                          className={cn(
                            "w-3 h-3 text-slate-400 transition-transform",
                            collapsedDates.has(dayGroup.date) && "-rotate-90"
                          )}
                        />
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600">
                          {formatDate(dayGroup.date)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {dayGroup.stocks.length}只
                        </span>
                      </div>

                      {/* 该日期下的股票列表 - 折叠时隐藏 */}
                      {!collapsedDates.has(dayGroup.date) && (
                      <div className="flex flex-wrap gap-1.5">
                        {dayGroup.stocks.map((stock) => (
                          <div
                            key={`${dayGroup.date}-${stock.code}`}
                            onClick={() =>
                              handleSelectStock({
                                code: stock.code,
                                name: stock.name,
                                latest: stock.latest,
                                changeRate: stock.changeRate,
                                date: dayGroup.date,
                                timePreview: stock.timePreview,
                                marketType: stock.marketType,
                                source: stock.source,
                                sourceBlockName: stock.sourceBlockName,
                              })
                            }
                            className={cn(
                              "w-[110px] flex flex-col px-2 py-1 border border-slate-200 hover:bg-orange-50/50 transition-colors cursor-pointer text-xs",
                              !stock.hasPrice && "border-dashed border-slate-200/60",
                              selectedStock?.code === stock.code &&
                                selectedStock?.date === dayGroup.date &&
                                "bg-orange-50/60 border-orange-200 border-solid"
                            )}
                          >
                            <div className="flex items-center gap-1">
                              <span
                                className={cn(
                                  "font-medium truncate max-w-[60px]",
                                  selectedStock?.code === stock.code &&
                                    selectedStock?.date === dayGroup.date
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
                  ))}
                </div>
              )}

            </div>
          )}
        </div>

        <StockDetailPanel
          selectedStock={selectedStock}
          getNote={getNote}
          saveNote={saveNote}
          formatDate={formatDate}
          username={username}
          noteHeightClass="h-42"
          emptyText="点击股票查看详情"
          stockDetailOpen={stockDetailOpen}
          setStockDetailOpen={setStockDetailOpen}
          openNoteRequest={openNoteRequest}
        />
      </div>
    </div>
  );
}