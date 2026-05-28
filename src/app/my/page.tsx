"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  LogOut,
  RefreshCw,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useCustomBlocks } from "@/hooks/use-custom-blocks";
import { useCustomDates } from "@/hooks/use-custom-dates";
import type { CustomBlock, CustomBlockStock } from "@/types/custom-block";
import type { CustomDate } from "@/types/custom-date";
import { EditDatePanel } from "@/components/edit-date-panel";
import { StockDetailPanel, type StockDetailInfo } from "@/components/stock-detail-panel";
import { DateStockGroup, type DateStockItem } from "@/components/date-stock-group";

// 历史行情日期分组类型
interface HistoryDayGroup {
  date: string;
  customDateId: number;
  stocks: DateStockItem[];
}

export default function MyPage() {
  const router = useRouter();
  const { authenticated, username, loading: authLoading, logout } = useAuth();
  const {
    blocks,
    loading: blocksLoading,
    createBlock,
    deleteBlock,
    renameBlock,
  } = useCustomBlocks();

  // 当前选中的自定义板块
  const [selectedBlock, setSelectedBlock] = useState<CustomBlock | null>(null);

  // 自定义日期 hook（依赖 selectedBlock.id）
  const {
    dates: customDates,
    loading: datesLoading,
    createDate,
    deleteDate,
    addStockToDate,
    removeStockFromDate,
    reorderStocks,
    updateRemark,
    fetchDates: refetchDates,
  } = useCustomDates(selectedBlock?.id ?? null);

  // 添加日期相关状态
  const [addingDate, setAddingDate] = useState(false);
  const [newDateValue, setNewDateValue] = useState("");
  // 自定义板块的股票数据
  const [blockStocks, setBlockStocks] = useState<CustomBlockStock[]>([]);
  const [stocksDate, setStocksDate] = useState<string | null>(null);
  const [stocksLoading, setStocksLoading] = useState(false);

  // 历史行情数据（按日期分组）
  const [historyData, setHistoryData] = useState<HistoryDayGroup[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 当前选中的股票
  const [selectedStock, setSelectedStock] = useState<StockDetailInfo | null>(null);

  // 编辑日期模式
  const [editingDate, setEditingDate] = useState<CustomDate | null>(null);

  // 内联重命名
  const [renamingBlockId, setRenamingBlockId] = useState<number | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [renamingLoading, setRenamingLoading] = useState(false);

  // 日期分组折叠状态
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  // 只看涨停
  const [showOnlyLimitUp, setShowOnlyLimitUp] = useState(false);

  // 拖动排序相关状态
  const [draggingStock, setDraggingStock] = useState<string | null>(null); // 正在拖动的 stockCode
  const [dragOverStock, setDragOverStock] = useState<string | null>(null); // 拖动经过的目标 stockCode
  const [dragDateId, setDragDateId] = useState<number | null>(null); // 当前拖动所在的日期

  // 创建板块
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");

  // 修复股票名称
  const [fixingNames, setFixingNames] = useState(false);
  const [fixResult, setFixResult] = useState<string>("");

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

  // 默认选中第一个自定义板块
  useEffect(() => {
    if (!selectedBlock && blocks.length > 0) {
      setSelectedBlock(blocks[0]);
    }
  }, [blocks, selectedBlock]);

  // 选中自定义板块时加载历史行情（基于自定义日期）
  useEffect(() => {
    if (!selectedBlock) {
      setHistoryData([]);
      setBlockStocks([]);
      setStocksDate(null);
      return;
    }
    const loadHistory = async () => {
      const isFirstLoad = historyData.length === 0;
      if (isFirstLoad) {
        setHistoryLoading(true);
        setStocksLoading(true);
      }
      const res = await fetch(`/api/custom-block-stocks/history?blockId=${selectedBlock.id}`);
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
      } else {
        setHistoryData([]);
        setBlockStocks([]);
        setStocksDate(null);
      }
      setHistoryLoading(false);
      setStocksLoading(false);
    };
    loadHistory();
  }, [selectedBlock?.id, customDates.length]);

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

  // 修复所有股票名称乱码
  const handleFixNames = async () => {
    setFixingNames(true);
    setFixResult("");
    try {
      const res = await fetch("/api/custom-block-stocks/fix-names", { method: "POST" });
      const data = await res.json();
      if (data.fixed > 0) {
        setFixResult(`已修复 ${data.fixed} 个股票名称`);
      } else {
        setFixResult("无需修复");
      }
      setTimeout(() => setFixResult(""), 3000);
    } finally {
      setFixingNames(false);
    }
  };

  // 刷新历史行情数据（从服务器重新加载）
  const refreshStocks = useCallback(
    async (blockId: number) => {
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
    },
    []
  );

  // 添加自定义日期
  const handleAddDate = async () => {
    if (!newDateValue) return;
    const newDate = await createDate(newDateValue);
    if (newDate) {
      setAddingDate(false);
      setNewDateValue("");
      setEditingDate(newDate);
    }
  };

  // 删除自定义日期
  const handleDeleteDate = async (dateId: number) => {
    await deleteDate(dateId);
    if (selectedBlock) {
      refreshStocks(selectedBlock.id);
    }
  };

  // 拖动排序处理
  const handleDragStart = (stockCode: string, dateId: number) => {
    setDraggingStock(stockCode);
    setDragDateId(dateId);
  };

  const handleDragOver = (stockCode: string, dateId: number) => {
    if (draggingStock && dragDateId === dateId && draggingStock !== stockCode) {
      setDragOverStock(stockCode);
    }
  };

  const handleDragEnd = async () => {
    if (!draggingStock || !dragOverStock || !dragDateId) {
      setDraggingStock(null);
      setDragOverStock(null);
      setDragDateId(null);
      return;
    }

    const currentGroup = historyData.find((g) => g.customDateId === dragDateId);
    if (!currentGroup) {
      setDraggingStock(null);
      setDragOverStock(null);
      setDragDateId(null);
      return;
    }

    const stocks = [...currentGroup.stocks];
    const dragIndex = stocks.findIndex((s) => s.code === draggingStock);
    const overIndex = stocks.findIndex((s) => s.code === dragOverStock);
    if (dragIndex === -1 || overIndex === -1) {
      setDraggingStock(null);
      setDragOverStock(null);
      setDragDateId(null);
      return;
    }

    const [removed] = stocks.splice(dragIndex, 1);
    stocks.splice(overIndex, 0, removed);

    // 立即更新本地 historyData，让 UI 立刻反映新顺序
    setHistoryData((prev) =>
      prev.map((g) =>
        g.customDateId === dragDateId
          ? { ...g, stocks: stocks }
          : g
      )
    );

    const stockOrders = stocks.map((s, i) => ({
      stockCode: s.code,
      sortOrder: i,
    }));

    await reorderStocks(dragDateId, stockOrders);

    setDraggingStock(null);
    setDragOverStock(null);
    setDragDateId(null);
  };

  // 编辑日期面板回调
  const handleAddStockToDate = async (stockCode: string, stockName: string) => {
    if (!editingDate) return false;
    const ok = await addStockToDate(editingDate.id, stockCode, stockName);
    if (ok) {
      // 更新 editingDate 的本地 stocks
      setEditingDate((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stocks: [
            ...prev.stocks,
            {
              id: -1, // 临时ID
              customDateId: prev.id,
              stockCode,
              stockName,
              sortOrder: prev.stocks.length,
              remark: "",
            },
          ],
        };
      });
      if (selectedBlock) {
        refreshStocks(selectedBlock.id);
      }
    }
    return ok;
  };

  const handleRemoveStockFromDate = async (stockCode: string) => {
    if (!editingDate) return false;
    const ok = await removeStockFromDate(editingDate.id, stockCode);
    if (ok) {
      setEditingDate((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stocks: prev.stocks.filter((s) => s.stockCode !== stockCode),
        };
      });
      if (selectedBlock) {
        refreshStocks(selectedBlock.id);
      }
    }
    return ok;
  };

  const handleDeleteDateFromEditor = async () => {
    if (!editingDate) return;
    await deleteDate(editingDate.id);
    setEditingDate(null);
    if (selectedBlock) {
      refreshStocks(selectedBlock.id);
    }
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

  // K线数据加载完成后，延迟刷新历史行情（等待服务端异步写入stock_daily_price）
  const handleKLineLoaded = useCallback(
    (_symbol: string) => {
      if (!selectedBlock) return;
      setTimeout(() => {
        refreshStocks(selectedBlock.id);
      }, 1000);
    },
    [selectedBlock, refreshStocks]
  );

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

  

  // ===== 编辑日期模式 =====
  if (editingDate) {
    return (
      <EditDatePanel
        customDate={editingDate}
        onAddStock={handleAddStockToDate}
        onRemoveStock={handleRemoveStockFromDate}
        onDeleteDate={handleDeleteDateFromEditor}
        onBack={() => setEditingDate(null)}
      />
    );
  }

  // ===== 展示模式 =====
  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* 三列布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 第一列 - 自定义板块列表 */}
        <div className="w-48 lg:w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          {/* 板块列表 */}
          <div className="flex-1 overflow-y-auto p-1">
            {/* 添加板块按钮 - 置顶 */}
            <div className="p-1 mb-1">
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
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreatingBlock(true)}
                    className="flex-1 h-7 text-xs text-slate-500 hover:text-orange-600"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    添加板块
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFixNames}
                    disabled={fixingNames}
                    className="h-7 px-1.5 text-slate-400 hover:text-orange-600"
                    title="修复股票名称乱码"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", fixingNames && "animate-spin")} />
                  </Button>
                </div>
              )}
              {fixResult && (
                <div className="text-[10px] text-orange-600 px-1 mt-0.5">{fixResult}</div>
              )}
            </div>

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
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 登出按钮 - 置底 */}
          <div className="p-2 border-t border-slate-100">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-slate-400 truncate">{username}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-slate-400 hover:text-red-500 h-7 w-7 p-0 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* 第二列 - 历史行情（按自定义日期分组） */}
        <div className="flex-1 lg:min-w-[40%] lg:border-r lg:border-slate-200 bg-white overflow-y-auto relative">
          {!selectedBlock ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              请先选择或创建一个自定义板块
            </div>
          ) : (
            <div className="p-3">
              {/* 顶部：添加日期按钮 + 操作按钮 */}
              <div className="flex items-center gap-1.5 -mt-1 mb-2 flex-wrap">
                {/* 添加日期按钮 - 左上角 */}
                {addingDate ? (
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
                )}

                <div className="flex-1" />

                {/* 右侧操作按钮 - 始终显示 */}
                <>
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
                </>
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
                    .map((dayGroup) => ({
                      ...dayGroup,
                      stocks: showOnlyLimitUp
                        ? dayGroup.stocks.filter((s) => s.source === "limitUp")
                        : dayGroup.stocks,
                    }))
                    .filter((dayGroup) => dayGroup.stocks.length > 0 || !showOnlyLimitUp)
                    .map((dayGroup) => (
                      <DateStockGroup
                        key={dayGroup.date}
                        date={dayGroup.date}
                        customDateId={dayGroup.customDateId}
                        stocks={dayGroup.stocks}
                        collapsed={collapsedDates.has(dayGroup.date)}
                        selectedCode={selectedStock?.code ?? null}
                        selectedDate={selectedStock?.date ?? null}
                        draggingStock={draggingStock}
                        dragOverStock={dragOverStock}
                        dragDateId={dragDateId}
                        formatDate={formatDate}
                        customDates={customDates}
                        onToggleCollapse={(d) => {
                          setCollapsedDates((prev) => {
                            const next = new Set(prev);
                            if (next.has(d)) next.delete(d);
                            else next.add(d);
                            return next;
                          });
                        }}
                        onEdit={(cd) => setEditingDate(cd)}
                        onDelete={handleDeleteDate}
                        onSelectStock={(stock) =>
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
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                </div>
              )}

            </div>
          )}
        </div>

        <StockDetailPanel
          selectedStock={selectedStock}
          getNote={(code, date) => {
            const group = historyData.find((g) => g.date === date);
            const stock = group?.stocks.find((s) => s.code === code);
            return stock?.remark || "";
          }}
          saveNote={async (code, date, content) => {
            const group = historyData.find((g) => g.date === date);
            if (group?.customDateId) {
              await updateRemark(group.customDateId, code, content);
              // 更新 historyData 中的 remark
              setHistoryData((prev) =>
                prev.map((g) =>
                  g.date === date
                    ? {
                        ...g,
                        stocks: g.stocks.map((s) =>
                          s.code === code ? { ...s, remark: content } : s
                        ),
                      }
                    : g
                )
              );
              return true;
            }
            return false;
          }}
          formatDate={formatDate}
          username={username}
          noteHeightClass="h-42"
          emptyText="点击股票查看详情"
          stockDetailOpen={stockDetailOpen}
          setStockDetailOpen={setStockDetailOpen}
          openNoteRequest={openNoteRequest}
          onKLineLoaded={handleKLineLoaded}
        />
      </div>
    </div>
  );
}