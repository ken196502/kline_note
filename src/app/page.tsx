import Link from "next/link";
import { TrendingUp, Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 shadow-2xl shadow-slate-900/5 bg-white/80 backdrop-blur-sm border-0">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl shadow-orange-500/30">
              <TrendingUp className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              板块涨停榜
            </h1>
            <p className="text-slate-500">
              按板块维度查看历史涨停个股，快速了解市场热点
            </p>
          </div>

          <div className="pt-4">
            <Link href="/block-history">
              <Button 
                size="lg" 
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/40"
              >
                <Calendar className="w-5 h-5 mr-2" />
                查看板块涨停榜
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span>实时数据</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>多日历史</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>板块分类</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
