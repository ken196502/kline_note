import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { rankRotationBlocks } from "@/lib/rotation";
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
const membershipSchema = z.object({
  date: z.string(), stock_code: z.string(), block_code: z.string(), block_name: z.string(),
});

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

export function groupDownStocks(
  stocks: RotationStock[], memberships: z.infer<typeof membershipSchema>[],
): RotationBlock[] {
  // 每只股票采用截至所选日期的最近一次归属，同一天的多个板块均保留。
  const latest = new Map<string, { date: string; blocks: Map<string, string> }>();
  for (const membership of memberships) {
    const previous = latest.get(membership.stock_code);
    if (!previous || membership.date > previous.date) {
      latest.set(membership.stock_code, { date: membership.date, blocks: new Map([[membership.block_code, membership.block_name]]) });
    } else if (membership.date === previous.date) {
      previous.blocks.set(membership.block_code, membership.block_name);
    }
  }
  const groups = new Map<string, RotationBlock>();
  const uniqueStocks = new Map(stocks.map((stock) => [stock.code, stock]));
  for (const stock of uniqueStocks.values()) {
    const blocks = latest.get(stock.code)?.blocks ?? new Map([["unclassified", "未分类"]]);
    for (const [code, name] of blocks) {
      const block = groups.get(code) ?? { code, name, count: 0, stocks: [] };
      block.stocks.push(stock);
      block.count++;
      groups.set(code, block);
    }
  }
  return rankRotationBlocks([...groups.values()]);
}

async function loadMemberships(date: string, stocks: RotationStock[], client: SupabaseClient | null) {
  const memberships: z.infer<typeof membershipSchema>[] = [];
  if (stocks.length === 0) return memberships;
  if (!client) throw new Error("历史板块归属暂不可用，跌停股票已归入未分类");
  const codes = [...new Set(stocks.map((stock) => stock.code))];
  for (let offset = 0; ; offset += 1000) {
    const result = await client.from("stock_limit_up")
      .select("date,stock_code,block_code,block_name")
      .in("stock_code", codes).lte("date", date)
      .order("date", { ascending: false }).order("stock_code").order("block_code")
      .range(offset, offset + 999);
    if (result.error) throw new Error("历史板块归属查询失败，跌停股票已归入未分类");
    const page = z.array(membershipSchema).parse(result.data);
    memberships.push(...page);
    // 已找到所有股票的最近记录；读完最后日期才能保留全部同日板块。
    const latestDates = new Map<string, string>();
    for (const row of memberships) {
      if (!latestDates.has(row.stock_code)) latestDates.set(row.stock_code, row.date);
    }
    const oldestLatest = [...latestDates.values()].sort()[0];
    if (page.length < 1000 || (latestDates.size === codes.length && page[page.length - 1].date < oldestLatest)) break;
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
    const [up, down] = await Promise.allSettled([loadUp(date, client), loadDownStocks(date)]);
    if (up.status === "rejected") throw new Error(`${date} 涨停行情获取失败，请重试`);
    const warnings: string[] = [];
    let downBlocks: RotationBlock[] = [];
    if (down.status === "fulfilled") {
      try {
        downBlocks = groupDownStocks(down.value, await loadMemberships(date, down.value, client));
      } catch (error: unknown) {
        warnings.push(error instanceof Error ? error.message : "板块归属查询失败");
        downBlocks = groupDownStocks(down.value, []);
      }
    } else {
      warnings.push(`${date} 跌停行情获取失败，可点击刷新重试`);
    }
    return { day: { date, up: up.value, down: downBlocks, downAvailable: down.status === "fulfilled" }, warnings };
  })();
  cache.set(date, { expires: Date.now() + (date === today ? 30_000 : 3_600_000), result });
  // 不缓存失败或缺失的跌停数据，刷新即可重试。
  void result.then((value) => { if (!value.day.downAvailable || value.warnings.length > 0) cache.delete(date); }, () => cache.delete(date));
  if (cache.size > 90) cache.delete(cache.keys().next().value ?? "");
  return result;
}
