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
  const [saving, setSaving] = useState(false);

  // 获取某只股票某日的备注
  const fetchNote = useCallback(async (stockCode: string, stockDate: string) => {
    const key = `${stockCode}_${stockDate}`;
    if (notesMap[key] !== undefined) return notesMap[key];

    try {
      const res = await fetch(
        `/api/notes?stock_code=${stockCode}&stock_date=${stockDate}`
      );
      if (res.ok) {
        const data = await res.json();
        const note = (data.data as NoteData[])?.[0];
        const content = note?.content || "";
        setNotesMap((prev) => ({ ...prev, [key]: content }));
        return content;
      }
    } catch {
      // ignore
    }
    return "";
  }, [notesMap]);

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

  return { notesMap, fetchNote, saveNote, saving };
}
