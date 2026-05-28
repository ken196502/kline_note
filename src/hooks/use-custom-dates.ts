"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomDate, CustomDateStock } from "@/types/custom-date";

export function useCustomDates(blockId: number | null) {
  const [dates, setDates] = useState<CustomDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDates = useCallback(async () => {
    if (!blockId) {
      setDates([]);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/custom-dates?blockId=${blockId}`);
    if (!res.ok) {
      setError(new Error("获取自定义日期失败"));
      setLoading(false);
      return;
    }
    const result = await res.json();
    setDates(result.data || []);
    setLoading(false);
  }, [blockId]);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  // 创建自定义日期
  const createDate = useCallback(
    async (date: string): Promise<CustomDate | null> => {
      if (!blockId) return null;
      const res = await fetch("/api/custom-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, customBlockId: blockId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "创建日期失败"));
        return null;
      }
      const result = await res.json();
      const newDate = result.data as CustomDate;
      setDates((prev) => [...prev, newDate]);
      return newDate;
    },
    [blockId]
  );

  // 删除自定义日期
  const deleteDate = useCallback(
    async (dateId: number): Promise<boolean> => {
      const res = await fetch(`/api/custom-dates?dateId=${dateId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(new Error("删除日期失败"));
        return false;
      }
      setDates((prev) => prev.filter((d) => d.id !== dateId));
      return true;
    },
    []
  );

  // 添加股票到日期
  const addStockToDate = useCallback(
    async (dateId: number, stockCode: string, stockName: string): Promise<boolean> => {
      const res = await fetch(`/api/custom-dates/${dateId}/stocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode, stockName }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(new Error(data.error || "添加股票失败"));
        return false;
      }
      const result = await res.json();
      const newStock = result.data as CustomDateStock;
      // 更新本地状态
      setDates((prev) =>
        prev.map((d) =>
          d.id === dateId
            ? { ...d, stocks: [...d.stocks, newStock] }
            : d
        )
      );
      return true;
    },
    []
  );

  // 从日期移除股票
  const removeStockFromDate = useCallback(
    async (dateId: number, stockCode: string): Promise<boolean> => {
      const res = await fetch(
        `/api/custom-dates/${dateId}/stocks?stockCode=${encodeURIComponent(stockCode)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setError(new Error("移除股票失败"));
        return false;
      }
      setDates((prev) =>
        prev.map((d) =>
          d.id === dateId
            ? { ...d, stocks: d.stocks.filter((s) => s.stockCode !== stockCode) }
            : d
        )
      );
      return true;
    },
    []
  );

  // 拖动排序
  const reorderStocks = useCallback(
    async (dateId: number, stockOrders: { stockCode: string; sortOrder: number }[]): Promise<boolean> => {
      const res = await fetch(`/api/custom-dates/${dateId}/stocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockOrders }),
      });
      if (!res.ok) {
        setError(new Error("排序失败"));
        return false;
      }
      // 更新本地状态
      const orderMap = new Map(stockOrders.map((s) => [s.stockCode, s.sortOrder]));
      setDates((prev) =>
        prev.map((d) =>
          d.id === dateId
            ? {
                ...d,
                stocks: d.stocks
                  .map((s) => ({
                    ...s,
                    sortOrder: orderMap.get(s.stockCode) ?? s.sortOrder,
                  }))
                  .sort((a, b) => a.sortOrder - b.sortOrder),
              }
            : d
        )
      );
      return true;
    },
    []
  );

  // 更新备注
  const updateRemark = useCallback(
    async (dateId: number, stockCode: string, remark: string): Promise<boolean> => {
      const res = await fetch(`/api/custom-dates/${dateId}/stocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode, remark }),
      });
      if (!res.ok) {
        setError(new Error("更新备注失败"));
        return false;
      }
      // 更新本地状态
      setDates((prev) =>
        prev.map((d) =>
          d.id === dateId
            ? {
                ...d,
                stocks: d.stocks.map((s) =>
                  s.stockCode === stockCode ? { ...s, remark } : s
                ),
              }
            : d
        )
      );
      return true;
    },
    []
  );

  return {
    dates,
    loading,
    error,
    fetchDates,
    createDate,
    deleteDate,
    addStockToDate,
    removeStockFromDate,
    reorderStocks,
    updateRemark,
  };
}