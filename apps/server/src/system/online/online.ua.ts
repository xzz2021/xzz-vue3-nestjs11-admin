/**
 * 轻量 UA 解析，避免引入 ua-parser 依赖。
 */
export function parseUserAgent(uaRaw: string): {
  browser: string;
  os: string;
  device: string;
} {
  const ua = uaRaw || "";
  const lower = ua.toLowerCase();

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";
  else if (/msie|trident/i.test(ua)) browser = "IE";

  let os = "Unknown";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let device = "Desktop";
  if (/ipad|tablet/i.test(ua)) device = "Tablet";
  else if (/mobile|android|iphone|ipod/i.test(ua)) device = "Mobile";
  else if (!ua) device = "Unknown";

  // 细一点：带上浏览器主版本
  const chrome = ua.match(/Chrome\/([\d.]+)/i);
  const firefox = ua.match(/Firefox\/([\d.]+)/i);
  const safari = ua.match(/Version\/([\d.]+).*Safari/i);
  const edge = ua.match(/Edg\/([\d.]+)/i);
  if (browser === "Edge" && edge) browser = `Edge ${edge[1]}`;
  else if (browser === "Chrome" && chrome) browser = `Chrome ${chrome[1]}`;
  else if (browser === "Firefox" && firefox) browser = `Firefox ${firefox[1]}`;
  else if (browser === "Safari" && safari) browser = `Safari ${safari[1]}`;

  if (lower.includes("bot")) device = "Bot";

  return { browser, os, device };
}
