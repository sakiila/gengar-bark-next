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
