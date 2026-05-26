"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBlockHistory } from "@/hooks/use-block-history";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar, RefreshCw, LogOut } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function BlockHistoryPage() {
  const router = useRouter();
  const { data, loading, error, hasMore, loadMore } = useBlockHistory(5);
  const { authenticated, username, loading: authLoading, logout } = useAuth();

  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push("/");
    }
  }, [authLoading, authenticated, router]);

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <h1 className="text-lg font-bold text-slate-900">板块涨停榜</h1>
            </div>
            <div className="flex items-center gap-3">
              {data.length > 0 && (
                <span className="text-xs text-slate-400">{data.length}天数据</span>
              )}
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
      <main className="max-w-5xl mx-auto px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            加载失败: {error.message}
          </div>
        )}

        <div className="space-y-5">
          {data.map((dayData) => (
            <div key={dayData.date}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">
                  {formatDate(dayData.date)}
                </span>
                <span className="text-xs text-slate-400">
                  {dayData.blocks.length}板块 · {dayData.stocks.length}涨停
                </span>
              </div>

              {/* Compact Block List */}
              <div className="bg-white border border-slate-200 divide-y divide-slate-100">
                {dayData.blocks.map((block) => (
                  <Link
                    key={`${dayData.date}-${block.code}`}
                    href={`/block-history/${block.code}`}
                    className="flex items-center justify-between px-3 py-2 hover:bg-orange-50/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                          {block.name}
                        </span>
                        <span className="text-orange-600 text-xs font-medium flex-shrink-0">
                          {block.limitUpNum}涨停
                        </span>
                        {block.high && block.high !== "0" && (
                          <span className="text-purple-600 text-xs font-medium flex-shrink-0">
                            最高{block.high}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {block.code}
                        </span>
                        <span
                          className={cn(
                            "text-[11px] font-mono",
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
                    </div>
                    <svg
                      className="w-4 h-4 text-slate-300 group-hover:text-orange-400 transition-colors flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="mt-4 bg-white border border-slate-200 divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            ))}
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
