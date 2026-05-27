// 自定义板块数据类型

export interface CustomBlock {
  id: number;
  username: string;
  name: string;
  // 关联的板块列表（含名称）
  linkedBlocks: { code: string; name: string }[];
  // 手动添加的股票列表（含名称）
  manualStocks: { code: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomBlockStock {
  code: string;
  name: string;
  latest: number;
  changeRate: number;
  date: string;
  timePreview?: number[];
  marketType: string;
  // 来源标记：区分是否在stock_limit_up表中有记录
  source: "limitUp" | "nonLimitUp";
  sourceBlockCode?: string;
  sourceBlockName?: string;
  hasPrice?: boolean;
}

export interface CreateCustomBlockRequest {
  name: string;
}

export interface UpdateCustomBlockRequest {
  name?: string;
  // linkBlock / unlinkBlock / addStock / removeStock actions
  action?: string;
  blockCode?: string;
  stockCode?: string;
  stockName?: string;
}

export interface CustomBlockListResponse {
  data: CustomBlock[];
}