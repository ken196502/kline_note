import assert from "node:assert/strict";
import { test } from "node:test";
import { rankRotationBlocks, rankRotationStocks, shiftRotationDate } from "../src/lib/rotation";
import { groupRotationStocks } from "../src/lib/rotation-data";
import type { RotationStock } from "../src/types/rotation";
import { indexChangeRate } from "../src/lib/rotation-index";

test("指数涨幅使用对应交易日和前一交易日收盘，缺失时不使用其他日期", () => {
  const rows = [["2026-10-26", "", "3030"], ["2026-10-23", "", "3000"], ["2026-10-27", "", "2999.7"]];
  assert.equal(indexChangeRate(rows, "2026-10-26"), 1);
  assert.equal(indexChangeRate(rows, "2026-10-27"), -1);
  assert.equal(indexChangeRate(rows, "2026-10-25"), null);
  assert.equal(indexChangeRate(rows, "2026-10-23"), null);
  assert.equal(indexChangeRate([["2026-10-23", "", "0"], ["2026-10-26", "", "3030"]], "2026-10-26"), null);
});

const stock = (code: string, continueNum: number | null): RotationStock => ({ code, name: code, continueNum, changeRate: -10 });

test("榜单按当日连板数降序，去重且将缺失数据放在末尾", () => {
  const result = rankRotationStocks([stock("000001", null), stock("000002", 2), stock("000003", 5), stock("000002", 3)]);
  assert.deepEqual(result.map((item) => [item.code, item.continueNum]), [["000003", 5], ["000002", 3], ["000001", null]]);
});

test("正负板块都按数量降序，不修改原始输入", () => {
  const blocks = [{ code: "a", name: "A", count: 1, stocks: [] }, { code: "b", name: "B", count: 4, stocks: [] }];
  assert.deepEqual(rankRotationBlocks(blocks).map((block) => block.count), [4, 1]);
  assert.equal(blocks[0].count, 1);
});

test("涨跌停采用全部自定义板块归属，重复记录不重复计数，未匹配归入未分类", () => {
  const memberships = [
    { stock_code: "000001", block_code: "a", block_name: "板块A" },
    { stock_code: "000001", block_code: "b", block_name: "板块B" },
    { stock_code: "000001", block_code: "a", block_name: "板块A" },
    { stock_code: "000002", block_code: "a", block_name: "板块A" },
  ];
  const result = groupRotationStocks([stock("000001", null), stock("000001", null), stock("000002", 2), stock("000003", null)], memberships);
  assert.deepEqual(result.map((block) => [block.code, block.count]), [["a", 2], ["b", 1], ["unclassified", 1]]);
  assert.equal(result[0].stocks[0].code, "000002");
});

test("历史游标跨月与闰年日期正确，不重复最后交易日", () => {
  assert.equal(shiftRotationDate("2026-11-01", -1), "2026-10-31");
  assert.equal(shiftRotationDate("2024-03-01", -1), "2024-02-29");
});
