"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBlockHistory } from "@/hooks/use-block-history";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar, RefreshCw, LogOut, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

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

export default function BlockHistoryPage() {
  const router = useRouter();
  const { data, loading, error, hasMore, loadMore } = useBlockHistory(5);
  const { authenticated, username, loading: authLoading, logout } = useAuth();
  const [refreshingDate, setRefreshingDate] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push("/");
    }
  }, [authLoading, authenticated, router]);

  // 交易时段内，每次进入网站都刷新当天的板块涨停和分时数据
  const refreshTodayData = useCallback(() => {
    if (!isInTradingSession()) return;
    fetch("/api/refresh-today", { method: "POST" }).catch(() => {
      // 静默失败，不影响用户体验
    });
  }, []);

  useEffect(() => {
    if (authenticated) {
      refreshTodayData();
    }
  }, [authenticated, refreshTodayData]);

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const weekday = format(date, "EEEE", { locale: zhCN });
      const formattedDate = format(date, "MM月dd日", { locale: zhCN });
      return `${formattedDate} ${weekday}`;
    } catch {
      return dateStr;
    }
  };

  const handleRefreshTimePreview = async (date: string) => {
    setRefreshingDate(date);
    setRefreshMessage(null);
    try {
      const res = await fetch("/api/refresh-time-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (res.ok) {
        setRefreshMessage(`${date} 分时数据刷新成功`);
      } else {
        setRefreshMessage(data.error || "刷新失败");
      }
    } catch {
      setRefreshMessage("网络错误，请重试");
    } finally {
      setRefreshingDate(null);
      setTimeout(() => setRefreshMessage(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <h1 className="text-lg font-bold text-slate-900">板块涨停榜</h1>
            </div>
            <div className="flex items-center gap-3">
              {data.length > 0 && (
                <span className="text-xs text-slate-400">{data.length}天数据</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/export-notes");
                    if (res.ok) {
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const contentDisposition = res.headers.get("Content-Disposition");
                      const filename = contentDisposition
                        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "") || "stock_notes.csv"
                        : "stock_notes.csv";
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    }
                  } catch (e) {
                    console.error("下载失败", e);
                  }
                }}
                className="text-slate-500 hover:text-orange-600 h-7"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                备份下载
              </Button>
              {authenticated && username && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">{username}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-slate-400 hover:text-red-500 h-7 w-7 p-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            加载失败: {error.message}
          </div>
        )}
        {refreshMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm">
            {refreshMessage}
          </div>
        )}

        <div className="space-y-6">
          {data.map((dayData) => (
            <div key={dayData.date}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">
                  {formatDate(dayData.date)}
                </span>
                <span className="text-xs text-slate-400">
                  {dayData.blocks.length}板块
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRefreshTimePreview(dayData.date)}
                  disabled={refreshingDate === dayData.date}
                  className="h-6 px-2 text-xs text-slate-400 hover:text-orange-600"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${refreshingDate === dayData.date ? "animate-spin" : ""}`} />
                  {refreshingDate === dayData.date ? "刷新中" : "刷新分时"}
                </Button>
              </div>

              {/* Tile Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {dayData.blocks.map((block) => (
                  <a
                    key={`${dayData.date}-${block.code}`}
                    href={`/block-history/${block.code}`}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/block-history/${block.code}`);
                    }}
                    className="bg-white border border-slate-200 px-2.5 py-2 hover:bg-orange-50/50 transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-sm text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                        {block.name}
                      </span>
                      <span className="text-orange-600 text-xs font-medium flex-shrink-0">
                        {block.limitUpNum}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-600 font-mono truncate">
                        {block.code}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-mono flex-shrink-0",
                          block.change > 0
                            ? "text-green-600"
                            : block.change < 0
                            ? "text-red-600"
                            : "text-slate-400"
                        )}
                      >
                        {block.change > 0 ? "+" : ""}
                        {block.change.toFixed(2)}%
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Loading Tiles */}
        {loading && (
          <div className="mt-4 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 px-2.5 py-2">
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Load More */}
        <div className="mt-6 py-4 flex justify-center">
          {hasMore && !loading && (
            <Button
              onClick={loadMore}
              variant="outline"
              size="sm"
              className="text-slate-600 border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              加载更多
            </Button>
          )}
          {!hasMore && data.length > 0 && (
            <div className="text-xs text-slate-400">已加载全部数据</div>
          )}
        </div>

        {/* Initial Loading */}
        {loading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-slate-400">加载中...</p>
          </div>
        )}
      </main>
    </div>
  );
}
