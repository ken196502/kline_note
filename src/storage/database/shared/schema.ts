import { pgTable, index, uniqueIndex, serial, varchar, text, timestamp } from "drizzle-orm/pg-core"
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

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
