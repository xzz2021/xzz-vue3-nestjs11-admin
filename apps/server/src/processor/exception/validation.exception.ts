import { BadRequestException } from "@nestjs/common";

/**
 * ValidationException used to throw validation errors with a custom error code and message.
 * ErrorCode default is V000 (Common Validation)
 */
export class ValidationException extends BadRequestException {
  constructor(errorCode: string = "V000", message?: string) {
    super({ errorCode, message: message ?? "校验失败" });
  }
}
