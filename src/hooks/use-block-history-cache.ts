"use client";

import { useState, useCallback, useRef } from "react";
import type { HistoryDayGroup } from "@/components/block-history-list";

// 所有板块的历史行情缓存
// key: blockId, value: HistoryDayGroup[]
const globalCache = new Map<number, HistoryDayGroup[]>();
// 正在加载的板块集合，防止重复请求
const loadingSet = new Set<number>();

export function useBlockHistoryCache() {
  const [, forceUpdate] = useState(0);
  const loadingRef = useRef(loadingSet);

  const triggerUpdate = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  // 获取缓存数据
  const getCached = useCallback((blockId: number): HistoryDayGroup[] | null => {
    return globalCache.get(blockId) ?? null;
  }, []);

  // 检查是否正在加载
  const isLoading = useCallback((blockId: number): boolean => {
    return loadingRef.current.has(blockId);
  }, []);

  // 预加载单个板块（如果缓存中没有的话）
  const prefetchBlock = useCallback(
    async (blockId: number) => {
      if (globalCache.has(blockId) || loadingRef.current.has(blockId)) return;
      loadingRef.current.add(blockId);
      triggerUpdate();
      const res = await fetch(`/api/custom-block-stocks/history?blockId=${blockId}`);
      if (res.ok) {
        const result = await res.json();
        globalCache.set(blockId, result.data || []);
      }
      loadingRef.current.delete(blockId);
      triggerUpdate();
    },
    [triggerUpdate]
  );

  // 批量预加载所有板块
  const prefetchAll = useCallback(
    async (blockIds: number[]) => {
      const toLoad = blockIds.filter(
        (id) => !globalCache.has(id) && !loadingRef.current.has(id)
      );
      if (toLoad.length === 0) return;

      for (const id of toLoad) {
        loadingRef.current.add(id);
      }
      triggerUpdate();

      // 并行请求
      const results = await Promise.allSettled(
        toLoad.map(async (id) => {
          const res = await fetch(`/api/custom-block-stocks/history?blockId=${id}`);
          if (res.ok) {
            const result = await res.json();
            return { id, data: (result.data || []) as HistoryDayGroup[] };
          }
          return { id, data: [] as HistoryDayGroup[] };
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          globalCache.set(r.value.id, r.value.data);
        }
        loadingRef.current.delete(
          r.status === "fulfilled" ? r.value.id : toLoad[results.indexOf(r)]
        );
      }
      triggerUpdate();
    },
    [triggerUpdate]
  );

  // 更新缓存中某个板块的数据（不触发当前显示替换）
  const updateCache = useCallback(
    (blockId: number, data: HistoryDayGroup[]) => {
      globalCache.set(blockId, data);
      triggerUpdate();
    },
    [triggerUpdate]
  );

  // 使某个板块缓存失效
  const invalidate = useCallback(
    (blockId: number) => {
      globalCache.delete(blockId);
      triggerUpdate();
    },
    [triggerUpdate]
  );

  // 清空所有缓存
  const clearAll = useCallback(() => {
    globalCache.clear();
    triggerUpdate();
  }, [triggerUpdate]);

  return {
    getCached,
    isLoading,
    prefetchBlock,
    prefetchAll,
    updateCache,
    invalidate,
    clearAll,
  };
}