export const prismaErrorMsg = (code: string) => {
  let message = "未手动识别的数据库错误";
  const retryableErrors = [
    "P1001",
    "P1017",
    "P2028",
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
  ];

  if (retryableErrors.includes(code)) {
    return "数据库服务异常";
  }
  switch (code) {
    case "P2002":
      message = `约定唯一值的字段值已存在`;
      break;
    case "P2025":
      message = `操作的记录不存在`;
      break;
    // 可以继续添加更多 Prisma 错误代码处理
    default:
      message = "未手动识别的数据库错误";
  }
  return message;
};
