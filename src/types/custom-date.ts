// 自定义日期数据类型

export interface CustomDate {
  id: number;
  username: string;
  date: string; // 格式 YYYY-MM-DD
  customBlockId: number; // 关联的自定义板块
  stocks: CustomDateStock[]; // 日期内的股票列表
  createdAt: string;
  updatedAt: string;
}

export interface CustomDateStock {
  id: number;
  customDateId: number;
  stockCode: string;
  stockName: string;
  sortOrder: number; // 日期内个股排序
  remark: string; // 备注
}

export interface CreateCustomDateRequest {
  date: string;
  customBlockId: number;
}

export interface AddStockToCustomDateRequest {
  stockCode: string;
  stockName: string;
}

export interface ReorderCustomDateStocksRequest {
  stockOrders: { stockCode: string; sortOrder: number }[];
}