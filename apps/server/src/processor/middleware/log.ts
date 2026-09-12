// // request-log.middleware.ts
// import { Injectable, NestMiddleware } from '@nestjs/common';
// import { Request, Response, NextFunction } from 'express';
// import { UtilService } from 'src/util/util.service';

// @Injectable()
// export class RequestLogMiddleware implements NestMiddleware {
//   constructor(private readonly utilService: UtilService) {}

//   use(req: Request, res: Response, next: NextFunction) {
//     // console.log('xzz2021: RequestLogMiddleware -> use -> res', res);

//     // console.log('xzz2021: RequestLogMiddleware -> use -> req', req);
//     // const { method, originalUrl, ip = '未知', headers } = req;
//     // //  获取statusCode
//     // const statusCode = res.statusCode;
//     // const userAgent = headers['user-agent'] || '';
//     // const user = req['user'] as any;
//     // const { method, originalUrl, ip = '未知', headers } = req;
//     // const userAgent = headers['user-agent'] || '未知';
//     // const user = req['user'];
//     // console.log('xzz2021: RequestLogMiddleware -> use -> user', user);
//     // // 监听响应结束事件来记录状态码
//     // res.on('finish', async (ddd: any) => {
//     //   console.log('xzz2021: RequestLogMiddleware -> use -> ddd', ddd);
//     //   // const status = res.statusCode;
//     //   // await this.utilService.createRequestLog({ method, url: originalUrl, resCode: status, ip, userAgent });
//     // });

//     // const logData = {
//     //   resCode: statusCode,
//     //   method,
//     //   url: originalUrl,
//     //   ip,
//     //   userAgent,
//     //   feedbackMsg: '',
//     //   username: user?.username || '未知',
//     //   //   duration: Date.now() - start,
//     // };

//     // 将日志写入数据库
//     // await this.utilService.createRequestLog(logData);
//     // console.log('xzz2021: RequestLogMiddleware -> use -> logData', logData);

//     next();
//   }
// }
