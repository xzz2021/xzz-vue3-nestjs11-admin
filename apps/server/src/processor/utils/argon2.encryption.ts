import * as argon2 from "argon2";

// 加密支付密码
async function hashPayPassword(plainPassword: string): Promise<string> {
  return await argon2.hash(plainPassword, {
    type: argon2.argon2id, // 更安全的 Argon2id 变种
  });
}

// 验证支付密码
async function verifyPayPassword(
  hashedPassword: string,
  inputPassword: string,
): Promise<boolean> {
  return await argon2.verify(hashedPassword, inputPassword);
}

// 加密数据
async function encryptData(data: string): Promise<string> {
  return await argon2.hash(data, {
    type: argon2.argon2id,
  });
}

// 解密数据

export { encryptData, hashPayPassword, verifyPayPassword };
