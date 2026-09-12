// import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
// import { Observable, catchError, from, tap, throwError } from 'rxjs';

// const prismaErrorMap = new Map([
//   ['P1001', '数据库操作失败'],
//   ['P1017', '数据库服务异常'],
//   ['P2028', '数据库服务连接失败'],
//   ['ECONNREFUSED', '数据库拒绝操作'],
//   ['ETIMEDOUT', '数据库服务超时'],
// ]);
// @Injectable()
// export class PrismaRetryInterceptor implements NestInterceptor {
//   constructor(
//     private readonly maxRetries = 3,
//     private readonly delayMs = 3000,
//   ) {}

//   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
//     const exception = context.switchToHttp().getRequest().exception;
//     console.log('🚀 ~ PrismaRetryInterceptor -----------~ intercept ~ exception:', exception);

//     return next.handle().pipe(
//       tap(data => {
//         console.log('🚀 ~ PrismaRetryInterceptor ~ ===============tap ~ data:', data);
//       }),
//       catchError(error => {
//         console.log('🚀 ~ PrismaRetryInterceptor ~ ===============intercept ~ error:', error);
//         return throwError(() => error);
//       }),
//     );
//     //     const handleWithRetry = async (): Promise<any> => {
//     //       let attempt = 0;
//     //       while (true) {
//     //         try {
//     //           const result = await next.handle().toPromise();
//     //           return result;
//     //         } catch (error) {
//     //           console.log('🚀 ~ PrismaRetryInterceptor ~ ===============handleWithRetry ~ true:');
//     //           attempt++;
//     //           if (!this.shouldRetry(error) || attempt > this.maxRetries) {
//     //             throw error;
//     //           }
//     //           console.warn(`[RetryInterceptor] Retrying attempt #${attempt} due to error: ${error.message}`);
//     //           await this.delay(this.delayMs);
//     //         }
//     //       }
//     //     };

//     //     return from(handleWithRetry());
//     //   }

//     //   private shouldRetry(error: any): boolean {
//     //     const retryableErrors = ['P1001', 'P1017', 'P2028', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
//     //     return retryableErrors.includes(error?.code);
//     //   }

//     //   private delay(ms: number): Promise<void> {
//     //     return new Promise(resolve => setTimeout(resolve, ms));
//     //   }
//   }
// }
// /*

// app.useGlobalInterceptors(new PrismaRetryInterceptor());

// */
