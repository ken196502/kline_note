"use client";

import { useBlockHistory } from "@/hooks/use-block-history";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronRight, TrendingUp, Calendar, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function BlockHistoryPage() {
  const { data, loading, error, hasMore, loadMore } = useBlockHistory(5);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/20">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  板块涨停榜
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  按板块维度查看历史涨停个股
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-3 py-1.5 bg-white border-slate-200">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-orange-600" />
                {data.length > 0
                  ? `${data.length} 天数据`
                  : "加载中..."}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
            <span className="font-medium">加载失败:</span>
            <span className="text-sm">{error.message}</span>
          </div>
        )}

        {/* Data List */}
        <div className="space-y-6">
          {data.map((dayData) => (
            <div key={dayData.date} className="space-y-4">
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-xl shadow-lg">
                  <Calendar className="w-4 h-4" />
                  <span className="font-semibold">{formatDate(dayData.date)}</span>
                </div>
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">
                  {dayData.blocks.length} 个板块
                </Badge>
                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                  {dayData.stocks.length} 只涨停股
                </Badge>
              </div>

              {/* Blocks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dayData.blocks.map((block) => (
                  <Link
                    key={`${dayData.date}-${block.code}`}
                    href={`/block-history/${block.code}`}
                  >
                    <Card className="overflow-hidden border-0 shadow-lg shadow-slate-900/5 bg-white/80 backdrop-blur-sm hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 cursor-pointer group h-full">
                      <div className="px-5 py-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-bold text-lg text-slate-900 group-hover:text-orange-600 transition-colors">
                              {block.name}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {block.code}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                        </div>

                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge
                            variant="default"
                            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-2.5 py-1 text-xs"
                          >
                            {block.limitUpNum} 涨停
                          </Badge>
                          {block.continuousPlateNum > 0 && (
                            <Badge
                              variant="outline"
                              className="border-red-200 text-red-700 bg-red-50 text-xs"
                            >
                              连板 {block.continuousPlateNum}
                            </Badge>
                          )}
                          {block.high && block.high !== "0" && (
                            <Badge
                              variant="outline"
                              className="border-purple-200 text-purple-700 bg-purple-50 text-xs"
                            >
                              {block.high}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-500">板块涨幅</span>
                          <div
                            className={cn(
                              "font-bold text-sm",
                              block.change > 0
                                ? "text-red-600"
                                : block.change < 0
                                ? "text-green-600"
                                : "text-slate-600"
                            )}
                          >
                            {block.change > 0 ? "+" : ""}
                            {block.change.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Load More Trigger */}
        <div className="mt-8 py-8 flex justify-center">
          {hasMore && !loading && (
            <Button
              onClick={loadMore}
              variant="outline"
              className="px-8 py-6 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-lg"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              加载更多历史数据
            </Button>
          )}
          {!hasMore && data.length > 0 && (
            <div className="text-center text-slate-400 py-8">
              已加载全部历史数据
            </div>
          )}
        </div>

        {/* Initial Loading State */}
        {loading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
            <p className="mt-4 text-slate-500">加载中...</p>
          </div>
        )}
      </main>
    </div>
  );
}
