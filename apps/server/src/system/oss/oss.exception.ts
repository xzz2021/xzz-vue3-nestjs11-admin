import { ErrorEnum } from "@/processor/constants/error-code.js";
import { HttpException, HttpStatus } from "@nestjs/common";

const STATUS_BY_CODE: Record<string, number> = {
  "1401": HttpStatus.CONFLICT,
  "1402": HttpStatus.BAD_REQUEST,
  "1403": HttpStatus.BAD_REQUEST,
  "1404": HttpStatus.SERVICE_UNAVAILABLE,
  "1405": HttpStatus.BAD_REQUEST,
  "1406": HttpStatus.NOT_FOUND,
  "1407": HttpStatus.BAD_GATEWAY,
};

export function throwOssError(
  code: ErrorEnum,
  extra?: Record<string, unknown>,
): never {
  const [errorCode, message] = code.split(":") as [string, string];
  throw new HttpException(
    { message, errorCode, ...extra },
    STATUS_BY_CODE[errorCode] ?? HttpStatus.BAD_REQUEST,
  );
}
