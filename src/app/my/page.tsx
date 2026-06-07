"use client";

import { toast } from "sonner";
import { EditDatePanel } from "@/components/edit-date-panel";
import { StockDetailPanel } from "@/components/stock-detail-panel";
import { BlockHistoryList } from "@/components/block-history-list";
import { BlockSidebar } from "@/components/block-sidebar";
import { useMyPageState } from "@/hooks/use-my-page-state";

export default function MyPage() {
  const state = useMyPageState();

  // ===== 编辑日期模式 =====
  if (state.editingDate) {
    return (
      <EditDatePanel
        customDate={state.editingDate}
        blockName={state.selectedBlock?.name}
        onAddStock={state.handleAddStockToDate}
        onRemoveStock={state.handleRemoveStockFromDate}
        onDeleteDate={state.handleDeleteDateFromEditor}
        onBack={() => state.setEditingDate(null)}
      />
    );
  }

  // ===== 展示模式 =====
  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* 三列布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 第一列 - 自定义板块列表 */}
        <BlockSidebar
          blocks={state.blocks}
          blocksLoading={state.blocksLoading}
          selectedBlock={state.selectedBlock}
          historyLoading={state.historyLoading}
          username={state.username}
          creatingBlock={state.creatingBlock}
          setCreatingBlock={state.setCreatingBlock}
          newBlockName={state.newBlockName}
          setNewBlockName={state.setNewBlockName}
          handleCreateBlock={state.handleCreateBlock}
          handleFixNames={state.handleFixNames}
          handleRefreshMarket={state.handleRefreshMarket}
          fixingNames={state.fixingNames}
          fixResult={state.fixResult}
          refreshingMarket={state.refreshingMarket}
          renamingBlockId={state.renamingBlockId}
          renamingName={state.renamingName}
          setRenamingName={state.setRenamingName}
          renamingLoading={state.renamingLoading}
          handleStartRename={state.handleStartRename}
          handleConfirmRename={state.handleConfirmRename}
          setRenamingBlockId={state.setRenamingBlockId}
          draggingBlockId={state.draggingBlockId}
          dragOverBlockId={state.dragOverBlockId}
          handleBlockDragStart={state.handleBlockDragStart}
          handleBlockDragOver={state.handleBlockDragOver}
          handleBlockDragEnd={state.handleBlockDragEnd}
          setDragOverBlockId={state.setDragOverBlockId}
          onSelectBlock={state.setSelectedBlock}
          onLogout={state.logout}
        />

        {/* 第二列 - 历史行情（按自定义日期分组） */}
        <BlockHistoryList
          selectedBlock={state.selectedBlock}
          historyData={state.historyData}
          historyLoading={state.historyLoading}
          customDates={state.customDates}
          selectedStockCode={state.selectedStock?.code ?? null}
          selectedStockDate={state.selectedStock?.date ?? null}
          draggingStock={state.draggingStock}
          dragOverStock={state.dragOverStock}
          dragDateId={state.dragDateId}
          onAddDate={state.handleAddDate}
          onDeleteDate={state.handleDeleteDate}
          collapsedDates={state.collapsedDates}
          onToggleCollapse={(d) => {
            state.setCollapsedDates((prev) => {
              const next = new Set(prev);
              if (next.has(d)) next.delete(d);
              else next.add(d);
              return next;
            });
          }}
          onCollapseAll={() => state.setCollapsedDates(new Set(state.historyData.map((g) => g.date)))}
          onExpandAll={() => state.setCollapsedDates(new Set())}
          onSelectStock={(stock, date) =>
            state.handleSelectStock({
              code: stock.code,
              name: stock.name,
              latest: stock.latest,
              changeRate: stock.changeRate,
              date,
              timePreview: stock.timePreview,
              marketType: stock.marketType,
              source: stock.source,
              sourceBlockName: stock.sourceBlockName,
            })
          }
          onEditDate={(cd) => state.setEditingDate(cd)}
          onDragStart={state.handleDragStart}
          onDragOver={state.handleDragOver}
          onDragEnd={state.handleDragEnd}
          onAddStock={async (dateId, stockCode, stockName) => {
            const result = await state.addStockToDate(dateId, stockCode, stockName);
            if (!result.success && result.error) {
              toast.error(result.error);
            }
            return result.success;
          }}
          onUpdateStockColor={async (dateId, stockCode, color) => {
            const ok = await state.updateStockColor(dateId, stockCode, color);
            if (ok) {
              state.setHistoryData((prev) =>
                prev.map((g) =>
                  g.customDateId === dateId
                    ? {
                        ...g,
                        stocks: g.stocks.map((s) =>
                          s.code === stockCode ? { ...s, nameColor: color } : s
                        ),
                      }
                    : g
                )
              );
            }
            return ok;
          }}
          onStocksChanged={() => {
            if (state.selectedBlock) state.refreshStocks(state.selectedBlock.id);
          }}
          stockChanges={state.stockChanges}
          isTrading={state.isTrading}
          changesLoading={state.changesLoading}
          changesBlocked={state.changesBlocked}
          onRefreshChanges={state.refreshChanges}
          ttsEnabled={state.ttsEnabled}
          onToggleTts={state.toggleTts}
        />

        <StockDetailPanel
          selectedStock={state.selectedStock}
          getNote={(code, date) => {
            const group = state.historyData.find((g) => g.date === date);
            const stock = group?.stocks.find((s) => s.code === code);
            return stock?.remark || "";
          }}
          saveNote={async (code, date, content) => {
            const group = state.historyData.find((g) => g.date === date);
            if (group?.customDateId) {
              await state.updateRemark(group.customDateId, code, content);
              state.setHistoryData((prev) =>
                prev.map((g) =>
                  g.date === date
                    ? {
                        ...g,
                        stocks: g.stocks.map((s) =>
                          s.code === code ? { ...s, remark: content } : s
                        ),
                      }
                    : g
                )
              );
              return true;
            }
            return false;
          }}
          formatDate={state.formatDate}
          username={state.username}
          noteHeightClass="h-24"
          emptyText="点击股票查看详情"
          stockDetailOpen={state.stockDetailOpen}
          setStockDetailOpen={state.setStockDetailOpen}
          openNoteRequest={state.openNoteRequest}
          onKLineLoaded={undefined}
        />
      </div>
    </div>
  );
}