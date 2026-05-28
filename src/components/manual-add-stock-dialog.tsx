"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ManualAddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingStockCodes: string[];
  onAddStock: (stockCode: string, stockName: string) => Promise<boolean>;
}

export function ManualAddStockDialog({
  open,
  onOpenChange,
  existingStockCodes,
  onAddStock,
}: ManualAddStockDialogProps) {
  const [stockCodeInput, setStockCodeInput] = useState("");
  const [stockNameInput, setStockNameInput] = useState("");
  const [addingCode, setAddingCode] = useState(false);
  const [autoNameLoading, setAutoNameLoading] = useState(false);
  const lastFetchedCode = useRef<string>("");

  // 输入满6位代码时自动查询名称
  useEffect(() => {
    if (stockCodeInput.length === 6 && stockCodeInput !== lastFetchedCode.current) {
      lastFetchedCode.current = stockCodeInput;
      setAutoNameLoading(true);
      fetch(`/api/stock-info?code=${stockCodeInput}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.name) {
            setStockNameInput(data.name);
          }
        })
        .finally(() => setAutoNameLoading(false));
    }
    if (stockCodeInput.length < 6) {
      lastFetchedCode.current = "";
      setStockNameInput("");
    }
  }, [stockCodeInput]);

  const handleManualAdd = async () => {
    if (!stockCodeInput.trim() || stockCodeInput.length !== 6) return;
    if (existingStockCodes.includes(stockCodeInput)) {
      setStockCodeInput("");
      setStockNameInput("");
      return;
    }
    setAddingCode(true);
    await onAddStock(stockCodeInput, stockNameInput.trim());
    setStockCodeInput("");
    setStockNameInput("");
    setAddingCode(false);
  };

  const handleClose = () => {
    setStockCodeInput("");
    setStockNameInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">手动添加股票</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4">
          <p className="text-xs text-slate-400 mb-2">
            输入6位股票代码，自动获取名称
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={stockCodeInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setStockCodeInput(val);
              }}
              placeholder="6位代码"
              className="h-9 text-sm font-mono w-28"
              onKeyDown={(e) => {
                if (e.key === "Enter" && stockCodeInput.length === 6 && stockNameInput.trim()) {
                  handleManualAdd();
                }
              }}
            />
            <div className="relative flex-1">
              <Input
                value={stockNameInput}
                onChange={(e) => setStockNameInput(e.target.value)}
                placeholder="股票名称"
                className="h-9 text-sm w-full"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && stockCodeInput.length === 6 && stockNameInput.trim()) {
                    handleManualAdd();
                  }
                }}
              />
              {autoNameLoading && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />
              )}
            </div>
            <Button
              size="sm"
              onClick={handleManualAdd}
              disabled={stockCodeInput.length !== 6 || !stockNameInput.trim() || addingCode}
              className="h-9 px-3"
            >
              {addingCode ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}