// // src/logger/morgan.middleware.ts
// import morgan from 'morgan';
// import { LoggerService } from '@/logger/logger.service';

// // 创建 函数式中间件   使用LoggerService 的  createInfoLog  方法 创建 日志

// export const morganMiddleware = () => {

//     morgan('combined', {
//   stream: {
//     write: (message: string) => {
//       message.trim();
//     },
//   },
// });
// }
