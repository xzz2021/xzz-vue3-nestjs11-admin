import { INestApplication, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

import auth from "basic-auth";
import { timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";

export interface SwaggerCredentials {
  username: string;
  password: string;
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function isBasicCredentials(
  value: unknown,
): value is { name: string; pass: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "pass" in value &&
    typeof value.pass === "string"
  );
}

function swaggerAuth(username: string, password: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const credentials: unknown = auth(req);
    if (
      !isBasicCredentials(credentials) ||
      !safeEqual(credentials.name, username) ||
      !safeEqual(credentials.pass, password)
    ) {
      res.set("WWW-Authenticate", 'Basic realm="Swagger"');
      return res.status(401).send("Authentication required.");
    }
    next();
  };
}

export function createSwagger(
  app: INestApplication,
  credentials: SwaggerCredentials,
) {
  if (!credentials.username || credentials.password.length < 6) {
    throw new Error("Swagger credentials are missing or too weak");
  }

  Logger.log("Swagger documentation enabled at /docs", "Bootstrap");
  app.use("/docs", swaggerAuth(credentials.username, credentials.password));
  const config = new DocumentBuilder()
    .setTitle("后台管理")
    .setDescription("design by xzz2021")
    .setVersion("1.0")
    .addGlobalResponse({
      status: 400,
      description: "错误响应",
    })
    .addGlobalResponse({
      status: 401,
      description: "未授权，缺失或无效的令牌",
    })
    .addGlobalResponse({
      status: 500,
      description: "服务器内部错误",
    })
    .addBearerAuth({
      description: "Please enter token:",
      // name: 'Authorization',
      // bearerFormat: 'bearer',
      scheme: "bearer",
      type: "http",
    })
    // .addServer(`http://127.0.0.1:3000`, 'Base URL')
    .build();

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  document.security = [{ bearer: [] }]; //  给api请求添加token
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      docExpansion: "list", // 展开所有操作，但折叠模型
      defaultModelsExpandDepth: 3, // 模型展开深度
      defaultModelExpandDepth: 3, // 模型属性展开深度
      displayRequestDuration: true, // 显示请求持续时间
      filter: true, // 启用过滤器
      // defaultModelRendering: 'model',
      // deepLinking: true,
      showExtensions: true, // 显示扩展
      showCommonExtensions: true, // 显示通用扩展
      // tryItOutEnabled: true, // 启用"Try it out"功能
      requestSnippetsEnabled: true, // 启用请求代码片段
      syntaxHighlight: {
        activate: true,
        theme: "agate", // 代码高亮主题
      },
      persistAuthorization: false, // 禁止在浏览器存储 Bearer Token
    },
  });
}
