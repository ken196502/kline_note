// 判断是否为节假日（周末、五一、十一、元旦）
export function isHoliday(date: Date): boolean {
  const day = date.getDay();
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();

  // 周末
  if (day === 0 || day === 6) return true;

  // 元旦 1月1日
  if (month === 1 && dayOfMonth === 1) return true;

  // 五一 5月1日
  if (month === 5 && dayOfMonth === 1) return true;

  // 十一 10月1日
  if (month === 10 && dayOfMonth === 1) return true;

  return false;
}

// 获取上一个交易日
export function getPrevTradingDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  while (isHoliday(date)) {
    date.setDate(date.getDate() - 1);
  }
  const result = date.toISOString().split("T")[0];
  return result ?? dateStr;
}

// 获取下一个交易日
export function getNextTradingDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  while (isHoliday(date)) {
    date.setDate(date.getDate() + 1);
  }
  const result = date.toISOString().split("T")[0];
  return result ?? dateStr;
}

// 格式化时间戳为 HH:mm:ss
export function formatTime(timestamp: string): string {
  if (!timestamp) return "";
  const ts = Number.parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return timestamp;
  const date = new Date(ts * 1000);
  const timeStr = date.toTimeString().split(" ")[0];
  return timeStr ?? "";
}

// 判断当前是否在A股交易时段（9:25 - 15:15）
// 用于判断是否需要刷新当天的涨停数据
export function isInTradingSession(): boolean {
  const now = new Date();
  const day = now.getDay();

  // 周末不是交易日
  if (day === 0 || day === 6) return false;

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // 9:25 = 9*60+25 = 565, 15:15 = 15*60+15 = 915
  return timeInMinutes >= 565 && timeInMinutes <= 915;
}

// 获取最近N个交易日
export function getRecentTradingDays(startFrom: string, count: number): string[] {
  const days: string[] = [];
  let currentDate = startFrom;
  
  for (let i = 0; i < count; i++) {
    days.push(currentDate);
    currentDate = getPrevTradingDay(currentDate);
  }
  
  return days;
}
