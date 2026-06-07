"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useCustomBlocks } from "@/hooks/use-custom-blocks";
import { useCustomDates } from "@/hooks/use-custom-dates";
import { useBlockHistoryCache } from "@/hooks/use-block-history-cache";
import { useStockKlinePoller } from "@/hooks/use-stock-kline-poller";
import { useStockChanges } from "@/hooks/use-stock-changes";
import type { CustomBlock, CustomBlockStock } from "@/types/custom-block";
import type { CustomDate } from "@/types/custom-date";
import type { StockDetailInfo } from "@/components/stock-detail-panel";
import type { HistoryDayGroup } from "@/components/block-history-list";
import { toast } from "sonner";

export function useMyPageState() {
  const router = useRouter();
  const { authenticated, username, loading: authLoading, logout } = useAuth();
  const {
    blocks,
    loading: blocksLoading,
    createBlock,
    deleteBlock,
    renameBlock,
    reorderBlocks,
  } = useCustomBlocks();

  // 板块历史行情缓存
  const blockCache = useBlockHistoryCache();

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
    updateStockColor,
    fetchDates: refetchDates,
  } = useCustomDates(selectedBlock?.id ?? null);

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

  // 拖动排序相关状态
  const [draggingStock, setDraggingStock] = useState<string | null>(null);
  const [dragOverStock, setDragOverStock] = useState<string | null>(null);
  const [dragDateId, setDragDateId] = useState<number | null>(null);

  // 板块拖动排序状态
  const [draggingBlockId, setDraggingBlockId] = useState<number | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<number | null>(null);

  // 创建板块
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");

  // 修复股票名称
  const [fixingNames, setFixingNames] = useState(false);
  const [fixResult, setFixResult] = useState<string>("");

  // 刷新市场行情
  const [refreshingMarket, setRefreshingMarket] = useState(false);

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

  // 登录后/板块列表加载后，预加载所有板块的历史行情
  useEffect(() => {
    if (authenticated && blocks.length > 0) {
      blockCache.prefetchAll(blocks.map((b) => b.id));
    }
  }, [authenticated, blocks]);

  // 选中自定义板块时加载历史行情（优先从缓存读取）
  useEffect(() => {
    if (!selectedBlock) {
      setHistoryData([]);
      setBlockStocks([]);
      setStocksDate(null);
      return;
    }

    const cached = blockCache.getCached(selectedBlock.id);
    if (cached) {
      setHistoryData(cached);
      if (cached.length > 0) {
        const latestGroup = cached[0];
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
      setHistoryLoading(false);
      setStocksLoading(false);
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
        blockCache.updateCache(selectedBlock.id, groups);
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
      blockCache.prefetchBlock(block.id);
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

  // 刷新最近2个交易日的市场行情
  const handleRefreshMarket = async () => {
    setRefreshingMarket(true);
    try {
      const res = await fetch("/api/refresh-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = data.results.filter((r: any) => r.status === "updated").length;
        const skipped = data.results.filter((r: any) => r.status === "skipped").length;
        const failed = data.results.filter((r: any) => r.status === "failed").length;
        toast.success(`刷新完成：更新 ${updated} 天，跳过 ${skipped} 天，失败 ${failed} 天`);
        blockCache.clearAll();
        if (blocks.length > 0) {
          blockCache.prefetchAll(blocks.map((b) => b.id));
        }
        if (selectedBlock) {
          refreshStocks(selectedBlock.id);
        }
      } else {
        toast.error("刷新失败：" + (data.error || "未知错误"));
      }
    } catch (error) {
      console.error("刷新市场行情失败:", error);
      toast.error("刷新失败：" + String(error));
    } finally {
      setRefreshingMarket(false);
    }
  };

  // 刷新历史行情数据
  const refreshStocks = useCallback(
    async (blockId: number) => {
      const res = await fetch(`/api/custom-block-stocks/history?blockId=${blockId}`);
      if (res.ok) {
        const result = await res.json();
        const groups: HistoryDayGroup[] = result.data || [];
        blockCache.updateCache(blockId, groups);
        const isCurrentlyViewing = selectedBlock?.id === blockId;
        const hasSelectedStock = selectedStock !== null;
        if (isCurrentlyViewing && !hasSelectedStock) {
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
        } else if (isCurrentlyViewing && hasSelectedStock) {
          setHistoryData(groups);
        }
      }
    },
    [blockCache, selectedBlock?.id, selectedStock]
  );

  // 添加自定义日期
  const handleAddDate = async (date: string) => {
    if (!date) return;
    const newDate = await createDate(date);
    if (newDate) {
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

    setHistoryData((prev) =>
      prev.map((g) =>
        g.customDateId === dragDateId ? { ...g, stocks } : g
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
  const handleAddStockToDate = async (stockCode: string, stockName: string): Promise<boolean> => {
    if (!editingDate) return false;
    const result = await addStockToDate(editingDate.id, stockCode, stockName);
    if (result.success) {
      setEditingDate((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stocks: [
            ...prev.stocks,
            {
              id: -1,
              customDateId: prev.id,
              stockCode,
              stockName,
              sortOrder: prev.stocks.length,
              remark: "",
              stockNameColor: "",
            },
          ],
        };
      });
      if (selectedBlock) {
        refreshStocks(selectedBlock.id);
      }
    } else if (result.error) {
      toast.error(result.error);
    }
    return result.success;
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

  // 板块拖动排序处理
  const handleBlockDragStart = (blockId: number) => {
    setDraggingBlockId(blockId);
  };

  const handleBlockDragOver = (e: React.DragEvent, blockId: number) => {
    e.preventDefault();
    if (draggingBlockId !== null && draggingBlockId !== blockId) {
      setDragOverBlockId(blockId);
    }
  };

  const handleBlockDragEnd = async () => {
    if (draggingBlockId === null || dragOverBlockId === null) {
      setDraggingBlockId(null);
      setDragOverBlockId(null);
      return;
    }

    const dragIndex = blocks.findIndex((b) => b.id === draggingBlockId);
    const overIndex = blocks.findIndex((b) => b.id === dragOverBlockId);
    if (dragIndex === -1 || overIndex === -1) {
      setDraggingBlockId(null);
      setDragOverBlockId(null);
      return;
    }

    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(dragIndex, 1);
    newBlocks.splice(overIndex, 0, removed);

    const orders = newBlocks.map((b, i) => ({ id: b.id, sortOrder: i }));
    await reorderBlocks(orders);

    setDraggingBlockId(null);
    setDragOverBlockId(null);
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

  // 不间断轮询
  const { prioritizeStock } = useStockKlinePoller({
    blockId: selectedBlock?.id ?? null,
    historyData,
    onRefreshHistory: refreshStocks,
  });

  // 异动播报
  const currentStockCodes = historyData.length > 0
    ? [...new Set(historyData.flatMap((g) => g.stocks.map((s) => s.code)))]
    : [];
  const { changes: stockChanges, trading: isTrading, loading: changesLoading, blocked: changesBlocked, refresh: refreshChanges } = useStockChanges({
    stockCodes: currentStockCodes,
    enabled: !!selectedBlock,
  });

  // 选中股票查看详情
  const handleSelectStock = (stock: CustomBlockStock) => {
    if (historyLoading) return;
    setSelectedStock({
      code: stock.code,
      name: stock.name,
      marketType: stock.marketType ?? "",
      date: stock.date || stocksDate || "",
      blockName: stock.sourceBlockName || stock.name,
    });
    prioritizeStock(stock.code);
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

  return {
    // Auth
    authenticated,
    username,
    authLoading,
    logout,
    // Blocks
    blocks,
    blocksLoading,
    selectedBlock,
    setSelectedBlock,
    creatingBlock,
    setCreatingBlock,
    newBlockName,
    setNewBlockName,
    handleCreateBlock,
    handleFixNames,
    handleRefreshMarket,
    fixingNames,
    fixResult,
    refreshingMarket,
    // Rename
    renamingBlockId,
    renamingName,
    setRenamingName,
    renamingLoading,
    handleStartRename,
    handleConfirmRename,
    setRenamingBlockId,
    // Block drag
    draggingBlockId,
    dragOverBlockId,
    handleBlockDragStart,
    handleBlockDragOver,
    handleBlockDragEnd,
    setDragOverBlockId,
    // Dates
    customDates,
    datesLoading,
    editingDate,
    setEditingDate,
    handleAddDate,
    handleDeleteDate,
    handleAddStockToDate,
    handleRemoveStockFromDate,
    handleDeleteDateFromEditor,
    // History
    historyData,
    setHistoryData,
    historyLoading,
    blockStocks,
    stocksDate,
    stocksLoading,
    refreshStocks,
    // Stock drag
    draggingStock,
    dragOverStock,
    dragDateId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    // Selected stock
    selectedStock,
    setSelectedStock,
    handleSelectStock,
    // Collapsed dates
    collapsedDates,
    setCollapsedDates,
    // Market changes
    stockChanges,
    isTrading,
    changesLoading,
    changesBlocked,
    refreshChanges,
    // Detail panel
    stockDetailOpen,
    setStockDetailOpen,
    openNoteRequest,
    setOpenNoteRequest,
    // Utils
    formatDate,
    updateRemark,
    updateStockColor,
    addStockToDate,
  };
}