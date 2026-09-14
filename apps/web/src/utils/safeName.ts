export interface SafeNameOptions {
  /** 最长长度（包含扩展名），默认 180 */
  maxLength?: number
  /** 用来替换非法字符的占位符，默认 "_" */
  replacement?: string
  /** 是否允许以 "." 开头（隐藏文件），默认 false：会去掉前导点 */
  allowLeadingDot?: boolean
  /** 是否保留扩展名并在裁剪时优先保留，默认 true */
  keepExtension?: boolean
}

/**
 * 将任意文件名清洗为安全、可用的对象键（不包含路径）。
 * - Unicode 规范化 (NFKC)
 * - 去除控制字符、路径分隔符、保留名等
 * - 保留扩展名并在长度裁剪时优先保住扩展名
 * - 默认去除前导点，避免“隐藏文件”语义
 */
export function safeName(input: string, opts: SafeNameOptions = {}): string {
  const { maxLength = 180, replacement = '_', allowLeadingDot = false, keepExtension = true } = opts

  // 1) 规范化 & 初步整理
  let name = (input || '').normalize('NFKC')

  // 去控制字符 (U+0000–U+001F, U+007F)
  name = name.replace(/[\u0000-\u001F\u007F]/g, '') // eslint-disable-line
  // 合并空白并裁剪
  name = name.replace(/\s+/g, ' ').trim()

  // 可选：去掉前导点，避免隐藏文件
  if (!allowLeadingDot) name = name.replace(/^\.+/, '')

  // 2) 移除路径/危险字符
  // 这些字符在多平台/协议下有潜在问题：<>:"/\|?* 以及反斜杠、冒号等
  const ILLEGAL = /[<>:"/\\|?*]/g
  name = name.replace(ILLEGAL, replacement)

  // 也去掉剩余的分隔意图（比如多余的斜杠替换后形成的重复占位符）
  if (replacement) {
    const repEsc = escapeRegExp(replacement)
    name = name.replace(new RegExp(`${repEsc}{2,}`, 'g'), replacement)
  }

  // 去掉结尾的空格和点（Windows 不允许）
  name = name.replace(/[ .]+$/g, '')

  // 3) 拆分扩展名（优先保留）
  let base = name
  let ext = ''
  if (keepExtension) {
    const lastDot = name.lastIndexOf('.')
    // 只有中间有点且不是首字符时才视为扩展名
    if (lastDot > 0 && lastDot < name.length - 1) {
      base = name.slice(0, lastDot)
      ext = name.slice(lastDot + 1)
      // 清理扩展名里的非法字符（极端情况下）
      ext = ext.replace(ILLEGAL, '').replace(/\s+/g, '')
    }
  }

  // 4) Windows 保留名规避（CON/PRN/AUX/NUL/COM1..9/LPT1..9）
  const isWinReserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)
  if (isWinReserved) base = `${base}_`

  // 裁剪长度（尽量保住扩展名）
  const dotExt = ext ? `.${ext}` : ''
  const maxBaseLen = Math.max(1, maxLength - dotExt.length)
  if (strLen(base) > maxBaseLen) {
    base = sliceByCodeUnit(base, maxBaseLen).replace(/[ .]+$/g, '')
  }

  // 如果处理后为空，给个兜底
  if (!base) base = 'file'

  // 5) 合并并做最后一次清理
  let result = base + dotExt

  // 再次移除尾随空白/点
  result = result.replace(/[ .]+$/g, '')

  // 不能是 "." 或 ".."
  if (result === '.' || result === '..') result = `file${dotExt}`

  // 终极兜底：长度太短或为空
  if (!result) result = 'file'

  // 超长再砍（极少见：扩展名过长或其它情况）
  if (strLen(result) > maxLength) {
    result = sliceByCodeUnit(result, maxLength)
  }

  return result
}

/* ---------- 小工具函数 ---------- */

// 转义正则特殊字符
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 以 UTF-16 code unit 计数（与大多数字符串操作一致）
function strLen(s: string) {
  return s.length
}

// 安全截取前 N 个 code units（避免把 surrogate pair 切成一半）
// 这里简单处理：若落在高位代理后面，则回退 1 个。
function sliceByCodeUnit(s: string, max: number) {
  if (s.length <= max) return s
  let out = s.slice(0, max)
  // 如果最后一个是低位代理且前面不是高位代理，则回退一个
  const last = out.charCodeAt(out.length - 1)
  const prev = out.charCodeAt(out.length - 2)
  const isLowSurrogate = last >= 0xdc00 && last <= 0xdfff
  const isPrevHighSurrogate = prev >= 0xd800 && prev <= 0xdbff
  if (isLowSurrogate && !isPrevHighSurrogate) {
    out = out.slice(0, -1)
  }
  return out
}
