"use client";

import { useBlockHistory } from "@/hooks/use-block-history";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, TrendingUp, Calendar, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function BlockHistoryPage() {
  const { data, loading, error, hasMore, loadMore } = useBlockHistory(5);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  const toggleBlock = (key: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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

              {/* Blocks */}
              <div className="space-y-3">
                {dayData.blocks.map((block) => {
                  const blockKey = `${dayData.date}-${block.code}`;
                  const isExpanded = expandedBlocks.has(blockKey);
                  const blockStocks = dayData.stocks.filter(
                    (s) => s.blockCode === block.code
                  );

                  return (
                    <Collapsible
                      key={blockKey}
                      open={isExpanded}
                      onOpenChange={() => toggleBlock(blockKey)}
                    >
                      <Card className="overflow-hidden border-0 shadow-lg shadow-slate-900/5 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
                        <CollapsibleTrigger asChild>
                          <div className="px-6 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-lg text-slate-900">
                                    {block.name}
                                  </span>
                                  <span className="text-xs text-slate-400 font-mono">
                                    {block.code}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge
                                    variant="default"
                                    className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-3 py-1"
                                  >
                                    {block.limitUpNum} 涨停
                                  </Badge>
                                  {block.continuousPlateNum > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="border-red-200 text-red-700 bg-red-50"
                                    >
                                      连板 {block.continuousPlateNum}
                                    </Badge>
                                  )}
                                  {block.high && block.high !== "0" && (
                                    <Badge
                                      variant="outline"
                                      className="border-purple-200 text-purple-700 bg-purple-50"
                                    >
                                      高度 {block.high}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div className="text-sm text-slate-500">板块涨幅</div>
                                  <div
                                    className={cn(
                                      "font-bold text-lg",
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
                                <ChevronDown
                                  className={cn(
                                    "w-5 h-5 text-slate-400 transition-transform duration-300",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t border-slate-100">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                  <TableHead className="font-semibold text-slate-600">
                                    股票名称
                                  </TableHead>
                                  <TableHead className="text-right font-semibold text-slate-600">
                                    最新价
                                  </TableHead>
                                  <TableHead className="text-right font-semibold text-slate-600">
                                    涨幅
                                  </TableHead>
                                  <TableHead className="text-right font-semibold text-slate-600">
                                    板数
                                  </TableHead>
                                  <TableHead className="text-right font-semibold text-slate-600">
                                    首次涨停
                                  </TableHead>
                                  <TableHead className="text-right font-semibold text-slate-600">
                                    最后涨停
                                  </TableHead>
                                  <TableHead className="font-semibold text-slate-600">
                                    涨停原因
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {blockStocks.map((stock) => (
                                  <TableRow
                                    key={stock.code}
                                    className="hover:bg-orange-50/50 transition-colors"
                                  >
                                    <TableCell>
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-semibold text-slate-900">
                                          {stock.name}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">
                                          {stock.code}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium">
                                      {stock.latest.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className="font-bold text-red-600">
                                        {stock.changeRate > 0 ? "+" : ""}
                                        {stock.changeRate.toFixed(2)}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "font-semibold",
                                          stock.continueNum >= 3
                                            ? "border-red-300 text-red-700 bg-red-50"
                                            : "border-slate-200 text-slate-600"
                                        )}
                                      >
                                        {stock.high || `${stock.continueNum}板`}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-slate-500 font-mono">
                                      {stock.firstLimitUpTime || "-"}
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-slate-500 font-mono">
                                      {stock.lastLimitUpTime || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {stock.reasonInfo && (
                                        <span className="text-xs text-slate-600 line-clamp-2">
                                          {stock.reasonInfo}
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Load More Trigger */}
        <div
          className="mt-8 py-8 flex justify-center"
        >
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
