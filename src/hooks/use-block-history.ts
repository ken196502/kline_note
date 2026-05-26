"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DayBlockData } from "@/types/block-data";

interface UseBlockHistoryResult {
  data: DayBlockData[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
}

export function useBlockHistory(initialDays: number = 5): UseBlockHistoryResult {
  const [data, setData] = useState<DayBlockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 加载数据
  const fetchData = useCallback(
    async (startDate?: string) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          days: String(initialDays),
        });

        if (startDate) {
          params.set("startDate", startDate);
        }

        const response = await fetch(`/api/block-history?${params.toString()}`);
        
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

        setHasMore(result.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    },
    [initialDays]
  );

  // 初始加载
  useEffect(() => {
    fetchData();
  }, []);

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

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
  };
}
