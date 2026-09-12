import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import express from "express";
import { join } from "path";

// 创建静态文件中间件 与可能的同名路由作出区别 避免和路由混淆 确保静态文件在 Guard 之前响应 GET/HEAD

export function createStaticFileMiddleware(
  diskRoot: string,
  urlPrefix: string,
): RequestHandler {
  const prefix = `/${urlPrefix.replace(/^\/+|\/+$/g, "")}`;
  const serve = express.static(diskRoot, {
    fallthrough: true,
    index: false,
    setHeaders(res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    },
  });

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path !== prefix && !req.path.startsWith(`${prefix}/`)) {
      next();
      return;
    }

    const queryIndex = req.url.indexOf("?");
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    const rest = req.path.slice(prefix.length) || "/";
    if (isUploadTempPath(rest)) {
      res.status(404).end();
      return;
    }
    const originalUrl = req.url;
    req.url = `${rest}${query}`;
    serve(req, res, (err?: Error) => {
      req.url = originalUrl;
      if (err) {
        next(err);
        return;
      }
      res.status(404).end();
    });
  };
}

@Module({
  imports: [ConfigModule],
})
export class StaticAssetsModule implements NestModule {
  constructor(private readonly configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    const staticFileRootPath =
      this.configService.get<string>("staticFileRootPath");
    if (!staticFileRootPath) return;

    const urlPrefix = staticFileRootPath.replace(/^\/+|\/+$/g, "");
    const diskRoot = join(process.cwd(), staticFileRootPath);
    consumer.apply(createStaticFileMiddleware(diskRoot, urlPrefix)).forRoutes({
      path: "{*path}",
      method: RequestMethod.ALL,
    });
  }
}

export const SERVER_STATIC_MODULE = StaticAssetsModule;

function isUploadTempPath(rest: string): boolean {
  const normalized = rest.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
  return normalized === "file/tmp" || normalized.startsWith("file/tmp/");
}
