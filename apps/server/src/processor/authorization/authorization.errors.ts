import { ServiceUnavailableException } from "@nestjs/common";

export class AuthorizationCacheUnavailableException extends ServiceUnavailableException {
  constructor(cause?: unknown) {
    super("授权缓存暂不可用，请稍后重试", { cause });
  }
}

export class OrganizationGenerationUnavailableException extends ServiceUnavailableException {
  constructor(cause?: unknown) {
    super("组织数据已保存，但授权缓存失效失败，请稍后重试", { cause });
  }
}
