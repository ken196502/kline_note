"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { RotationDay, RotationSelection } from "@/types/rotation";

interface RotationChartProps {
  days: RotationDay[];
  selected: RotationSelection | null;
  onSelect: (selection: RotationSelection) => void;
}

const LANE_WIDTH = 20;
const BAR_WIDTH = 12;

export function RotationChart({ days, selected, onSelect }: RotationChartProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; scroll: number; moved: boolean } | null>(null);
  const [height, setHeight] = useState(420);
  const [dragging, setDragging] = useState(false);
  // 最近日期在左侧；加载历史时向右追加，保留当前浏览位置。
  const visibleDays = useMemo(() => days.map((day) => ({
    ...day,
    up: day.up.filter((block) => block.count >= 2),
    down: day.down.filter((block) => block.count >= 2),
  })), [days]);
  const maxUp = Math.max(1, ...visibleDays.flatMap((day) => day.up.map((block) => block.count)));
  const maxDown = Math.max(1, ...visibleDays.flatMap((day) => day.down.map((block) => block.count)));
  // 按两侧最大数量分配高度，使用同一比例并充分利用绘图区。
  const upperHeight = 20 + (height - 30) * maxUp / (maxUp + maxDown);
  const upperZero = upperHeight;
  const lowerZero = upperHeight;
  const lowerHeight = height - lowerZero;
  const scale = Math.min((upperHeight - 20) / maxUp, (lowerHeight - 10) / maxDown);
  const upperStep = Math.max(1, Math.ceil(maxUp / 4));
  const lowerStep = Math.max(1, Math.ceil(maxDown / 4));
  const upperTicks = [1, 2, 3, 4].map((tick) => tick * upperStep).filter((tick) => tick * scale <= upperHeight - 10);
  const lowerTicks = [1, 2, 3, 4].map((tick) => tick * lowerStep).filter((tick) => tick * scale <= lowerHeight - 10);
  const selections = useMemo(() => new Map<string, RotationSelection>(days.flatMap((day) =>
    (["up", "down"] as const).flatMap((direction) => day[direction].map((block) =>
      [`${day.date}:${direction}:${block.code}`, { date: day.date, direction, block }] as const
    ))
  )), [days]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const plotHeight = Math.max(180, entry.contentRect.height - 40);
      setHeight(plotHeight);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (viewport.scrollWidth <= viewport.clientWidth) return;
      event.preventDefault();
      viewport.scrollLeft += event.deltaY;
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, []);

  const select = (selection: RotationSelection) => {
    if (!dragRef.current?.moved) onSelect(selection);
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) > 5) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (drag.moved) event.currentTarget.scrollLeft = drag.scroll - distance;
  };

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        ref={viewportRef}
        role="region"
        aria-label="板块轮动柱状图，可左右拖动或使用方向键滚动"
        tabIndex={0}
        className={cn("min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain select-none outline-none focus-visible:ring-2 focus-visible:ring-orange-400", dragging ? "cursor-grabbing" : "cursor-grab")}
        style={{ touchAction: "pan-x" }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={() => { dragRef.current = null; setDragging(false); }}
        onPointerLeave={() => { if (!dragRef.current?.moved) dragRef.current = null; }}
      >
        <div className="flex h-full w-max">
          {visibleDays.map((day, dayIndex) => {
            const width = Math.max(3, day.up.length, day.down.length) * LANE_WIDTH + 12;
            return (
              <section key={day.date} className="shrink-0 border-r border-slate-200 last:border-r-0" style={{ width }} aria-label={`${day.date}行情`}>
                <div className={cn("flex h-10 items-center justify-center border-b border-slate-100 text-[10px]", dayIndex % 2 === 0 ? "bg-slate-50" : "bg-white")}>
                  <span className="font-medium text-slate-500">{day.date}</span>
                </div>
                <svg width={width} height={height} className={dayIndex % 2 === 0 ? "bg-slate-50/40" : "bg-white"}>
                  {upperTicks.map((tick) => <line key={`up-${tick}`} x1="0" x2={width} y1={upperZero - tick * scale} y2={upperZero - tick * scale} stroke="#e2e8f0" strokeDasharray="3 5" />)}
                  {lowerTicks.map((tick) => <line key={`down-${tick}`} x1="0" x2={width} y1={lowerZero + tick * scale} y2={lowerZero + tick * scale} stroke="#e2e8f0" strokeDasharray="3 5" />)}
                  <line x1="0" x2={width} y1={upperZero} y2={upperZero} stroke="#cbd5e1" />
                  {(["up", "down"] as const).map((direction) => day[direction].map((block, index) => {
                    const key = `${day.date}:${direction}:${block.code}`;
                    const selection = selections.get(key);
                    if (!selection) return null;
                    const active = selected?.date === day.date && selected.direction === direction && selected.block.code === block.code;
                    const x = 6 + index * LANE_WIDTH + (LANE_WIDTH - BAR_WIDTH) / 2;
                    const up = direction === "up";
                    const barHeight = Math.max(2, block.count * scale);
                    const y = up ? upperZero - barHeight : lowerZero;
                    const color = up ? "#ef4444" : "#059669";
                    return (
                      <g
                        key={key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${day.date} ${block.name} ${up ? "涨停" : "跌停"} ${block.count}只`}
                        aria-pressed={active}
                        data-rotation-bar={key}
                        className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-orange-500 [&:focus-visible>rect]:stroke-2"
                        onPointerEnter={() => select(selection)}
                        onFocus={() => select(selection)}
                        onClick={() => select(selection)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(selection); } }}
                      >
                        <rect x={x} y={y} width={BAR_WIDTH} height={barHeight} fill={color} opacity={active ? 1 : 0.85} stroke={active ? "#f97316" : "none"} strokeWidth="1" />
                        <text x={x + BAR_WIDTH / 2} y={y + barHeight / 2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={Math.min(10, Math.max(2, barHeight - 1))} className="pointer-events-none font-mono font-semibold">{block.count}</text>
                      </g>
                    );
                  }))}
                </svg>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
