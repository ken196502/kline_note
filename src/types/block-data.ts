// 板块数据类型
export interface ApiBlock {
  code: string;
  name: string;
  change: number;
  limit_up_num: number;
  continuous_plate_num: number;
  high: string;
  high_num: number;
  days: number;
  stock_list?: ApiStock[];
}

export interface ApiStock {
  code: string;
  name: string;
  latest: number;
  change_rate: number;
  continue_num: number;
  high: string;
  high_days: number;
  first_limit_up_time: string;
  last_limit_up_time: string;
  reason_type: string;
  reason_info: string;
  is_new: number;
  is_st: number;
  market_type: string;
}

export interface ApiResponse {
  status_code: number;
  data?: ApiBlock[];
}

// 前端展示用的数据结构
export interface BlockData {
  date: string;
  code: string;
  name: string;
  change: number;
  limitUpNum: number;
  continuousPlateNum: number;
  high: string;
  highNum: number;
  days: number;
}

export interface StockData {
  date: string;
  blockCode: string;
  blockName: string;
  code: string;
  name: string;
  latest: number;
  changeRate: number;
  continueNum: number;
  high: string;
  highDays: number;
  firstLimitUpTime: string;
  lastLimitUpTime: string;
  reasonType: string;
  reasonInfo: string;
  isNew: number;
  isSt: number;
  marketType: string;
}

export interface DayBlockData {
  date: string;
  blocks: BlockData[];
  stocks: StockData[];
}

export interface BlockHistoryResponse {
  data: DayBlockData[];
  hasMore: boolean;
  nextDate: string | null;
}
