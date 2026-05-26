"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { DayBlockDetailData, BlockData } from "@/types/block-data";

interface UseBlockDetailResult {
  data: DayBlockDetailData[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  allBlocks: BlockData[];
}

export function useBlockDetail(code: string, initialDays: number = 10): UseBlockDetailResult {
  const [data, setData] = useState<DayBlockDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [allBlocksFromDetail, setAllBlocksFromDetail] = useState<BlockData[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 加载数据
  const fetchData = useCallback(
    async (startDate?: string) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          code,
          days: String(initialDays),
        });

        if (startDate) {
          params.set("startDate", startDate);
        }

        const response = await fetch(`/api/block-detail?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (startDate) {
          // 追加数据
          setData((prev) => [...prev, ...result.data]);
        } else {
          // 初始加载
          setData(result.data);
        }

        // 收集所有板块信息
        const newBlocks: BlockData[] = [];
        result.data.forEach((dayData: DayBlockDetailData) => {
          newBlocks.push(dayData.block);
        });
        
        if (startDate) {
          setAllBlocksFromDetail((prev) => [...prev, ...newBlocks]);
        } else {
          setAllBlocksFromDetail(newBlocks);
        }

        setHasMore(result.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    },
    [code, initialDays]
  );

  // 初始加载
  useEffect(() => {
    setData([]);
    setAllBlocksFromDetail([]);
    fetchData();
  }, [code]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (loading || !hasMore || data.length === 0) return;

    // 获取最后一个日期的上一个交易日
    const lastDate = data[data.length - 1].date;
    fetchData(lastDate);
  }, [loading, hasMore, data, fetchData]);

  // 设置 Intersection Observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadMore]);

  // 同时从历史列表页收集板块，保证更全的板块列表
  const [historyBlocks, setHistoryBlocks] = useState<BlockData[]>([]);
  
  useEffect(() => {
    // 尝试从历史列表API获取更全面的板块列表
    const fetchHistoryBlocks = async () => {
      try {
        const response = await fetch("/api/block-history?days=5");
        if (response.ok) {
          const result = await response.json();
          const blocks: BlockData[] = [];
          result.data.forEach((dayData: any) => {
            dayData.blocks.forEach((b: BlockData) => {
              blocks.push(b);
            });
          });
          setHistoryBlocks(blocks);
        }
      } catch {
        // 忽略
      }
    };
    fetchHistoryBlocks();
  }, []);

  // 合并去重板块
  const allBlocks = useMemo(() => {
    const blockMap = new Map<string, BlockData>();
    [...allBlocksFromDetail, ...historyBlocks].forEach(b => {
      if (!blockMap.has(b.code)) {
        blockMap.set(b.code, b);
      }
    });
    return Array.from(blockMap.values());
  }, [allBlocksFromDetail, historyBlocks]);

  return { data, loading, error, hasMore, loadMore, allBlocks };
}
