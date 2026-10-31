export type RotationDirection = "up" | "down";

export interface RotationStock {
  code: string;
  name: string;
  changeRate: number;
  dailyAbnormalValue?: number | null;
  continueNum: number | null;
}

export interface RotationComparisonStock extends RotationStock {
  color: string;
}

export interface RotationBlock {
  code: string;
  name: string;
  count: number;
  stocks: RotationStock[];
}

export interface RotationDay {
  date: string;
  up: RotationBlock[];
  down: RotationBlock[];
  downAvailable: boolean;
}

export interface RotationResponse {
  data: RotationDay[];
  hasMore: boolean;
  nextDate: string | null;
  warnings: string[];
}

export interface RotationSelection {
  date: string;
  direction: RotationDirection;
  block: RotationBlock;
}
