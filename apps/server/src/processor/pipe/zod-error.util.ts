import { ZodError, type ZodIssue } from "zod";

/** 常见字段中文名，用于兜底展示 */
const FIELD_LABELS: Record<string, string> = {
  phone: "手机号",
  password: "密码",
  username: "用户名",
  email: "邮箱",
  nickname: "昵称",
  avatar: "头像",
  captchaId: "验证码",
  captchaText: "验证码",
  id: "ID",
  pageIndex: "页码",
  pageSize: "每页条数",
  enabled: "状态",
};

/** Zod 默认英文错误 -> 中文 */
const ZOD_MESSAGE_MAP: Array<[string | RegExp, string]> = [
  ["Invalid input", "格式不正确"],
  ["Required", "不能为空"],
  ["Expected string, received null", "不能为空"],
  ["Expected string, received undefined", "不能为空"],
  ["Expected number, received string", "必须是数字"],
  ["Expected boolean, received string", "必须是布尔值"],
  [/^String must contain at least (\d+) character/, "长度不能少于$1个字符"],
  [/^String must contain at most (\d+) character/, "长度不能超过$1个字符"],
  [/^Number must be greater than or equal to (\d+)/, "不能小于$1"],
  [/^Number must be less than or equal to (\d+)/, "不能大于$1"],
];

function translateMessage(message: string): string {
  for (const [pattern, replacement] of ZOD_MESSAGE_MAP) {
    if (typeof pattern === "string" && message.includes(pattern)) {
      return message.replace(pattern, replacement);
    }
    if (pattern instanceof RegExp && pattern.test(message)) {
      return message.replace(pattern, replacement);
    }
  }
  return message;
}

function getFieldLabel(path: PropertyKey[]): string {
  const field = path.map(String).join(".");
  return FIELD_LABELS[field] ?? field;
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function formatZodIssue(issue: ZodIssue): string {
  const message = translateMessage(issue.message);

  // schema 里已定义中文 message（如「手机号格式不正确」）时直接使用
  if (hasChinese(message)) {
    return message;
  }

  if (!issue.path.length) {
    return message;
  }

  const label = getFieldLabel(issue.path);
  return `${label}: ${message}`;
}

export function formatZodErrorMessage(error: unknown): string {
  if (!(error instanceof ZodError)) {
    return "DTO校验失败: 数据类型不合法";
  }

  const messages = error.issues.map(formatZodIssue);
  return messages.join(", ") || "DTO校验失败: 数据类型不合法";
}
