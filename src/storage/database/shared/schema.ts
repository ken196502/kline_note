import { pgTable, index, uniqueIndex, serial, varchar, text, timestamp, integer, real } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const stockNotes = pgTable("stock_notes", {
	id: serial().primaryKey().notNull(),
	username: varchar({ length: 64 }).notNull(),
	stockCode: varchar("stock_code", { length: 32 }).notNull(),
	stockDate: varchar("stock_date", { length: 16 }).notNull(),
	content: text().default("").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("stock_notes_stock_code_idx").using("btree", table.stockCode.asc().nullsLast().op("text_ops")),
	uniqueIndex("stock_notes_unique_idx").using("btree", table.username.asc().nullsLast().op("text_ops"), table.stockCode.asc().nullsLast().op("text_ops"), table.stockDate.asc().nullsLast().op("text_ops")),
	index("stock_notes_username_idx").using("btree", table.username.asc().nullsLast().op("text_ops")),
]);

// 板块涨停汇总数据表
export const blockLimitUp = pgTable("block_limit_up", {
	id: serial().primaryKey().notNull(),
	date: varchar({ length: 16 }).notNull(),
	code: varchar({ length: 32 }).notNull(),
	name: varchar({ length: 128 }).notNull(),
	change: real().default(0).notNull(),
	limitUpNum: integer("limit_up_num").default(0).notNull(),
	continuousPlateNum: integer("continuous_plate_num").default(0).notNull(),
	high: varchar({ length: 64 }).default(""),
	highNum: integer("high_num").default(0).notNull(),
	days: integer().default(0).notNull(),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("block_limit_up_unique_idx").using("btree", table.date.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
	index("block_limit_up_date_idx").using("btree", table.date.asc().nullsLast().op("text_ops")),
]);

// 个股涨停数据表
export const stockLimitUp = pgTable("stock_limit_up", {
	id: serial().primaryKey().notNull(),
	date: varchar({ length: 16 }).notNull(),
	blockCode: varchar("block_code", { length: 32 }).notNull(),
	blockName: varchar("block_name", { length: 128 }).notNull(),
	stockCode: varchar("stock_code", { length: 32 }).notNull(),
	stockName: varchar("stock_name", { length: 128 }).notNull(),
	latest: real().default(0).notNull(),
	changeRate: real("change_rate").default(0).notNull(),
	continueNum: integer("continue_num").default(0).notNull(),
	high: varchar({ length: 64 }).default(""),
	highDays: integer("high_days").default(0).notNull(),
	firstLimitUpTime: varchar("first_limit_up_time", { length: 16 }).default(""),
	lastLimitUpTime: varchar("last_limit_up_time", { length: 16 }).default(""),
	reasonType: varchar("reason_type", { length: 256 }).default(""),
	timePreview: text("time_preview"),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("stock_limit_up_unique_idx").using("btree", table.date.asc().nullsLast().op("text_ops"), table.blockCode.asc().nullsLast().op("text_ops"), table.stockCode.asc().nullsLast().op("text_ops")),
	index("stock_limit_up_block_date_idx").using("btree", table.blockCode.asc().nullsLast().op("text_ops"), table.date.asc().nullsLast().op("text_ops")),
	index("stock_limit_up_date_idx").using("btree", table.date.asc().nullsLast().op("text_ops")),
]);

export const stockTimePreview = pgTable("stock_time_preview", {
	id: serial().primaryKey().notNull(),
	date: varchar({ length: 16 }).notNull(),
	stockCode: varchar("stock_code", { length: 32 }).notNull(),
	// 分时涨跌幅百分比，约80个数据点的JSON数组
	timePreview: text("time_preview").notNull(),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("stock_time_preview_unique_idx").using("btree", table.date.asc().nullsLast().op("text_ops"), table.stockCode.asc().nullsLast().op("text_ops")),
	index("stock_time_preview_date_idx").using("btree", table.date.asc().nullsLast().op("text_ops")),
]);

export const stockDailyPrice = pgTable("stock_daily_price", {
	id: serial().primaryKey().notNull(),
	date: varchar({ length: 16 }).notNull(),
	stockCode: varchar("stock_code", { length: 32 }).notNull(),
	stockName: varchar("stock_name", { length: 128 }).default("").notNull(),
	price: real().default(0).notNull(),
	changeRate: real("change_rate").default(0).notNull(),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("stock_daily_price_unique_idx").using("btree", table.date.asc().nullsLast().op("text_ops"), table.stockCode.asc().nullsLast().op("text_ops")),
	index("stock_daily_price_date_idx").using("btree", table.date.asc().nullsLast().op("text_ops")),
]);

export const customBlocks = pgTable("custom_blocks", {
	id: serial().primaryKey().notNull(),
	username: varchar({ length: 64 }).notNull(),
	name: varchar({ length: 128 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("custom_blocks_unique_idx").using("btree", table.username.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("text_ops")),
	index("custom_blocks_username_idx").using("btree", table.username.asc().nullsLast().op("text_ops")),
]);

// 自定义板块关联的板块表
export const customBlockLinks = pgTable("custom_block_links", {
	id: serial().primaryKey().notNull(),
	customBlockId: integer("custom_block_id").notNull(),
	blockCode: varchar("block_code", { length: 32 }).notNull(),
	blockName: varchar("block_name", { length: 128 }).default("").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("custom_block_links_unique_idx").using("btree", table.customBlockId.asc().nullsLast().op("text_ops"), table.blockCode.asc().nullsLast().op("text_ops")),
	index("custom_block_links_block_idx").using("btree", table.customBlockId.asc().nullsLast().op("text_ops")),
]);

// 自定义板块手动添加的股票表
export const customBlockStocks = pgTable("custom_block_stocks", {
	id: serial().primaryKey().notNull(),
	customBlockId: integer("custom_block_id").notNull(),
	stockCode: varchar("stock_code", { length: 32 }).notNull(),
	stockName: varchar("stock_name", { length: 128 }).default("").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("custom_block_stocks_unique_idx").using("btree", table.customBlockId.asc().nullsLast().op("text_ops"), table.stockCode.asc().nullsLast().op("text_ops")),
	index("custom_block_stocks_block_idx").using("btree", table.customBlockId.asc().nullsLast().op("text_ops")),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
