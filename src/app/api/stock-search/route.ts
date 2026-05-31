import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

interface StockResult {
  code: string;
  name: string;
}

/** 新浪财经搜索（主），支持拼音/代码/名称 */
async function searchSina(q: string): Promise<StockResult[]> {
  const sinaUrl = `https://suggest3.sinajs.cn/suggest/type=11,13&key=${encodeURIComponent(q)}&name=suggestdata`;

  const response = await fetch(sinaUrl, {
    headers: { Referer: "https://finance.sina.com.cn" },
  });

  // 新浪接口返回 GBK 编码，需要用 GBK 解码
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("gbk");
  const text = decoder.decode(buffer);

  const match = text.match(/var suggestdata="(.+)"/);
  if (!match || !match[1]) return [];

  const items = match[1].split(";").filter(Boolean);
  const results: StockResult[] = [];

  for (const item of items) {
    const fields = item.split(",");
    // 格式：带前缀代码,类型,纯数字代码,带前缀代码,名称,,名称,99,是否活跃,...
    const fullCode = fields[0];
    const pureCode = fields[2];
    const name = fields[4];
    const active = fields[8];

    if (fullCode.startsWith("bj")) continue;
    if (active === "0") continue;

    if (pureCode && name) {
      results.push({ code: pureCode, name });
    }
    if (results.length >= 50) break;
  }

  return results;
}

/** 东方财富搜索（fallback），支持拼音/代码/名称 */
async function searchEastmoney(q: string): Promise<StockResult[]> {
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=20`;

  const response = await fetch(url);
  const data = await response.json();

  const items = data?.QuotationCodeTable?.Data;
  if (!Array.isArray(items)) return [];

  const results: StockResult[] = [];

  for (const item of items) {
    // SecurityType: 1=沪A, 2=深A
    if (item.SecurityType !== "1" && item.SecurityType !== "2") continue;
    if (item.Code && item.Name) {
      results.push({ code: item.Code, name: item.Name });
    }
    if (results.length >= 50) break;
  }

  return results;
}

export async function GET(request: Request) {
  const username = await getCurrentUser();
  if (!username) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  // 主：新浪财经搜索
  const results = await searchSina(q);

  if (results.length > 0) {
    return NextResponse.json({ results });
  }

  // fallback：东方财富搜索
  const fallbackResults = await searchEastmoney(q);
  return NextResponse.json({ results: fallbackResults });
}