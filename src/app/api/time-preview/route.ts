import { NextResponse } from "next/server";

/**
 * 分时数据类型
 */
type MinuteItem = {
  time: string;
  price: number;
  volume: number;
};

/**
 * 腾讯分时数据返回格式
 */
interface TencentMinuteResponse {
  code: number;
  msg: string;
  data: {
    [code: string]: {
      data: {
        data: string[];
        datatime: number;
        date: string;
        prec: number;
      };
    };
  };
}

/**
 * 一天交易时间点（共 240 个点）
 * 上午: 09:30 - 11:30 (120 分钟)
 * 下午: 13:00 - 15:00 (120 分钟)
 */
const TRADING_MINUTES = 240;

/**
 * 生成所有交易时间点（格式 "0930", "0931", ...）
 */
function generateAllTradingTimes(): string[] {
  const times: string[] = [];

  // 上午 09:30 - 11:30
  for (let h = 9; h <= 11; h++) {
    const startMin = h === 9 ? 30 : 0;
    const endMin = h === 11 ? 30 : 59;
    for (let m = startMin; m <= endMin; m++) {
      times.push(`${h.toString().padStart(2, "0")}${m.toString().padStart(2, "0")}`);
    }
  }

  // 下午 13:00 - 15:00
  for (let h = 13; h <= 15; h++) {
    const endMin = h === 15 ? 0 : 59;
    for (let m = 0; m <= endMin; m++) {
      times.push(`${h.toString().padStart(2, "0")}${m.toString().padStart(2, "0")}`);
    }
  }

  return times;
}

const ALL_TRADING_TIMES = generateAllTradingTimes();

/**
 * 将股票代码转换为腾讯格式
 * 上证: sh600519
 * 深证: sz000001
 */
function convertToTencentCode(code: string, marketType?: string): string {
  // 如果已经是腾讯格式，直接返回
  if (code.startsWith("sh") || code.startsWith("sz")) {
    return code;
  }

  // 根据 marketType 或代码开头判断市场
  if (marketType === "SH" || code.startsWith("6")) {
    return `sh${code}`;
  }
  return `sz${code}`;
}

/**
 * 从腾讯接口获取分时数据
 */
interface TencentMinuteResult {
  minutes: MinuteItem[];
  prevClose: number;
}

async function getTencentMinute(code: string): Promise<TencentMinuteResult> {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`;

  const res = await fetch(url, {
    headers: {
      Referer: "https://gu.qq.com/",
      "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`腾讯接口请求失败: ${res.status}`);
  }

  const json = (await res.json()) as TencentMinuteResponse;
  const codeData = json.data?.[code];

  // 获取分时数据数组
  const rawData = codeData?.data?.data;
  if (!rawData || !Array.isArray(rawData)) {
    return { minutes: [], prevClose: 0 };
  }

  // 解析数据格式: "时间 价格 成交量"
  const minutes = rawData.map((line) => {
    const parts = line.split(" ");
    return {
      time: parts[0]!,
      price: Number(parts[1]),
      volume: Number(parts[2]),
    };
  });

  // 从 qt 字段获取昨收价：qt[code][4] 为昨收价
  let prevClose = 0;
  const qtData = codeData?.qt?.[code];
  if (Array.isArray(qtData) && qtData.length > 4) {
    prevClose = Number(qtData[4]) || 0;
  }

  return { minutes, prevClose };
}

/**
 * GET /api/time-preview?code=600519&marketType=SH
 * 获取股票分时数据（从腾讯接口实时获取）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const marketType = searchParams.get("marketType");

  if (!code) {
    return NextResponse.json({ error: "缺少股票代码" }, { status: 400 });
  }

  try {
    const tencentCode = convertToTencentCode(code, marketType || undefined);
    const { minutes: minuteData, prevClose } = await getTencentMinute(tencentCode);

    // 创建时间到数据的映射
    const timeMap = new Map<string, MinuteItem>();
    for (const item of minuteData) {
      timeMap.set(item.time, item);
    }

    // 填充为 240 个点，没有数据的用 null 表示
    const filledMinutes: (MinuteItem | null)[] = ALL_TRADING_TIMES.map((time) => {
      return timeMap.get(time) || null;
    });

    // 价格数组（用于绘制分时图，null 表示无数据）
    const prices: (number | null)[] = filledMinutes.map((item) =>
      item ? item.price : null
    );

    // 统计有效数据点数
    const validCount = minuteData.length;

    return NextResponse.json({
      code,
      success: true,
      data: {
        minutes: filledMinutes,
        prices,
        prevClose,
        totalPoints: TRADING_MINUTES,
        validPoints: validCount,
      },
    });
  } catch (error) {
    console.error("获取分时数据失败:", error);
    return NextResponse.json(
      {
        code,
        success: false,
        error: error instanceof Error ? error.message : "获取分时数据失败",
        data: {
          minutes: [],
          prices: [],
          totalPoints: TRADING_MINUTES,
          validPoints: 0,
        },
      },
      { status: 500 }
    );
  }
}
