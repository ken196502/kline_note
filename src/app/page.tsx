"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }

      window.location.href = "/my";
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* 左侧品牌区域 */}
      <section className="flex-1 flex flex-col justify-center items-start p-8 lg:p-16 relative overflow-hidden min-h-[40vh] lg:min-h-screen bg-[#f4f4f5]">
        {/* 网格背景 */}
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse 70% 60% at 30% 50%, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 30% 50%, black 20%, transparent 80%)",
          }}
        />

        {/* 光晕效果 */}
        <div
          className="absolute rounded-full blur-[120px] pointer-events-none animate-float"
          style={{
            width: "400px",
            height: "400px",
            background: "rgba(217, 119, 6, 0.07)",
            top: "10%",
            left: "-5%",
          }}
        />
        <div
          className="absolute rounded-full blur-[120px] pointer-events-none animate-float"
          style={{
            width: "300px",
            height: "300px",
            background: "rgba(217, 119, 6, 0.05)",
            bottom: "10%",
            right: "10%",
            animationDelay: "-4s",
          }}
        />

        {/* 内容 */}
        <div className="relative z-10 max-w-[560px]">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-600/25 bg-amber-600/8 text-amber-600 text-xs font-medium tracking-wide mb-8",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              "transition-all duration-500"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse-dot" />
            定制化行情工具
          </div>

          <h1
            className={cn(
              "text-4xl lg:text-6xl font-black leading-tight tracking-tight mb-5 text-[#18181b]",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              "transition-all duration-500 delay-100"
            )}
          >
            强势板块复盘
          </h1>

          <p
            className={cn(
              "text-base font-light text-[#71717a] leading-relaxed max-w-[420px]",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              "transition-all duration-500 delay-200"
            )}
          >
            基于每日涨停个股行情，精准捕捉市场主线与资金流向，助力投资决策。
          </p>
        </div>
      </section>

      {/* 右侧登录区域 */}
      <section className="w-full lg:w-[480px] min-h-[60vh] lg:min-h-screen flex flex-col justify-center items-center p-8 bg-white">
        <div className="w-full max-w-[340px]">
          {/* 表单头部 */}
          <div
            className={cn(
              "mb-8",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              "transition-all duration-500 delay-200"
            )}
          >
            <h2 className="text-2xl font-bold text-[#18181b] mb-1.5">登录账户</h2>
            <p className="text-sm text-[#71717a]">输入您的凭证以访问复盘系统</p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 错误提示 */}
            {error && (
              <div
                className={cn(
                  "flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-medium",
                  "bg-red-50 border border-red-200 text-red-700"
                )}
                role="alert"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* 用户名 */}
            <div
              className={cn(
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
                "transition-all duration-500 delay-300"
              )}
            >
              <label className="block text-sm font-medium text-[#18181b] mb-2">
                用户名
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa] pointer-events-none transition-colors"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="h-11 pl-10 border-[#d4d4d8] focus:border-amber-600 focus:ring-amber-600/30"
                />
              </div>
            </div>

            {/* 密码 */}
            <div
              className={cn(
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
                "transition-all duration-500 delay-400"
              )}
            >
              <label className="block text-sm font-medium text-[#18181b] mb-2">
                密码
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa] pointer-events-none transition-colors"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                  className="h-11 pl-10 pr-10 border-[#d4d4d8] focus:border-amber-600 focus:ring-amber-600/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#18181b] transition-colors p-1"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? (
                    <svg
                      className="w-[18px] h-[18px]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      className="w-[18px] h-[18px]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-11 bg-[#18181b] hover:bg-[#27272a] text-white font-semibold rounded-lg transition-all",
                "disabled:opacity-70",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
                "transition-all duration-500 delay-500"
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  登录中...
                </span>
              ) : (
                "登录"
              )}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
