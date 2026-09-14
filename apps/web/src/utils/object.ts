interface UAInfo {
  os: string
  browser: string
  device: string
  isReal: boolean
}

export const parseUserAgent = (ua: string): UAInfo => {
  const osRegex = /\(([^)]+)\)/ // 括号里的系统信息
  const browserRegex = /(Chrome|Firefox|Safari|Edg|Opera|MSIE|Trident)\/([\d.]+)/

  // 1. 操作系统
  const osMatch = ua.match(osRegex)
  const os = osMatch ? osMatch[1] : 'Unknown'

  // 2. 浏览器
  const browserMatch = ua.match(browserRegex)
  let browser = 'Unknown'
  if (browserMatch) {
    browser = `${browserMatch[1]} ${browserMatch[2]}`
  }

  // 3. 设备（简单判断）
  let device = 'PC'
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    device = 'Mobile'
  }

  // 4. 真实性判定（非常基础）
  let isReal = true
  if (!browserMatch || !osMatch) {
    isReal = false // 缺失关键部分
  }
  if (/Mozilla\/5\.0/.test(ua) === false) {
    isReal = false // 基本的 UA 都以 Mozilla/5.0 开头
  }
  if (/Chrome\/\d+\./.test(ua) && /Safari\//.test(ua) === false) {
    isReal = false // Chrome UA 必然带 Safari
  }

  return {
    os,
    browser,
    device,
    isReal
  }
}
