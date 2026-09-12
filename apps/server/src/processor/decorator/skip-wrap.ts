import { SetMetadata } from "@nestjs/common";

export const SKIP_WRAP_KEY = "skipResponseWrap";

/** 跳过统一响应包装，用于文件流、第三方回调等原始响应。 */
export const SkipWrap = () => SetMetadata(SKIP_WRAP_KEY, true);
