import { Request, Response, NextFunction } from "express";

// 函数式中间件
export function logger(_req: Request, _res: Response, next: NextFunction) {
  console.log(`Request...`);
  next();
}

/*
  consumer.apply(logger).forRoutes(CatsController)  // 控制  CatsController 的 所有路由

  consumer.apply(cors(), helmet(), logger).forRoutes(CatsController);  // 控制  CatsController 的 所有路由


  app.use(logger);  // 全局中间件



*/
