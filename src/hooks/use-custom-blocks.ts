"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomBlock, CustomBlockStock } from "@/types/custom-block";

export function useCustomBlocks() {
  const [blocks, setBlocks] = useState<CustomBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/custom-blocks");
    if (!res.ok) throw new Error("获取自定义板块失败");
    const result = await res.json();
    setBlocks(result.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBlocks().catch((err) => {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setLoading(false);
    });
  }, [fetchBlocks]);

  const createBlock = useCallback(
    async (name: string): Promise<CustomBlock | null> => {
      const res = await fetch("/api/custom-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "创建失败"));
        return null;
      }
      const result = await res.json();
      const newBlock = result.data as CustomBlock;
      setBlocks((prev) => [...prev, newBlock]);
      return newBlock;
    },
    []
  );

  const deleteBlock = useCallback(async (id: number): Promise<boolean> => {
    const res = await fetch(`/api/custom-blocks/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError(new Error("删除失败"));
      return false;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    return true;
  }, []);

  // 关联板块
  const linkBlock = useCallback(
    async (id: number, blockCode: string, blockName?: string): Promise<CustomBlock | null> => {
      const res = await fetch(`/api/custom-blocks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "linkBlock", blockCode, blockName: blockName || "" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "关联板块失败"));
        return null;
      }
      const result = await res.json();
      const updatedBlock = result.data as CustomBlock;
      setBlocks((prev) => prev.map((b) => (b.id === id ? updatedBlock : b)));
      return updatedBlock;
    },
    []
  );

  // 取消关联板块
  const unlinkBlock = useCallback(
    async (id: number, blockCode: string): Promise<CustomBlock | null> => {
      const res = await fetch(`/api/custom-blocks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlinkBlock", blockCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "取消关联失败"));
        return null;
      }
      const result = await res.json();
      const updatedBlock = result.data as CustomBlock;
      setBlocks((prev) => prev.map((b) => (b.id === id ? updatedBlock : b)));
      return updatedBlock;
    },
    []
  );

  // 手动添加股票
  const addStock = useCallback(
    async (id: number, stockCode: string, stockName?: string): Promise<CustomBlock | null> => {
      const res = await fetch(`/api/custom-blocks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addStock", stockCode, stockName: stockName || "" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "添加股票失败"));
        return null;
      }
      const result = await res.json();
      const updatedBlock = result.data as CustomBlock;
      setBlocks((prev) => prev.map((b) => (b.id === id ? updatedBlock : b)));
      return updatedBlock;
    },
    []
  );

  // 手动移除股票
  const removeStock = useCallback(
    async (id: number, stockCode: string): Promise<CustomBlock | null> => {
      const res = await fetch(`/api/custom-blocks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeStock", stockCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "移除股票失败"));
        return null;
      }
      const result = await res.json();
      const updatedBlock = result.data as CustomBlock;
      setBlocks((prev) => prev.map((b) => (b.id === id ? updatedBlock : b)));
      return updatedBlock;
    },
    []
  );

  // 重命名板块
  const renameBlock = useCallback(
    async (id: number, name: string): Promise<CustomBlock | null> => {
      const res = await fetch(`/api/custom-blocks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "重命名失败"));
        return null;
      }
      const result = await res.json();
      const updatedBlock = result.data as CustomBlock;
      setBlocks((prev) => prev.map((b) => (b.id === id ? updatedBlock : b)));
      return updatedBlock;
    },
    []
  );

  // 批量更新板块排序
  const reorderBlocks = useCallback(
    async (orders: { id: number; sortOrder: number }[]): Promise<boolean> => {
      const res = await fetch("/api/custom-blocks/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "排序更新失败"));
        return false;
      }
      // 更新本地 blocks：按 sortOrder 重新排序
      const orderMap = new Map(orders.map((o) => [o.id, o.sortOrder]));
      setBlocks((prev) => {
        const updated = prev.map((b) => {
          const newOrder = orderMap.get(b.id);
          return newOrder !== undefined ? { ...b, sortOrder: newOrder } : b;
        });
        updated.sort((a, b) => a.sortOrder - b.sortOrder);
        return updated;
      });
      return true;
    },
    []
  );

  // 获取自定义板块的股票数据
  const fetchBlockStocks = useCallback(
    async (blockId: number): Promise<{ stocks: CustomBlockStock[]; date: string | null }> => {
      const res = await fetch(`/api/custom-block-stocks?blockId=${blockId}`);
      if (!res.ok) throw new Error("获取股票数据失败");
      const result = await res.json();
      return { stocks: result.data || [], date: result.date || null };
    },
    []
  );

  return {
    blocks,
    loading,
    error,
    fetchBlocks,
    createBlock,
    deleteBlock,
    linkBlock,
    unlinkBlock,
    addStock,
    removeStock,
    renameBlock,
    reorderBlocks,
    fetchBlockStocks,
  };
}