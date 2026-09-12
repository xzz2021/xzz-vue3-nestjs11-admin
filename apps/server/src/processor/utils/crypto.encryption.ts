import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// 加密数据 - 支持字符串、对象和数组
export function aesGcmEncrypt<T = string | object | any[]>(
  data: T,
  key: string,
) {
  // 将数据转换为字符串
  const plaintext = typeof data === "string" ? data : JSON.stringify(data);

  const iv = randomBytes(12); // GCM 推荐 12 字节
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // 传输/存储时通常需要一起携带 iv 与 authTag
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
  };
}

// 自动检测数据类型
function detectDataType(data: string): "string" | "object" | "array" {
  // 尝试解析为 JSON
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return "array";
    } else if (typeof parsed === "object" && parsed !== null) {
      return "object";
    }
  } catch {
    // 如果 JSON 解析失败，则认为是字符串
  }
  return "string";
}

// 解密数据 - 支持字符串、对象和数组，自动判断数据类型
export function aesGcmDecrypt<T = string | object | any[]>(
  { ciphertext, iv, tag }: { ciphertext: string; iv: string; tag: string },
  key: string,
): T {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  const decryptedString = decrypted.toString("utf8");

  // 自动检测数据类型
  const dataType = detectDataType(decryptedString);

  // 根据检测到的类型决定如何解析数据
  if (dataType === "string") {
    return decryptedString as T;
  } else {
    try {
      return JSON.parse(decryptedString) as T;
    } catch (error) {
      throw new Error("解密后的数据无法解析为 JSON 格式");
    }
  }
}
