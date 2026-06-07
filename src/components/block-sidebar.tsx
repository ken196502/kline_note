"use client";

import {
  Plus,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomBlock } from "@/types/custom-block";

interface BlockSidebarProps {
  blocks: CustomBlock[];
  blocksLoading: boolean;
  selectedBlock: CustomBlock | null;
  historyLoading: boolean;
  username: string | null;
  creatingBlock: boolean;
  setCreatingBlock: (v: boolean) => void;
  newBlockName: string;
  setNewBlockName: (v: string) => void;
  handleCreateBlock: () => void;
  handleFixNames: () => void;
  handleRefreshMarket: () => void;
  fixingNames: boolean;
  fixResult: string;
  refreshingMarket: boolean;
  renamingBlockId: number | null;
  renamingName: string;
  setRenamingName: (v: string) => void;
  renamingLoading: boolean;
  handleStartRename: (block: CustomBlock) => void;
  handleConfirmRename: () => void;
  setRenamingBlockId: (v: number | null) => void;
  draggingBlockId: number | null;
  dragOverBlockId: number | null;
  handleBlockDragStart: (blockId: number) => void;
  handleBlockDragOver: (e: React.DragEvent, blockId: number) => void;
  handleBlockDragEnd: () => void;
  setDragOverBlockId: (v: number | null) => void;
  onSelectBlock: (block: CustomBlock) => void;
  onLogout: () => void;
}

export function BlockSidebar({
  blocks,
  blocksLoading,
  selectedBlock,
  historyLoading,
  username,
  creatingBlock,
  setCreatingBlock,
  newBlockName,
  setNewBlockName,
  handleCreateBlock,
  handleFixNames,
  handleRefreshMarket,
  fixingNames,
  fixResult,
  refreshingMarket,
  renamingBlockId,
  renamingName,
  setRenamingName,
  renamingLoading,
  handleStartRename,
  handleConfirmRename,
  setRenamingBlockId,
  draggingBlockId,
  dragOverBlockId,
  handleBlockDragStart,
  handleBlockDragOver,
  handleBlockDragEnd,
  setDragOverBlockId,
  onSelectBlock,
  onLogout,
}: BlockSidebarProps) {
  return (
    <div className="w-26 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      {/* 板块列表 */}
      <div className="flex-1 overflow-y-auto p-1">
        {/* 添加板块按钮 - 置顶 */}
        <div className="p-1 mb-1">
          {creatingBlock ? (
            <div className="flex gap-1">
              <Input
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="板块名称"
                className="h-7 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBlock();
                  if (e.key === "Escape") setCreatingBlock(false);
                }}
              />
              <Button
                size="sm"
                onClick={handleCreateBlock}
                className="h-7 px-2 text-xs"
              >
                OK
              </Button>
            </div>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatingBlock(true)}
                className="flex-1 h-7 text-xs text-slate-500 hover:text-orange-600"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshMarket}
                disabled={refreshingMarket}
                className="h-7 px-1.5 text-slate-400 hover:text-orange-600"
                title="刷新最近2个交易日市场行情"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", refreshingMarket && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFixNames}
                disabled={fixingNames}
                className="h-7 px-1.5 text-slate-400 hover:text-orange-600"
                title="修复股票名称乱码"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </Button>
            </div>
          )}
          {fixResult && (
            <div className="text-[10px] text-orange-600 px-1 mt-0.5">{fixResult}</div>
          )}
        </div>

        {blocksLoading && blocks.length === 0 ? (
          <div className="p-2">
            <Skeleton className="h-6 w-full mb-1" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : blocks.length === 0 ? (
          <div className="p-3 text-xs text-slate-400 text-center">
            暂无自定义板块
          </div>
        ) : (
          blocks.map((block) => (
            <div
              key={block.id}
              draggable={renamingBlockId !== block.id && !historyLoading}
              className={cn(
                "group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors text-sm",
                selectedBlock?.id === block.id
                  ? "bg-orange-50 text-orange-700 font-medium"
                  : "hover:bg-slate-50 text-slate-700",
                draggingBlockId === block.id && "opacity-50",
                dragOverBlockId === block.id && "border-t-2 border-orange-400",
                historyLoading && selectedBlock?.id !== block.id && "pointer-events-none opacity-50"
              )}
              onClick={() => {
                if (renamingBlockId === block.id || historyLoading) return;
                onSelectBlock(block);
              }}
              onDragStart={() => handleBlockDragStart(block.id)}
              onDragOver={(e) => handleBlockDragOver(e, block.id)}
              onDragEnd={handleBlockDragEnd}
              onDragLeave={() => setDragOverBlockId(null)}
            >
              {renamingBlockId === block.id ? (
                <Input
                  value={renamingName}
                  onChange={(e) => setRenamingName(e.target.value)}
                  className="h-6 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmRename();
                    if (e.key === "Escape") setRenamingBlockId(null);
                  }}
                  onBlur={handleConfirmRename}
                  disabled={renamingLoading}
                />
              ) : (
                <>
                  <span
                    className="truncate flex-1"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(block);
                    }}
                  >
                    {block.name}
                  </span>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* 登出按钮 - 置底 */}
      <div className="p-2 border-t border-slate-100">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-slate-400 truncate">{username}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-slate-400 hover:text-red-500 h-7 w-7 p-0 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}