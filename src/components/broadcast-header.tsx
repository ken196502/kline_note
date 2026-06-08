"use client";

import { useState, useEffect, useRef } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockChangeItem } from "@/hooks/use-stock-changes";

interface BroadcastHeaderProps {
  stockChanges?: StockChangeItem[];
  isTrading?: boolean;
  changesLoading?: boolean;
  changesBlocked?: boolean;
  onRefreshChanges?: () => void;
  ttsEnabled?: boolean;
  onToggleTts?: () => void;
  editMode?: boolean;
  checkedStocks?: Set<string>;
  broadcastItems?: { code: string; name: string; blockName: string }[];
  /** 编辑模式下第二行展示用：当前板块的历史数据 */
  historyData?: { stocks: { code: string; name: string; sourceBlockName?: string }[] }[];
  onEnterEditMode?: () => void;
  onCancelEditMode?: () => void;
  onClearCheckedStocks?: () => void;
  onSaveEditMode?: () => void;
}

export function BroadcastHeader({
  stockChanges = [],
  isTrading = false,
  changesLoading = false,
  changesBlocked = false,
  onRefreshChanges,
  ttsEnabled = false,
  onToggleTts,
  editMode = false,
  checkedStocks = new Set(),
  broadcastItems = [],
  historyData = [],
  onEnterEditMode,
  onCancelEditMode,
  onClearCheckedStocks,
  onSaveEditMode,
}: BroadcastHeaderProps) {
  const tickerItems = stockChanges;

  // 跟踪上次已显示的条目 key 列表，用于检测新增
  const prevTickerKeysRef = useRef<string>("");
  // 新条目滑入动画：检测新增条目时触发
  const [newItemKey, setNewItemKey] = useState<string | null>(null);

  useEffect(() => {
    const currentKey = tickerItems.map((item) => `${item.code}_${item.type}`).join("|");
    if (currentKey !== prevTickerKeysRef.current && tickerItems.length > 0 && prevTickerKeysRef.current !== "") {
      const prevKeys = new Set(prevTickerKeysRef.current.split("|").filter(Boolean));
      const newItems = tickerItems.filter((item) => !prevKeys.has(`${item.code}_${item.type}`));
      if (newItems.length > 0) {
        setNewItemKey(`${newItems[0].code}_${newItems[0].type}`);
        const timer = setTimeout(() => setNewItemKey(null), 600);
        prevTickerKeysRef.current = currentKey;
        return () => clearTimeout(timer);
      }
    }
    prevTickerKeysRef.current = currentKey;
  }, [tickerItems]);

  return (
    <div
      className={cn(
        "border-b overflow-hidden bg-white shrink-0",
        changesBlocked ? "border-red-200" : "border-slate-200"
      )}
    >
      <div className="flex items-center gap-1.5 px-3 h-5">
        <Activity className={cn("w-2.5 h-2.5 shrink-0", changesBlocked ? "text-red-500" : isTrading && tickerItems.length > 0 ? "text-amber-500" : "text-slate-400")} />
        <span className={cn("text-[10px] font-medium shrink-0", changesBlocked ? "text-red-500" : "text-slate-500")}>异动</span>
        {changesBlocked && (
          <span className="text-[10px] text-red-500 font-medium shrink-0">请求过频，稍后自动恢复</span>
        )}
        {!isTrading && tickerItems.length === 0 && (
          <span className="text-[10px] text-slate-400 shrink-0">非交易时段</span>
        )}
        {!changesBlocked && changesLoading && (
          <span className="text-[10px] text-slate-400 shrink-0">...</span>
        )}
        {!changesBlocked && (
          <div
            className="flex-1 overflow-hidden relative h-5 flex items-center"
          >
            {tickerItems.length > 0 ? (
              <div className="flex gap-3 whitespace-nowrap flex items-center">
                {tickerItems.map((item) => {
                  const itemKey = `${item.code}_${item.type}`;
                  const isNew = itemKey === newItemKey;
                  return (
                    <span
                      key={itemKey}
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] px-1",
                        isNew && "animate-ticker-slide-in"
                      )}
                    >
                      <span className="text-slate-500">{item.time}</span>
                      {(() => {
                        const bis = broadcastItems.filter((i) => i.code === item.code);
                        const names = bis.map((bi) => bi.blockName).filter(Boolean);
                        const uniqueNames = [...new Set(names)];
                        return uniqueNames.length > 0 ? (
                          <>{uniqueNames.map((n) => <span key={n} className="text-slate-500 text-[9px]">[{n}]</span>)}</>
                        ) : null;
                      })()}
                      <span className="font-medium text-slate-800">
                        {item.name}
                      </span>
                      <span className="text-amber-600">{item.type}</span>
                      <span className={cn(item.changeRate >= 0 ? "text-red-500" : "text-green-500")}>
                        {item.changeRate >= 0 ? "+" : ""}{(item.changeRate * 100).toFixed(2)}%
                      </span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] text-slate-400">当前板块暂无异动</span>
            )}
          </div>
        )}
        {/* 朗读/静音按钮 */}
        {onToggleTts && !editMode && (
          <button
            onClick={onToggleTts}
            className={cn("shrink-0 transition-colors", ttsEnabled ? "text-amber-500 hover:text-amber-600" : "text-slate-400 hover:text-slate-600")}
            title={ttsEnabled ? "关闭朗读" : "开启朗读"}
          >
            {ttsEnabled ? (
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>
        )}
        {/* 手动刷新按钮 */}
        {onRefreshChanges && !editMode && (
          <button
            onClick={onRefreshChanges}
            disabled={changesLoading}
            className="shrink-0 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-40"
            title="刷新异动"
          >
            <svg className={cn("w-2.5 h-2.5", changesLoading && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        {/* 编辑模式按钮 */}
        {editMode ? (
          <>
            <button
              onClick={onSaveEditMode}
              className="shrink-0 text-[10px] text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              保存({checkedStocks.size})
            </button>
            {onClearCheckedStocks && (
              <button
                onClick={onClearCheckedStocks}
                className="shrink-0 text-[10px] text-amber-600 hover:text-amber-700 font-medium transition-colors"
              >
                清空
              </button>
            )}
            <button
              onClick={onCancelEditMode}
              className="shrink-0 text-[10px] text-slate-400 hover:text-slate-600 font-medium transition-colors"
            >
              取消
            </button>
          </>
        ) : (
          onEnterEditMode && (
            <button
              onClick={onEnterEditMode}
              className="shrink-0 text-slate-400 hover:text-amber-600 transition-colors"
              title="编辑"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )
        )}
      </div>
      {/* 编辑模式第二行：播报的股票名称 */}
      {editMode && checkedStocks.size > 0 && (
        <div className="px-3 pb-1 overflow-x-auto whitespace-nowrap">
          <span className="text-[10px] text-slate-400 mr-1">播报:</span>
          {[...checkedStocks].map((code) => {
            const bis = broadcastItems.filter((i) => i.code === code);
            const stock = historyData.flatMap((g) => g.stocks).find((s) => s.code === code);
            const name = bis[0]?.name || stock?.name || code;
            const blockNames = [...new Set(bis.map((bi) => bi.blockName).filter(Boolean))];
            return (
              <span key={code} className="text-[10px] font-bold text-slate-600 mr-1.5">
                {blockNames.map((n) => <span key={n} className="text-slate-500 font-normal">[{n}]</span>)}
                {name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}