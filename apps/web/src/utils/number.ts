// 处理价格输入，限制最多两位小数  非负数
export const handlePriceInput = (value: string) => {
  // 移除非数字和小数点的字符
  let cleanValue = value.replace(/[^\d.]/g, '')

  // 确保只有一个小数点
  const parts = cleanValue.split('.')
  if (parts.length > 2) {
    cleanValue = parts[0] + '.' + parts.slice(1).join('')
  }

  // 限制小数点后最多两位
  if (parts.length === 2 && parts[1].length > 2) {
    cleanValue = parts[0] + '.' + parts[1].substring(0, 2)
  }

  // 更新价格值
  return cleanValue
}
