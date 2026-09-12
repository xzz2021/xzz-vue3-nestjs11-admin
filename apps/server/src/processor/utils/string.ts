export const parseUserAgent = (userAgent: string) => {
  let os = "Unknown OS";
  let browser = "Unknown Browser";

  // 解析操作系统
  const osMatch = userAgent.match(
    /Windows NT 10.0|Mac OS X|iPhone OS (\d+_\d+)|Android|Linux/,
  );
  if (osMatch) {
    if (osMatch[1]) {
      os = `iOS ${osMatch[1].replace(/_/g, ".")}`;
    } else {
      os = osMatch[0]
        .replace("Windows NT 10.0", "Windows 10")
        .replace("Mac OS X", "Mac OS");
    }
  }

  // 解析浏览器
  const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
  const safariMatch = userAgent.match(/Safari\/(\d+)/);
  const versionMatch = userAgent.match(/Version\/(\d+)/);
  const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
  const ieMatch = userAgent.match(/MSIE (\d+)|Trident.*rv:(\d+)/);

  if (chromeMatch) {
    browser = `Chrome ${chromeMatch[1]}`;
  } else if (safariMatch && versionMatch) {
    browser = `Safari ${safariMatch[1]}`;
  } else if (firefoxMatch) {
    browser = `Firefox ${firefoxMatch[1]}`;
  } else if (ieMatch) {
    browser = `Internet Explorer ${ieMatch[1] || ieMatch[2]}`;
  }

  return { os, browser };
};

export const extractIP = (ipString: string) => {
  const match = ipString.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
  return match ? match[1] : ipString;
};

export const clientIp = (ip?: string | null) => {
  const value = extractIP(ip ?? "").trim();
  return value || undefined;
};

// // 示例使用
// const ua1 =
//   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
// const ua2 =
//   'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
// const ipExample = '::ffff:127.0.0.1'

// console.log(parseUserAgent(ua1)) // { os: 'Windows 10', browser: 'Chrome 131' }
// console.log(parseUserAgent(ua2)) // { os: 'iOS 16.6', browser: 'Safari 605' }
// console.log(extractIP(ipExample)) // "127.0.0.1"

//  对比数据变化

export const calculateDiff = (before: any, after: any) => {
  const changes: any = {};
  for (const key in after) {
    if (before?.[key] !== after?.[key]) {
      changes[key] = { from: before?.[key], to: after?.[key] };
    }
  }
  return changes;
};
