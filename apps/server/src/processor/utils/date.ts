export function getCurrentDateTimeCompact() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // 月份从0开始
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  // const second = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hour}${minute}`;
}

// 根据秒数转换时间
export function formatTimeBySeconds(seconds: number) {
  // 补零
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remainingSeconds = String((seconds % 60).toFixed(0)).padStart(2, "0");
  return `${hours}:${minutes}:${remainingSeconds}`;
}

export const formatDateToYMDHMS = (time?: Date | string | null) => {
  if (typeof time === "string") {
    time = new Date(time);
  }
  if (!time) return "";
  return time
    .toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    .split("T")
    .join(" ")
    .replaceAll("/", "-");
};
