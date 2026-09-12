//  此处用于所有请求的异常结果返回  确保 捕获到的异常 都能有正常的错误响应给前端
//   因为时nest内置封装的函数  所以可以拿到错误的源信息
//  dto的错误也会走向这里
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { formatDateToYMDHMS } from '@/processor/utils/date.js';

// 启用后不会再报错 而是返回定义好的数据
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // console.log('----------------------------', exception);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      code: status || 400, //  常规状态码 需在前端拦截处理   401  403 500 等  默认 400
      timestamp: formatDateToYMDHMS(new Date()),
      message: exception.message,
      meta: exception.getResponse(),
    });
  }
}

/*
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';


@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor() {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    if (request) {
      const status = exception.getStatus ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

      const errorResponse = {
        code: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        error: status !== HttpStatus.INTERNAL_SERVER_ERROR ? exception.message || null : 'Internal server error',
        message: typeof exception.getResponse() === 'object' ? (exception.getResponse() as any).message : exception.getResponse(),
      };

      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        this._logger.error(`${request.method} ${request.url}`, exception.stack, 'ExceptionFilter');
      } else {
        this._logger.error(`${request.method} ${request.url}`, JSON.stringify(errorResponse), 'ExceptionFilter');
      }

      return response.status(status).json(errorResponse);
    } else {
      // GRAPHQL Exception
      // const gqlHost = GqlArgumentsHost.create(host);
      return exception;
    }
  }
}


*/
