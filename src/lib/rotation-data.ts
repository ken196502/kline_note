import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { rankRotationBlocks, rankRotationStocks } from "@/lib/rotation";
import { loadShanghaiChangeRate } from "@/lib/rotation-index";
import type { RotationBlock, RotationDay, RotationStock } from "@/types/rotation";

const stockSchema = z.object({
  code: z.string(), name: z.string(),
  change_rate: z.number().nullish(), continue_num: z.number().nullish(),
});
const upSchema = z.object({
  status_code: z.literal(0),
  data: z.array(z.object({
    code: z.string(), name: z.string(), limit_up_num: z.number(),
    stock_list: z.array(stockSchema).optional(),
  })),
});
const downSchema = z.object({
  status_code: z.literal(0),
  data: z.object({
    page: z.object({ total: z.number() }),
    info: z.array(stockSchema),
  }),
});
const cachedBlockSchema = z.object({ code: z.string(), name: z.string(), limit_up_num: z.number() });
const cachedStockSchema = z.object({
  stock_code: z.string(), stock_name: z.string(), block_code: z.string(),
  change_rate: z.number().nullish(), continue_num: z.number().nullish(),
});
interface RotationMembership {
  stock_code: string;
  block_code: string;
  block_name: string;
}

function toStock(stock: z.infer<typeof stockSchema>): RotationStock {
  return { code: stock.code, name: stock.name, changeRate: stock.change_rate ?? 0, continueNum: stock.continue_num ?? null };
}

async function requestThs(endpoint: string, params: URLSearchParams): Promise<unknown> {
  const response = await fetch(`https://data.10jqka.com.cn/dataapi/limit_up/${endpoint}?${params}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://data.10jqka.com.cn/datacenterph/limitup/limtupInfo.html?client_userid=nM9Y3&back_source=hyperlink&share_hxapp=isc&fontzoom=no",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(12000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`同花顺接口请求失败 (${response.status})`);
  return response.json() as Promise<unknown>;
}

async function loadUp(date: string, client: SupabaseClient | null): Promise<RotationBlock[]> {
  if (client) {
    const { data, error } = await client.from("block_limit_up")
      .select("code,name,limit_up_num").eq("date", date);
    const parsed = z.array(cachedBlockSchema).safeParse(data);
    if (!error && parsed.success && parsed.data.length > 0) {
      const stocks: z.infer<typeof cachedStockSchema>[] = [];
      let stockQueryFailed = false;
      for (let offset = 0; ; offset += 1000) {
        const result = await client.from("stock_limit_up")
          .select("stock_code,stock_name,block_code,change_rate,continue_num")
          .eq("date", date).order("block_code").order("stock_code").range(offset, offset + 999);
        const page = z.array(cachedStockSchema).safeParse(result.data);
        if (result.error || !page.success) { stockQueryFailed = true; break; }
        stocks.push(...page.data);
        if (page.data.length < 1000) break;
      }
      if (!stockQueryFailed && stocks.length > 0) {
        return rankRotationBlocks(parsed.data.map((block) => ({
          code: block.code, name: block.name, count: block.limit_up_num,
          stocks: stocks.filter((stock) => stock.block_code === block.code).map((stock) => ({
            code: stock.stock_code, name: stock.stock_name,
            changeRate: stock.change_rate ?? 0, continueNum: stock.continue_num ?? null,
          })),
        })).filter((block) => block.count > 0));
      }
    }
  }
  const response = upSchema.parse(await requestThs("block_top", new URLSearchParams({
    filter: "HS,GEM2STAR", date: date.replaceAll("-", ""),
  })));
  return rankRotationBlocks(response.data.map((block) => ({
    code: block.code, name: block.name, count: block.limit_up_num,
    stocks: (block.stock_list ?? []).map(toStock),
  })).filter((block) => block.count > 0));
}

async function loadDownStocks(date: string): Promise<RotationStock[]> {
  const stocks: RotationStock[] = [];
  const limit = 200;
  for (let page = 1; ; page++) {
    const response = downSchema.parse(await requestThs("lower_limit_pool", new URLSearchParams({
      page: String(page), limit: String(limit),
      field: "199112,10,330333,330334,1968584,3475914,9004,330329",
      filter: "HS,GEM2STAR", order_field: "330334", order_type: "0",
      date: date.replaceAll("-", ""),
    })));
    stocks.push(...response.data.info.map(toStock));
    if (page * limit >= response.data.page.total) break;
    if (response.data.info.length === 0 || page >= 30) throw new Error("跌停池分页数据不完整");
  }
  return stocks;
}

export function groupRotationStocks(
  stocks: RotationStock[], memberships: RotationMembership[],
): RotationBlock[] {
  const stockBlocks = new Map<string, Map<string, string>>();
  for (const membership of memberships) {
    const blocks = stockBlocks.get(membership.stock_code) ?? new Map<string, string>();
    blocks.set(membership.block_code, membership.block_name);
    stockBlocks.set(membership.stock_code, blocks);
  }
  const groups = new Map<string, RotationBlock>();
  for (const stock of rankRotationStocks(stocks)) {
    const blocks = stockBlocks.get(stock.code) ?? new Map([["unclassified", "未分类"]]);
    for (const [code, name] of blocks) {
      const block = groups.get(code) ?? { code, name, count: 0, stocks: [] };
      block.stocks.push(stock);
      block.count++;
      groups.set(code, block);
    }
  }
  return rankRotationBlocks([...groups.values()]);
}

export async function loadCustomMemberships(username: string) {
  const client = getSupabaseClient();
  const blocks: { id: number; name: string }[] = [];
  const blockSchema = z.object({ id: z.number(), name: z.string() });
  for (let offset = 0; ; offset += 1000) {
    const result = await client.from("custom_blocks").select("id,name")
      .eq("username", username).order("id").range(offset, offset + 999);
    if (result.error) throw new Error("自定义板块查询失败，请刷新重试");
    const page = z.array(blockSchema).parse(result.data);
    blocks.push(...page);
    if (page.length < 1000) break;
  }
  const memberships: RotationMembership[] = [];
  const names = new Map(blocks.map((block) => [block.id, block.name]));
  const stockMembershipSchema = z.object({ custom_block_id: z.number(), stock_code: z.string() });
  // 分批查询，并分页读取，避免股票关联超过数据库默认返回上限。
  for (let start = 0; start < blocks.length; start += 100) {
    const ids = blocks.slice(start, start + 100).map((block) => block.id);
    for (let offset = 0; ; offset += 1000) {
      const result = await client.from("custom_block_stocks").select("custom_block_id,stock_code")
        .in("custom_block_id", ids).order("custom_block_id").order("stock_code")
        .range(offset, offset + 999);
      if (result.error) throw new Error("自定义板块股票归属查询失败，请刷新重试");
      const page = z.array(stockMembershipSchema).parse(result.data);
      for (const row of page) {
        const name = names.get(row.custom_block_id);
        if (name !== undefined) memberships.push({
          stock_code: row.stock_code, block_code: `custom-${row.custom_block_id}`, block_name: name,
        });
      }
      if (page.length < 1000) break;
    }
  }
  return memberships;
}

interface DayResult { day: RotationDay; warnings: string[] }
const cache = new Map<string, { expires: number; result: Promise<DayResult> }>();

export function loadRotationDay(date: string, today: string): Promise<DayResult> {
  const previous = cache.get(date);
  if (previous && previous.expires > Date.now()) return previous.result;
  const result = (async (): Promise<DayResult> => {
    let client: SupabaseClient | null = null;
    try { client = getSupabaseClient(); } catch { /* 没有数据库配置时仍可展示 API 行情。 */ }
    const [up, down, index] = await Promise.allSettled([loadUp(date, client), loadDownStocks(date), loadShanghaiChangeRate(date)]);
    if (up.status === "rejected") throw new Error(`${date} 涨停行情获取失败，请重试`);
    const warnings: string[] = [];
    const indexRate = index.status === "fulfilled" ? index.value : null;
    if (indexRate === null && (up.value.length > 0 || (down.status === "fulfilled" && down.value.length > 0))) {
      warnings.push(`${date} 上证指数行情缺失，日异动值暂不可用`);
    }
    const withAbnormalValue = (blocks: RotationBlock[]): RotationBlock[] => blocks.map((block) => ({
      ...block,
      stocks: block.stocks.map((stock) => ({
        ...stock,
        dailyAbnormalValue: indexRate === null ? null : Math.round((stock.changeRate - indexRate) * 100) / 100,
      })),
    }));
    const downBlocks = down.status === "fulfilled" ? groupRotationStocks(down.value, []) : [];
    if (down.status === "rejected") {
      warnings.push(`${date} 跌停行情获取失败，可点击刷新重试`);
    }
    return { day: { date, up: withAbnormalValue(up.value), down: withAbnormalValue(downBlocks), downAvailable: down.status === "fulfilled" }, warnings };
  })();
  cache.set(date, { expires: Date.now() + (date === today ? 30_000 : 3_600_000), result });
  // 不缓存失败或缺失的跌停数据，刷新即可重试。
  void result.then((value) => { if (!value.day.downAvailable || value.warnings.length > 0) cache.delete(date); }, () => cache.delete(date));
  if (cache.size > 90) cache.delete(cache.keys().next().value ?? "");
  return result;
}
