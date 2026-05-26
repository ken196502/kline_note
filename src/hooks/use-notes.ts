"use client";

import { useState, useCallback } from "react";

interface NoteData {
  id: number;
  username: string;
  stock_code: string;
  stock_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useNotes() {
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 获取某只股票某日的备注
  const getNote = useCallback((stockCode: string, stockDate: string) => {
    const key = `${stockCode}_${stockDate}`;
    return notesMap[key] || "";
  }, [notesMap]);

  // 预加载一批备注（按日期批量请求，提高效率）
  const preloadNotes = useCallback(
    async (stockKeyList: Array<{ stockCode: string; stockDate: string }>) => {
      if (stockKeyList.length === 0) return;

      setLoading(true);
      try {
        // 1. 过滤掉已缓存的
        const toFetch: Array<{ stockCode: string; stockDate: string }> = [];
        for (const { stockCode, stockDate } of stockKeyList) {
          const key = `${stockCode}_${stockDate}`;
          if (notesMap[key] === undefined) {
            toFetch.push({ stockCode, stockDate });
          }
        }
        if (toFetch.length === 0) return;

        // 2. 按日期分组
        const byDate: Record<string, Set<string>> = {};
        for (const { stockCode, stockDate } of toFetch) {
          if (!byDate[stockDate]) {
            byDate[stockDate] = new Set();
          }
          byDate[stockDate].add(stockCode);
        }

        // 3. 按日期批量请求（并行）
        const newNotes: Record<string, string> = {};
        const requests = Object.entries(byDate).map(async ([date, codes]) => {
          const codesParam = Array.from(codes).join(",");
          try {
            const res = await fetch(
              `/api/notes?stock_date=${date}&stock_codes=${encodeURIComponent(codesParam)}`
            );
            if (res.ok) {
              const data = await res.json();
              const notes = data.data as NoteData[] | undefined;
              if (notes) {
                for (const note of notes) {
                  const key = `${note.stock_code}_${note.stock_date}`;
                  newNotes[key] = note.content || "";
                }
              }
            }
          } catch {
            // 忽略错误，保持空值
          }
        });

        await Promise.all(requests);

        // 4. 未查到的记录设为空字符串（避免重复请求）
        for (const { stockCode, stockDate } of toFetch) {
          const key = `${stockCode}_${stockDate}`;
          if (newNotes[key] === undefined) {
            newNotes[key] = "";
          }
        }

        setNotesMap((prev) => ({ ...prev, ...newNotes }));
      } finally {
        setLoading(false);
      }
    },
    [notesMap]
  );

  // 保存备注
  const saveNote = useCallback(
    async (stockCode: string, stockDate: string, content: string) => {
      setSaving(true);
      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stock_code: stockCode,
            stock_date: stockDate,
            content,
          }),
        });

        if (res.ok) {
          const key = `${stockCode}_${stockDate}`;
          setNotesMap((prev) => ({ ...prev, [key]: content }));
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { notes: notesMap, loading, saving, saveNote, getNote, preloadNotes };
}
