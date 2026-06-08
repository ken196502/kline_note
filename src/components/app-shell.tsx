"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { TabBar } from "@/components/tab-bar";
import { useAuth } from "@/hooks/use-auth";
import { isInTradingSession } from "@/lib/trading-day";

// 判断是否显示底部TabBar（登录页和板块详情页不显示）
function shouldShowTabBar(pathname: string): boolean {
  // 登录页不显示
  if (pathname === "/") return false;
  // 板块详情页不显示（有自己的导航）
  if (pathname.match(/^\/block-history\/\d+/)) return false;
  return true;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showTab = shouldShowTabBar(pathname);
  const { authenticated, loading: authLoading } = useAuth();

  // 交易时段内，每次进入网站都刷新当天的板块涨停和分时数据
  const refreshTodayData = useCallback(() => {
    if (!isInTradingSession()) return;
    fetch("/api/refresh-today", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!authLoading && authenticated) {
      refreshTodayData();
    }
  }, [authLoading, authenticated, refreshTodayData]);

  return (
    <div className="min-h-screen">
      <div className={showTab ? "pb-12 md:pb-0 md:pl-[2.8rem]" : ""}>{children}</div>
      {showTab && <TabBar />}
    </div>
  );
}