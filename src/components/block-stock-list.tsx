"use client";

import type { StockData, BlockData } from "@/types/block-data";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Clock, Flame, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockStockListProps {
  block: BlockData;
  stocks: StockData[];
}

export function BlockStockList({ block, stocks }: BlockStockListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{block.name}</h2>
            <p className="text-sm text-slate-400 font-mono mt-1">{block.code}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500 mb-1">板块涨幅</div>
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <div>
              <div className="text-xs text-slate-500">涨停数</div>
              <div className="text-lg font-bold text-orange-700">{block.limitUpNum}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
            <Flame className="w-5 h-5 text-red-600" />
            <div>
              <div className="text-xs text-slate-500">连板数</div>
              <div className="text-lg font-bold text-red-700">{block.continuousPlateNum}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
            <Tag className="w-5 h-5 text-purple-600" />
            <div>
              <div className="text-xs text-slate-500">高度</div>
              <div className="text-lg font-bold text-purple-700">{block.high || "-"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock List */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">涨停个股 ({stocks.length})</h3>
          </div>

          {stocks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              暂无涨停个股
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-600">股票名称</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">最新价</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">涨幅</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">板数</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">首次涨停</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">最后涨停</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock) => (
                  <TableRow
                    key={stock.code}
                    className="hover:bg-orange-50/50 transition-colors"
                  >
                    <TableCell>
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
                    <TableCell className="text-right text-sm text-slate-500 font-mono">
                      {stock.lastLimitUpTime || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Reason Info */}
          {stocks.some(s => s.reasonInfo) && (
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-slate-700">涨停原因</h3>
              <div className="space-y-2">
                {stocks.filter(s => s.reasonInfo).map((stock) => (
                  <div key={`reason-${stock.code}`} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900">{stock.name}</span>
                      <Badge variant="outline" className="text-xs">{stock.continueNum}板</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{stock.reasonInfo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
