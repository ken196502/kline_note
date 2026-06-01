# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── api/            # API 路由
│   │   │   ├── custom-blocks/         # 自定义板块 CRUD API
│   │   │   ├── custom-block-stocks/   # 自定义板块股票数据 API
│   │   │   ├── block-history/         # 板块涨停列表 API
│   │   │   ├── block-detail/          # 板块详情 API
│   │   │   ├── kline/                 # K线数据 API
│   │   │   └── ...                    # 其他 API
│   │   ├── my/             # 自定义板块页面（首页"复盘"）
│   │   └── block-history/  # 板块涨停列表页（"行情"）
│   ├── components/         # 组件
│   │   ├── ui/             # Shadcn UI 组件库
│   │   ├── tab-bar.tsx     # 底部Tab导航栏
│   │   ├── app-shell.tsx   # 布局外壳（控制TabBar显隐）
│   │   ├── edit-block-panel.tsx  # 自定义板块编辑页面
│   │   └── kline-chart.tsx # K线图组件
│   ├── hooks/              # 自定义 Hooks
│   │   ├── use-auth.ts     # 认证Hook
│   │   ├── use-block-history.ts  # 板块历史数据Hook
│   │   ├── use-block-history-cache.ts # 板块历史行情全局缓存Hook
│   │   ├── use-block-detail.ts   # 板块详情Hook
│   │   ├── use-custom-blocks.ts  # 自定义板块Hook
│   │   └── use-notes.ts    # 备注Hook
│   ├── lib/                # 工具库
│   ├── storage/database/   # 数据库层（Supabase + Drizzle ORM）
│   └── types/              # 类型定义
│       ├── block-data.ts   # 板块/股票数据类型
│       └── custom-block.ts # 自定义板块类型
├── supabase/migrations/    # 数据库迁移文件
├── next.config.ts          # Next.js 配置
└── package.json            # 项目依赖管理
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 业务逻辑说明

### 涨停数据获取流程

1. **板块涨停数据获取** - `GET /api/block-history`
   - 优先从数据库读取缓存数据
   - 缓存不存在时从同花顺 API 获取板块涨停数据并 upsert 到数据库
   - 数据入库时同步将涨停股价格和涨跌幅写入 `stock_daily_price` 表
   - 获取到板块数据后，**立即异步获取当天的涨停分时数据**

2. **分时数据获取** - `fetchAndUpsertTimePreview(date, forceRefresh)`
   - 从涨停池 API 获取个股分时缩略图数据
   - `forceRefresh=false`：仅更新缺少 `time_preview` 的记录（默认）
   - `forceRefresh=true`：强制刷新所有记录（盘中场景）

3. **盘中自动刷新** - `POST /api/refresh-today`
   - 仅在 A 股交易时段（周一至周五 9:25-15:15）内生效
   - 用户进入 `/block-history` 页面时自动调用
   - 强制重新从 API 获取当天板块数据和分时数据并 upsert
   - 涨停股数据入库时同步写入 `stock_daily_price` 表

4. **自定义板块股票数据** - `GET /api/custom-block-stocks`
   - 获取自定义板块下的所有股票
   - **优先从 `stock_daily_price` 表获取同一天的价格和涨跌幅**
   - `stock_daily_price` 中没有的股票，从腾讯实时行情 API (`qt.gtimg.cn`) 获取并 upsert 到 `stock_daily_price`
   - 同时从 `stock_limit_up` 获取分时缩略图和来源板块信息

5. **交易时段判断** - `isInTradingSession()`
   - 判断当前是否在 A 股交易时段：周一至周五 9:25-15:15
   - 用于控制是否触发盘中数据刷新

6. **自定义板块历史行情** - `GET /api/custom-block-stocks/history`
   - 获取自定义板块过往有行情的日期及股票行情（最多10个交易日）
   - 查找板块内股票在 `stock_limit_up` 表中有记录的日期
   - 从 `stock_daily_price` 获取各日期的价格，涨跌幅统一使用最新交易日的数据
   - 返回数据按日期降序排列，每个日期包含当日有行情的股票列表（名称、涨跌幅等）

### 核心文件

| 文件 | 说明 |
|------|------|
| `src/lib/block-api.ts` | 板块 API 调用、数据转换、分时获取、腾讯实时行情获取 |
| `src/lib/trading-day.ts` | 交易日判断、交易时段判断 |
| `src/lib/auth.ts` | JWT 认证、用户验证 |
| `src/app/api/block-history/route.ts` | 板块涨停列表 API |
| `src/app/api/block-detail/route.ts` | 板块详情 API |
| `src/app/api/custom-blocks/route.ts` | 自定义板块列表/创建 API |
| `src/app/api/custom-blocks/[id]/route.ts` | 自定义板块详情/更新/删除 API（含 linkBlock/unlinkBlock/addStock/removeStock action） |
| `src/app/api/custom-block-stocks/route.ts` | 自定义板块股票数据 API |
| `src/app/api/custom-block-stocks/history/route.ts` | 自定义板块历史行情 API（按日期分组，最多10个交易日） |
| `src/app/api/refresh-today/route.ts` | 盘中刷新当天数据 API |
| `src/app/api/refresh-time-preview/route.ts` | 刷新指定日期分时数据 API |
| `src/app/api/kline/route.ts` | K线数据 API |
| `src/app/my/page.tsx` | 自定义板块页面（首页），三列布局：板块列表 | 历史行情（按日期分组） | 股票详情 |
| `src/app/block-history/page.tsx` | 板块涨停列表页（行情），盘中自动刷新 |
| `src/app/block-history/[code]/page.tsx` | 板块详情页，左右分栏布局 |
| `src/components/edit-block-panel.tsx` | 自定义板块编辑页面组件 |
| `src/components/tab-bar.tsx` | 底部Tab导航栏（复盘/行情） |
| `src/components/app-shell.tsx` | 布局外壳（控制TabBar显隐） |
| `src/components/kline-chart.tsx` | K线图组件（基于 klinecharts） |
| `src/components/stock-detail-panel.tsx` | 股票详情右侧面板组件（分时图+备注+K线图，复用于复盘页和板块详情页） |
| `src/hooks/use-custom-blocks.ts` | 自定义板块 Hook（CRUD + linkBlock/unlinkBlock + addStock/removeStock） |
| `src/hooks/use-block-history-cache.ts` | 板块历史行情全局缓存 Hook（预加载、缓存读取、失效管理，切换板块零延迟） |
| `src/types/custom-block.ts` | 自定义板块类型定义（CustomBlock 含 linkedBlocks/manualStocks） |
| `src/storage/database/shared/schema.ts` | Drizzle ORM 表定义（含 custom_blocks、custom_block_links、custom_block_stocks 表） |

### 自定义板块页面布局（复盘页面）

自定义板块页面 (`/my`) 采用三列布局：

- **第一列（左侧）**: 自定义板块列表，支持添加/编辑板块
- **第二列（中间）**: 历史行情，按日期分组展示板块内有行情个股的当天行情
  - 最多展示10个交易日，日期降序排列
  - 每个日期显示：日期标题 + 当日涨停股票标签（名称+涨跌幅，涨跌幅统一使用最新交易日数据）
  - 点击股票标签可在第三列查看详情
- **第三列（右侧，lg以上，宽度固定为视窗高度的1/2）**: 选中股票的详细信息（`StockDetailPanel` 组件）
  - 上：K线图（40%高度，展示120日日线数据）
  - 中：备注区域（点击编辑）
  - 下：分时缩略图（放大展示，在线获取）

响应式设计：
- **lg 及以上**: 三列布局，点击股票直接在右侧展示
- **lg 以下**: 两列布局，点击股票打开抽屉展示详情

### 板块详情页布局

板块详情页 (`/block-history/[code]`) 采用左右分栏布局：

- **左侧（50%）**: 个股列表，支持点击选中查看详情
- **右侧（宽度固定为视窗高度的1/2）**: 选中股票的详细信息（`StockDetailPanel` 组件）
  - 上：K线图（40%高度，展示120日日线数据）
  - 中：备注区域（点击编辑）
  - 下：分时缩略图（放大展示，在线获取）

响应式设计：
- **lg 及以上**: 左右分栏布局，点击股票直接在右侧展示
- **lg 以下**: 单列布局，点击股票打开抽屉展示详情

### K线图组件

`KLineChart` 组件基于 `klinecharts` 库实现：

- 支持股票代码和名称传入
- 自动从 `/api/kline` 获取120日日线数据
- 请求取消机制：切换股票时自动取消前一个请求
- 容器可见时自动 resize 适配尺寸
- 加载状态骨架屏

### 板块历史行情缓存机制

自定义板块页面切换板块时使用全局缓存（`useBlockHistoryCache`），避免重复请求，实现零延迟切换：

- **全局缓存**：模块级 `Map<number, HistoryDayGroup[]>`，key 为板块 ID，value 为历史行情数据
- **预加载时机**：
  - 登录后 / 页面加载时 / 浏览器刷新后：并行预加载所有板块的历史行情
  - 创建新板块后：预加载新板块数据
- **切换板块**：优先从缓存读取，无缓存才发请求并写入缓存
- **缓存更新**：
  - `refreshStocks()`：始终更新缓存；若用户正在查看股票详情（`selectedStock !== null`），只更新 `historyData` 不替换 `blockStocks`，避免打断操作
  - `handleRefreshMarket()`：清空缓存后重新预加载所有板块，再刷新当前显示
  - 编辑日期面板操作（添加/删除股票、删除日期等）：通过 `refreshStocks` 自动同步缓存

### 分时数据刷新

支持两种刷新方式：

1. **盘中自动刷新** - `/api/refresh-today`
   - 仅在交易时段（周一至周五 9:25-15:15）生效
   - 进入板块列表页自动调用

2. **手动刷新** - `/api/refresh-time-preview`
   - 在板块列表页点击"刷新分时"按钮触发
   - 支持指定日期刷新
   - 不限交易时段

### 自定义板块数据模型

自定义板块使用三张关联表（`custom_blocks` + `custom_block_links` + `custom_block_stocks`），而非 JSON 数组字段：

- **`custom_blocks`** — 板块主表（id, username, name）
- **`custom_block_links`** — 关联的板块（custom_block_id, block_code, block_name），关联板块时自动将板块最新一天的股票写入 `custom_block_stocks`
- **`custom_block_stocks`** — 股票列表（custom_block_id, stock_code, stock_name），存储股票代码和名称
- **`stock_daily_price`** — 股票每日价格（date, stock_code, stock_name, price, change_rate），缓存每天的价格和涨跌幅，供自定义板块优先从数据库获取，缺失时用腾讯实时行情 API 补充

**API 操作（PUT /api/custom-blocks/[id]）**：
- `action: "linkBlock"` — 关联板块（blockCode, blockName），自动添加该板块最新一天的股票
- `action: "unlinkBlock"` — 取消关联板块（blockCode），自动移除该板块对应的股票
- `action: "addStock"` — 手动添加股票（stockCode, stockName）
- `action: "removeStock"` — 手动移除股票（stockCode）

**类型定义**：
- `CustomBlock.linkedBlocks: { code: string; name: string }[]` — 关联的板块列表
- `CustomBlock.manualStocks: { code: string; name: string }[]` — 手动添加的股票列表
