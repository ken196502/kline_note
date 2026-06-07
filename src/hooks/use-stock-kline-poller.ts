"use client";

import { useRef, useCallback, useEffect } from "react";
import type { HistoryDayGroup } from "@/components/block-history-list";

// 判断当前是否在A股交易时段（9:25 - 15:15）
function isInTradingSession(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  return timeInMinutes >= 565 && timeInMinutes <= 915;
}

interface StockPollItem {
  code: string;
  /** 上次更新日K（请求 /api/kline）的时间戳（ms），0 表示未更新过 */
  lastKLineUpdateAt: number;
}

interface UseStockKlinePollerOptions {
  /** 当前选中的板块 ID，null 则不轮询 */
  blockId: number | null;
  /** 当前板块的历史行情数据 */
  historyData: HistoryDayGroup[];
  /** 板块历史行情刷新回调（请求 /api/custom-block-stocks/history 并更新缓存和状态） */
  onRefreshHistory: (blockId: number) => Promise<void>;
  /** 轮询间隔（ms），默认 3000 */
  intervalMs?: number;
  /** 每次更新后刷新历史行情的延迟（ms），默认 800 */
  refreshDelayMs?: number;
}

export function useStockKlinePoller({
  blockId,
  historyData,
  onRefreshHistory,
  intervalMs = 1500,
  refreshDelayMs = 500,
}: UseStockKlinePollerOptions) {
  // 股票轮询列表，用 ref 存储以避免频繁触发 useEffect 重渲染
  const stockListRef = useRef<StockPollItem[]>([]);
  // 当前轮询索引
  const currentIndexRef = useRef(0);
  // 定时器 ID
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 当前板块 ID（用于检测切换）
  const currentBlockIdRef = useRef<number | null>(null);
  // 是否正在请求
  const fetchingRef = useRef(false);
  // onRefreshHistory 的最新引用
  const onRefreshHistoryRef = useRef(onRefreshHistory);
  onRefreshHistoryRef.current = onRefreshHistory;
  // historyData 最新引用
  const historyDataRef = useRef(historyData);
  historyDataRef.current = historyData;

  // 从 historyData 提取所有不重复的股票代码
  const extractStockCodes = useCallback((): string[] => {
    const codes: string[] = [];
    const seen = new Set<string>();
    for (const group of historyDataRef.current) {
      for (const stock of group.stocks) {
        if (!seen.has(stock.code)) {
          seen.add(stock.code);
          codes.push(stock.code);
        }
      }
    }
    return codes;
  }, []);

  // 判断某个股票是否需要更新日K
  const needsUpdate = useCallback((item: StockPollItem): boolean => {
    const now = Date.now();
    const timeSinceLastUpdate = now - item.lastKLineUpdateAt;

    // 从未更新过，需要更新
    if (item.lastKLineUpdateAt === 0) return true;

    // 在交易时段内：每 15 秒更新一次
    if (isInTradingSession() && timeSinceLastUpdate >= 15_000) return true;

    // 非交易时段：已更新过一次即可，不再重复请求
    // （原逻辑用 isCurrentTime15 判断，但非交易时段该值永远为 false，导致无限轮询）
    return false;
  }, []);

  // 将指定股票代码提到数组头部（当前轮询位置的下一个位置）
  const prioritizeStock = useCallback((stockCode: string) => {
    const list = stockListRef.current;
    const idx = list.findIndex((item) => item.code === stockCode);
    if (idx <= 0) return; // 已在头部或不存在

    const [item] = list.splice(idx, 1);

    // 插入到当前轮询索引的下一个位置（即接下来即将被轮询到的位置）
    const insertPos = currentIndexRef.current + 1;
    list.splice(insertPos, 0, item);
  }, []);

  // 重置股票列表（板块切换时）
  const resetStockList = useCallback(() => {
    const codes = extractStockCodes();
    const existingMap = new Map(
      stockListRef.current.map((item) => [item.code, item])
    );

    stockListRef.current = codes.map((code) => {
      const existing = existingMap.get(code);
      if (existing) return existing; // 保留已有的更新时间信息
      return { code, lastKLineUpdateAt: 0 };
    });

    currentIndexRef.current = 0;
  }, [extractStockCodes]);

  // 轮询一次：找到下一个需要更新的股票，请求其日K
  const pollOnce = useCallback(async () => {
    if (fetchingRef.current) return;
    if (stockListRef.current.length === 0) return;
    if (currentBlockIdRef.current === null) return;

    // 遍历列表，从 currentIndex 开始找到第一个需要更新的股票
    const list = stockListRef.current;
    const len = list.length;
    let targetIdx = -1;

    for (let i = 0; i < len; i++) {
      const checkIdx = (currentIndexRef.current + i) % len;
      if (needsUpdate(list[checkIdx]!)) {
        targetIdx = checkIdx;
        break;
      }
    }

    // 所有股票都不需要更新
    if (targetIdx === -1) {
      // 非交易时段所有股票已更新完，停止定时器避免空转
      // 交易时段不需要停止，因为 30 秒后会有新的更新需求
      if (!isInTradingSession() && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const item = list[targetIdx]!;
    currentIndexRef.current = (targetIdx + 1) % len;
    fetchingRef.current = true;

    // 请求日K数据（服务端会异步 upsert 到 stock_daily_price）
    const marketPrefix = item.code.startsWith("6") ? "sh" : "sz";
    const symbol = `${marketPrefix}${item.code}`;

    await fetch(`/api/kline?symbol=${symbol}&limit=30`);

    // 更新该股票的最后更新时间
    item.lastKLineUpdateAt = Date.now();

    fetchingRef.current = false;

    // 延迟后刷新板块历史行情（等待服务端异步写入 stock_daily_price）
    const bid = currentBlockIdRef.current;
    setTimeout(() => {
      onRefreshHistoryRef.current(bid);
    }, refreshDelayMs);
  }, [needsUpdate, refreshDelayMs]);

  // 启动/停止轮询
  const startPolling = useCallback(() => {
    if (timerRef.current) return; // 已在运行

    // 立即执行一次
    pollOnce();

    timerRef.current = setInterval(() => {
      pollOnce();
    }, intervalMs);
  }, [pollOnce, intervalMs]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 板块切换时：重置列表、重启轮询
  useEffect(() => {
    if (currentBlockIdRef.current !== blockId) {
      currentBlockIdRef.current = blockId;
      stopPolling();

      if (blockId !== null) {
        resetStockList();
        startPolling();
      } else {
        stockListRef.current = [];
        currentIndexRef.current = 0;
      }
    }
  }, [blockId, stopPolling, startPolling, resetStockList]);

  // historyData 变化时：同步股票列表（新增的股票需要加入，移除的剔除）
  useEffect(() => {
    if (blockId === null) return;

    const codes = extractStockCodes();
    const existingMap = new Map(
      stockListRef.current.map((item) => [item.code, item])
    );

    let hasNewStock = false;
    const newList: StockPollItem[] = [];
    for (const code of codes) {
      const existing = existingMap.get(code);
      if (existing) {
        newList.push(existing);
      } else {
        newList.push({ code, lastKLineUpdateAt: 0 });
        hasNewStock = true;
      }
    }

    stockListRef.current = newList;

    // 新增了未更新的股票，且轮询已停止，需要重启轮询
    if (hasNewStock && !timerRef.current) {
      startPolling();
    }
  }, [blockId, historyData, extractStockCodes, startPolling]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    /** 将指定股票代码提到轮询队列头部，使其下次优先更新 */
    prioritizeStock,
  };
}
