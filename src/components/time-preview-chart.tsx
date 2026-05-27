"use client";

import { useCallback } from "react";
import { RefreshCw } from "lucide-react";

/**
 * 小型分时图组件（用于列表）
 * 数据格式：number[] (历史数据，约 80 个点)
 */
export function TimePreviewChart({
  data,
  loading,
}: {
  data: number[] | undefined;
  loading?: boolean;
}) {
  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !data || data.length === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = 120;
      const height = 40;
      canvas.width = width * 2;
      canvas.height = height * 2;
      ctx.scale(2, 2);

      // 清空
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // 过滤有效数据
      const validData = data.filter((v) => v !== null && !isNaN(v));
      if (validData.length === 0) return;

      // 计算坐标点（基于实际数据长度，保持原始比例）
      const minVal = Math.min(...validData);
      const maxVal = Math.max(...validData);
      // 修复：当所有值相同时（如一字涨停），range 为 0，需要给一个默认范围
      const range = maxVal - minVal || 1;

      // 判断是否所有值都相同（一字涨停等情况）
      const isFlatLine = maxVal === minVal;

      const points = data.map((val, i) => ({
        x: (i / (data.length - 1)) * (width - 2),
        y:
          val !== null && !isNaN(val)
            ? // 如果是平线，显示在顶部（涨停在上方）
              isFlatLine
              ? 4
              : height - 2 - ((val - minVal) / range) * (height - 4)
            : null,
      }));

      // 绘制填充区域（只绘制有效数据部分）
      ctx.beginPath();
      let started = false;
      points.forEach((p) => {
        if (p.y !== null) {
          if (!started) {
            ctx.moveTo(p.x + 1, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x + 1, p.y);
          }
        }
      });
      if (started) {
        // 找到最后一个有效点
        const lastValidIndex = points.findLastIndex((p) => p.y !== null);
        const lastValidX = points[lastValidIndex]?.x || 0;
        ctx.lineTo(lastValidX + 1, height - 2);
        ctx.lineTo(points[0].x + 1, height - 2);
        ctx.closePath();
        ctx.fillStyle = "rgba(251, 146, 60, 0.15)";
        ctx.fill();
      }

      // 绘制线
      ctx.beginPath();
      let lineStarted = false;
      points.forEach((p) => {
        if (p.y !== null) {
          if (!lineStarted) {
            ctx.moveTo(p.x + 1, p.y);
            lineStarted = true;
          } else {
            ctx.lineTo(p.x + 1, p.y);
          }
        }
      });
      if (lineStarted) {
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 绘制起点和终点（只绘制有效点）
      const firstValid = points.find((p) => p.y !== null);
      const lastValid = points.findLast((p) => p.y !== null);

      if (firstValid && firstValid.y !== null) {
        ctx.beginPath();
        ctx.arc(firstValid.x + 1, firstValid.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#f97316";
        ctx.fill();
      }

      if (lastValid && lastValid.y !== null && lastValid !== firstValid) {
        ctx.beginPath();
        ctx.arc(lastValid.x + 1, lastValid.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#dc2626";
        ctx.fill();
      }
    },
    [data]
  );

  if (loading) {
    return (
      <div className="w-30 h-10 flex items-center justify-center">
        <div className="w-3 h-3 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-30 h-10 flex items-center justify-center text-[10px] text-slate-300">
        --
      </div>
    );
  }

  return <canvas ref={canvasRef} className="w-30 h-10" />;
}

/**
 * 大型分时图组件（用于详情面板）
 * 数据格式：(number | null)[] (在线数据，固定 240 个点，null 表示无数据)
 */
export function TimePreviewChartLarge({
  data,
  loading,
  onRefresh,
}: {
  data: (number | null)[] | undefined;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !data || data.length === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * 2;
      canvas.height = height * 2;
      ctx.scale(2, 2);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // 过滤有效数据用于计算范围
      const validData = data.filter(
        (v): v is number => v !== null && !isNaN(v)
      );
      if (validData.length === 0) return;

      const minVal = Math.min(...validData);
      const maxVal = Math.max(...validData);
      const range = maxVal - minVal || 1;

      // 判断是否所有值都相同（一字涨停等情况）
      const isFlatLine = maxVal === minVal;

      // 计算坐标点（固定 240 个点的宽度）
      const totalPoints = data.length;
      const points = data.map((val, i) => ({
        x: (i / (totalPoints - 1)) * (width - 8) + 4,
        y:
          val !== null && !isNaN(val)
            ? // 如果是平线，显示在顶部（涨停在上方）
              isFlatLine
              ? 4
              : height - 4 - ((val - minVal) / range) * (height - 8)
            : null,
      }));

      // 填充（只绘制有效数据部分）
      ctx.beginPath();
      let started = false;
      points.forEach((p) => {
        if (p.y !== null) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
      });
      if (started) {
        const lastValidIndex = points.findLastIndex((p) => p.y !== null);
        const lastValidX = points[lastValidIndex]?.x || 0;
        ctx.lineTo(lastValidX, height - 4);
        ctx.lineTo(points[0].x, height - 4);
        ctx.closePath();
        ctx.fillStyle = "rgba(251, 146, 60, 0.12)";
        ctx.fill();
      }

      // 线
      ctx.beginPath();
      let lineStarted = false;
      points.forEach((p) => {
        if (p.y !== null) {
          if (!lineStarted) {
            ctx.moveTo(p.x, p.y);
            lineStarted = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
      });
      if (lineStarted) {
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 起终点
      const firstValid = points.find((p) => p.y !== null);
      const lastValid = points.findLast((p) => p.y !== null);

      if (firstValid && firstValid.y !== null) {
        ctx.beginPath();
        ctx.arc(firstValid.x, firstValid.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#f97316";
        ctx.fill();
      }

      if (lastValid && lastValid.y !== null && lastValid !== firstValid) {
        ctx.beginPath();
        ctx.arc(lastValid.x, lastValid.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#dc2626";
        ctx.fill();
      }

      // 绘制当前进度线（如果数据未满 240 个有效点）
      const validCount = validData.length;
      if (validCount < totalPoints && validCount > 0) {
        const lastValidX = points[points.findIndex((p, i) => {
          // 找到最后一个有效点的索引
          let lastIdx = -1;
          for (let j = i; j >= 0; j--) {
            if (points[j].y !== null) {
              lastIdx = j;
              break;
            }
          }
          return lastIdx === i;
        })]?.x;

        if (lastValidX) {
          ctx.beginPath();
          ctx.moveTo(lastValidX, 4);
          ctx.lineTo(lastValidX, height - 4);
          ctx.strokeStyle = "rgba(249, 115, 22, 0.3)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    },
    [data]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400">加载分时数据...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-2">
        <span className="text-sm text-slate-400">暂无分时数据</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            重新获取
          </button>
        )}
      </div>
    );
  }

  // 统计有效数据点
  const validCount = data.filter((v) => v !== null).length;
  const totalPoints = data.length;

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="absolute top-1 right-1 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="刷新分时"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
      {/* 显示数据进度 */}
      {validCount > 0 && validCount < totalPoints && (
        <div className="absolute bottom-1 right-1 text-[10px] text-slate-400">
          {validCount}/{totalPoints}
        </div>
      )}
    </div>
  );
}
