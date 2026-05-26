"use client";

import { use, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, TrendingUp, Calendar, Flame, Tag, Clock } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { BlockData, StockData } from "@/types/block-data";

async function fetchBlockData(date: string, code: string): Promise<{
  block: BlockData | null;
  stocks: StockData[];
}> {
  const response = await fetch(`/api/block-history?startDate=${date}&days=1`);
  const result = await response.json();

  if (result.data && result.data.length > 0) {
    const dayData = result.data[0];
    const block = dayData.blocks.find((b: BlockData) => b.code === code);
    const stocks = dayData.stocks.filter((s: StockData) => s.blockCode === code);

    return { block, stocks };
  }

  return { block: null, stocks: [] };
}

export default function BlockDetailPage({
  params,
}: {
  params: Promise<{ date: string; code: string }>;
}) {
  const { date, code } = use(params);
  const [data, setData] = useState<{
    block: BlockData | null;
    stocks: StockData[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchBlockData(date, code)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err : new Error("Unknown error")))
      .finally(() => setIsLoading(false));
  }, [date, code]);

  const formatDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      const weekday = format(d, "EEEE", { locale: zhCN });
      const formattedDate = format(d, "yyyy年MM月dd日", { locale: zhCN });
      return `${formattedDate} ${weekday}`;
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !data?.block) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">加载失败或板块不存在</p>
          <Link href="/block-history">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回列表
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { block, stocks } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/block-history">
                <Button variant="ghost" size="icon" className="rounded-lg hover:bg-slate-100">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/20">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{block.name}</h1>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="font-mono">{block.code}</span>
                    <span className="text-slate-300">|</span>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(date)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-0.5">板块涨幅</div>
              <div
                className={cn(
                  "text-2xl font-bold",
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-5 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm text-slate-600">涨停数</div>
                <div className="text-3xl font-bold text-orange-700">{block.limitUpNum}</div>
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm text-slate-600">连板数</div>
                <div className="text-3xl font-bold text-red-700">{block.continuousPlateNum}</div>
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Tag className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm text-slate-600">最高板</div>
                <div className="text-3xl font-bold text-purple-700">{block.high || "-"}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Stock List */}
        <Card className="overflow-hidden border-0 shadow-xl shadow-slate-900/5">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-900">
              涨停个股 ({stocks.length})
            </h2>
          </div>
          <ScrollArea className="max-h-[calc(100vh-400px)]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-600 pl-6">股票名称</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">最新价</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">涨幅</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">板数</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      首次涨停
                    </div>
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      最后涨停
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock) => (
                  <TableRow
                    key={stock.code}
                    className="hover:bg-orange-50/50 transition-colors"
                  >
                    <TableCell className="pl-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-900">{stock.name}</span>
                        <span className="text-xs text-slate-400 font-mono">{stock.code}</span>
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
                            : stock.continueNum >= 2
                            ? "border-orange-300 text-orange-700 bg-orange-50"
                            : "border-slate-200 text-slate-600"
                        )}
                      >
                        {stock.high || `${stock.continueNum}板`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-500 font-mono">
                      {stock.firstLimitUpTime || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-500 font-mono pr-6">
                      {stock.lastLimitUpTime || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {stocks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                      暂无涨停个股
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>

        {/* Reason Info */}
        {stocks.some((s) => s.reasonInfo) && (
          <Card className="mt-6 p-6 border-0 shadow-xl shadow-slate-900/5">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600" />
              涨停原因
            </h3>
            <div className="space-y-3">
              {stocks
                .filter((s) => s.reasonInfo)
                .map((stock) => (
                  <div
                    key={`reason-${stock.code}`}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900">{stock.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {stock.high || `${stock.continueNum}板`}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{stock.reasonInfo}</p>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
