export function capitalizeFirstLetter(text: string) {
  if (!text) { // 处理空字符串的情况
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
