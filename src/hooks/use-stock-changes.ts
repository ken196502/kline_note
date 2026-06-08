"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface StockChangeItem {
  code: string;
  name: string;
  time: string;
  type: string;
  changeRate: number;
  market: number;
}

interface UseStockChangesOptions {
  /** 当前板块的股票代码列表，用于过滤异动 */
  stockCodes: string[];
  /** 轮询间隔（ms），默认 2000 */
  intervalMs?: number;
  /** 是否启用，默认 true */
  enabled?: boolean;
}

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

export function useStockChanges({
  stockCodes,
  intervalMs = 2000,
  enabled = true,
}: UseStockChangesOptions) {
  const [changes, setChanges] = useState<StockChangeItem[]>([]);
  const [trading, setTrading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef(0);
  const stockCodesRef = useRef(stockCodes);
  stockCodesRef.current = stockCodes;

  // TTS 相关
  const spokenKeysRef = useRef<Set<string>>(new Set());

  // 板块切换时清空旧数据（比较股票代码列表内容）
  const prevCodesKeyRef = useRef("");
  useEffect(() => {
    const key = stockCodes.slice().sort().join(",");
    if (key !== prevCodesKeyRef.current) {
      setChanges([]);
      setBlocked(false);
      spokenKeysRef.current.clear();
      prevCodesKeyRef.current = key;
    }
  }, [stockCodes]);

  // TTS 朗读：检测新增的封涨停板异动
  useEffect(() => {
    if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const newLimitUps = changes.filter(
      (item) => item.type === "封涨停板" && !spokenKeysRef.current.has(`${item.code}_${item.type}`)
    );

    if (newLimitUps.length === 0) return;

    // 记录已朗读
    for (const item of newLimitUps) {
      spokenKeysRef.current.add(`${item.code}_${item.type}`);
    }

    // 选择中文女声（语音列表可能异步加载）
    const synth = window.speechSynthesis;
    const pickFemaleVoice = (): SpeechSynthesisVoice | null => {
      const voices = synth.getVoices();
      if (voices.length === 0) return null;
      // 优先级：Siri 神经网络语音 > 普通话/国语女声 > 任意中文（仅排除粤语）
      return voices.find(
        // 1. 最优：zh-CN Siri 神经网络语音
        (v) => v.lang.startsWith("zh-CN") && /语音|Siri/i.test(v.name)
      ) || voices.find(
        // 2. zh-CN 女声关键词：Tingting、Xiaoxiao、Xiaoyi、female、女
        (v) => v.lang.startsWith("zh-CN") && /Tingting|Xiaoxiao|Xiaoyi|Yaoyao|Huihui|female|nv|女/i.test(v.name)
      ) || voices.find(
        // 3. zh-TW 女声关键词：Meijia、Yu-shu
        (v) => v.lang.startsWith("zh-TW") && /Meijia|Yu-shu|female|nv|女/i.test(v.name)
      ) || voices.find(
        // 4. zh-CN 任意（排除明确的男声关键词）
        (v) => v.lang.startsWith("zh-CN") && !/Yunyang/i.test(v.name)
      ) || voices.find(
        // 5. zh-TW 任意
        (v) => v.lang.startsWith("zh-TW")
      ) || voices.find(
        // 6. 其他 zh 但排除粤语(zh-HK/Sin-ji)
        (v) => v.lang.startsWith("zh") && !/HK|Sin-ji/i.test(v.name)
      ) || null;
    };

    const speakItems = () => {
      for (const item of newLimitUps) {
        const utterance = new SpeechSynthesisUtterance(`${item.name}，封涨停板`);
        utterance.lang = "zh-CN";
        const voice = pickFemaleVoice();
        if (voice) utterance.voice = voice;
        utterance.rate = 1.1;
        synth.speak(utterance);
      }
    };

    // 语音列表可能还没加载完，先尝试；如果为空则等 voiceschanged 事件
    if (synth.getVoices().length > 0) {
      speakItems();
    } else {
      const onVoicesChanged = () => {
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        speakItems();
      };
      synth.addEventListener("voiceschanged", onVoicesChanged);
    }
  }, [changes, ttsEnabled]);

  const fetchChanges = useCallback(async () => {
    // 冷却：距离上次请求不足 2 秒则跳过
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return;

    const codes = stockCodesRef.current;
    if (codes.length === 0) {
      setChanges([]);
      return;
    }

    lastFetchRef.current = now;
    setLoading(true);
    try {
      const codesParam = codes.join(",");
      const res = await fetch(`/api/stock-changes?codes=${encodeURIComponent(codesParam)}`);
      if (res.status === 429) {
        setBlocked(true);
        // 3秒后自动恢复
        setTimeout(() => {
          setBlocked(false);
        }, 3000);
        return;
      }
      if (res.ok) {
        const result = await res.json();
        setTrading(result.trading ?? false);
        setChanges(result.data ?? []);
        setBlocked(false);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  // 启动/停止轮询
  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setChanges([]);
      setTrading(false);
      return;
    }

    // 检查是否在交易时段
    const checkAndStart = () => {
      if (!isInTradingSession()) {
        setTrading(false);
        // 非交易时段不清空已有数据，保留最近一次记录
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      // 在交易时段，立即请求一次
      fetchChanges();

      // 设置定时轮询
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          if (isInTradingSession()) {
            fetchChanges();
          } else {
            setTrading(false);
            setChanges([]);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        }, intervalMs);
      }
    };

    checkAndStart();

    // 每分钟检查一次交易时段状态
    const checkTimer = setInterval(() => {
      checkAndStart();
    }, 60000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      clearInterval(checkTimer);
    };
  }, [enabled, intervalMs, fetchChanges]);

  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      const next = !prev;
      // 关闭时停止正在朗读的语音
      if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  return {
    changes,
    trading,
    loading,
    blocked,
    ttsEnabled,
    toggleTts,
    /** 手动刷新异动数据 */
    refresh: fetchChanges,
  };
}