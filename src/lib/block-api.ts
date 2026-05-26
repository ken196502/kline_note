import type { ApiBlock, ApiResponse, ApiStock } from "@/types/block-data";
import { formatTime } from "./trading-day";

// 从API获取数据
export async function fetchFromApi(date: string): Promise<ApiResponse> {
  // 将日期格式从 YYYY-MM-DD 转换为 YYYYMMDD
  const apiDate = date.replace(/-/g, "");
  const url = `https://data.10jqka.com.cn/dataapi/limit_up/block_top?filter=HS,GEM2STAR&date=${apiDate}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer:
          "https://data.10jqka.com.cn/datacenterph/limitup/limtupInfo.html?client_userid=nM9Y3&back_source=hyperlink&share_hxapp=isc&fontzoom=no",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
    });

    const text = await response.text();

    // 检查是否是HTML错误页面
    if (text.includes("<h1>") || text.includes("<!DOCTYPE")) {
      console.error("API返回HTML错误页面:", text.substring(0, 200));
      return { status_code: -1 };
    }

    const result = JSON.parse(text) as ApiResponse;
    return result;
  } catch (error) {
    console.error("获取API数据失败:", error);
    return { status_code: -1 };
  }
}

// 转换板块数据
export function transformBlockData(date: string, block: ApiBlock) {
  return {
    date,
    code: block.code,
    name: block.name,
    change: block.change,
    limitUpNum: block.limit_up_num,
    continuousPlateNum: block.continuous_plate_num,
    high: block.high,
    highNum: block.high_num,
    days: block.days,
  };
}

// 转换股票数据
export function transformStockData(date: string, block: ApiBlock, stock: ApiStock) {
  return {
    date,
    blockCode: block.code,
    blockName: block.name,
    code: stock.code,
    name: stock.name,
    latest: stock.latest,
    changeRate: stock.change_rate,
    continueNum: stock.continue_num,
    high: stock.high,
    highDays: stock.high_days,
    firstLimitUpTime: formatTime(stock.first_limit_up_time),
    lastLimitUpTime: formatTime(stock.last_limit_up_time),
    reasonType: stock.reason_type,
    reasonInfo: stock.reason_info,
    isNew: stock.is_new,
    isSt: stock.is_st,
    marketType: stock.market_type,
  };
}
