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
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
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
   - 获取到板块数据后，**立即异步获取当天的涨停分时数据**

2. **分时数据获取** - `fetchAndUpsertTimePreview(date, forceRefresh)`
   - 从涨停池 API 获取个股分时缩略图数据
   - `forceRefresh=false`：仅更新缺少 `time_preview` 的记录（默认）
   - `forceRefresh=true`：强制刷新所有记录（盘中场景）

3. **盘中自动刷新** - `POST /api/refresh-today`
   - 仅在 A 股交易时段（周一至周五 9:25-15:15）内生效
   - 用户进入 `/block-history` 页面时自动调用
   - 强制重新从 API 获取当天板块数据和分时数据并 upsert

4. **交易时段判断** - `isInTradingSession()`
   - 判断当前是否在 A 股交易时段：周一至周五 9:25-15:15
   - 用于控制是否触发盘中数据刷新

### 核心文件

| 文件 | 说明 |
|------|------|
| `src/lib/block-api.ts` | 板块 API 调用、数据转换、分时获取 |
| `src/lib/trading-day.ts` | 交易日判断、交易时段判断 |
| `src/app/api/block-history/route.ts` | 板块涨停列表 API |
| `src/app/api/block-detail/route.ts` | 板块详情 API |
| `src/app/api/refresh-today/route.ts` | 盘中刷新当天数据 API |
| `src/app/api/refresh-time-preview/route.ts` | 刷新指定日期分时数据 API |
| `src/app/api/kline/route.ts` | K线数据 API |
| `src/app/block-history/page.tsx` | 板块涨停列表页，盘中自动刷新 |
| `src/app/block-history/[code]/page.tsx` | 板块详情页，左右分栏布局 |
| `src/components/kline-chart.tsx` | K线图组件（基于 klinecharts） |

### 板块详情页布局

板块详情页 (`/block-history/[code]`) 采用左右分栏布局：

- **左侧（50%）**: 个股列表，支持点击选中查看详情
- **右侧（50%）**: 选中股票的详细信息
  - 上：分时缩略图（放大展示）
  - 中：备注区域（点击编辑）
  - 下：K线图（主要空间，展示120日日线数据）

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

### 分时数据刷新

支持两种刷新方式：

1. **盘中自动刷新** - `/api/refresh-today`
   - 仅在交易时段（周一至周五 9:25-15:15）生效
   - 进入板块列表页自动调用

2. **手动刷新** - `/api/refresh-time-preview`
   - 在板块列表页点击"刷新分时"按钮触发
   - 支持指定日期刷新
   - 不限交易时段
