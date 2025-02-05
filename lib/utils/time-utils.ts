export const timeUtils = {
  // 获取当前日期 YYYY-MM-DD
  today(): string {
    const d = new Date()
    return d.toISOString().split('T')[0]
  },

  // 获取当前时间点的分钟数
  minutesSinceMidnight(): number {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  },

  // 格式化日期
  format(date: Date): string {
    return date.toISOString().split('T')[0]
  },

  // 获取特定时区的时间
  getTimeInZone(timezone: string = 'Asia/Shanghai'): string {
    return new Date().toLocaleString('zh-CN', {
      timeZone: timezone,
      hour12: false
    })
  }
}

export function convertToDate(slackTimestamp: string): Date {
  const [seconds, milliseconds] = slackTimestamp.split('.').map(Number);
  return new Date(seconds * 1000);
}

/**
 * 将 Date 对象格式化为 yyyy-MM-dd hh:mm:ss 格式
 */
export function formatDateToCustomString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
