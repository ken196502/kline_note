"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { User, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    label: "复盘",
    icon: User,
    path: "/my",
    matchPaths: ["/my"],
  },
  {
    label: "行情",
    icon: TrendingUp,
    path: "/block-history",
    matchPaths: ["/block-history"],
  },
];

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (tab: (typeof tabs)[number]) => {
    return tab.matchPaths.some((p) => pathname.startsWith(p));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-bottom md:top-0 md:bottom-0 md:right-auto md:w-16 md:border-t-0 md:border-r md:border-slate-200">
      <div className="flex items-center justify-around h-12 md:flex-col md:justify-start md:gap-2 md:h-full md:pt-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors md:flex-none md:w-full md:h-14 md:rounded-lg",
                active
                  ? "text-orange-600"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}