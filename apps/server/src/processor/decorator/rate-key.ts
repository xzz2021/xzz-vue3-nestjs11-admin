// rate-key.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const RATE_KEY = "rate_key";

/**
 * 给限流 Guard 返回一个自定义 key
 * @param key 任意字符串（例如 "login" / "captcha" / "sms"）
 */
export const RateKey = (key: string) => SetMetadata(RATE_KEY, key);
