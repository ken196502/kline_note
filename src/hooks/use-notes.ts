"use client";

import { useState, useCallback } from "react";

interface NoteData {
  id: number;
  username: string;
  stock_code: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useNotes() {
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 获取某只股票的备注（不再区分日期）
  const getNote = useCallback((stockCode: string) => {
    return notesMap[stockCode] || "";
  }, [notesMap]);

  // 预加载一批备注（按股票代码批量请求）
  const preloadNotes = useCallback(
    async (stockCodes: string[]) => {
      if (stockCodes.length === 0) return;

      setLoading(true);
      try {
        // 1. 过滤掉已缓存的
        const toFetch = stockCodes.filter((code) => notesMap[code] === undefined);
        if (toFetch.length === 0) return;

        // 2. 批量请求
        const newNotes: Record<string, string> = {};
        const codesParam = toFetch.join(",");
        try {
          const res = await fetch(
            `/api/notes?stock_codes=${encodeURIComponent(codesParam)}`
          );
          if (res.ok) {
            const data = await res.json();
            const notes = data.data as NoteData[] | undefined;
            if (notes) {
              for (const note of notes) {
                newNotes[note.stock_code] = note.content || "";
              }
            }
          }
        } catch {
          // 忽略错误，保持空值
        }

        // 3. 未查到的记录设为空字符串（避免重复请求）
        for (const code of toFetch) {
          if (newNotes[code] === undefined) {
            newNotes[code] = "";
          }
        }

        setNotesMap((prev) => ({ ...prev, ...newNotes }));
      } finally {
        setLoading(false);
      }
    },
    [notesMap]
  );

  // 保存备注（不再需要 stockDate）
  const saveNote = useCallback(
    async (stockCode: string, content: string) => {
      setSaving(true);
      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stock_code: stockCode,
            content,
          }),
        });

        if (res.ok) {
          setNotesMap((prev) => ({ ...prev, [stockCode]: content }));
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