/**
 * ID 类型枚举
 */
export enum IdType {
  APPOINTMENT = 'appointment',
  ORDER = 'order',
  UNKNOWN = 'unknown'
}

/**
 * 从输入字符串中提取 ID 信息
 * @param input - 输入字符串，例如 "a123456" 或 "o123456"
 * @returns { type: IdType; value: string } - ID 类型和实际值
 */
export function extractId(input: string): { type: IdType; value: string } {
  // 移除所有空白字符
  const cleanInput = input.trim().toLowerCase();
  
  // 匹配 appointment ID (以 'a' 开头后跟数字)
  const appointmentMatch = cleanInput.match(/^a(\d+)$/);
  if (appointmentMatch) {
    return {
      type: IdType.APPOINTMENT,
      value: appointmentMatch[1] // 返回数字部分
    };
  }
  
  // 匹配 order ID (以 'o' 开头后跟数字)
  const orderMatch = cleanInput.match(/^o(\d+)$/);
  if (orderMatch) {
    return {
      type: IdType.ORDER,
      value: orderMatch[1] // 返回数字部分
    };
  }
  
  return {
    type: IdType.UNKNOWN,
    value: ''
  };
}

/**
 * 判断输入是否为有效的 ID 格式
 * @param input - 输入字符串
 * @returns boolean - 是否为有效的 ID 格式
 */
export function isValidIdFormat(input: string): boolean {
  const cleanInput = input.trim().toLowerCase();
  return /^[ao]\d+$/.test(cleanInput);
}

/**
 * 格式化 ID（添加前缀）
 * @param type - ID 类型
 * @param value - ID 值
 * @returns string - 格式化后的 ID
 */
export function formatId(type: IdType, value: string): string {
  switch (type) {
    case IdType.APPOINTMENT:
      return `a${value}`;
    case IdType.ORDER:
      return `o${value}`;
    default:
      return value;
  }
} 