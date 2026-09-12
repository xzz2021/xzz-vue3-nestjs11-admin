import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { IncomingMessage } from "node:http";
import type { Server } from "ws";
import WebSocket from "ws";
import { Public } from "#/processor/decorator/index.js";
import { MonitorService } from "./monitor.service.js";

type AuthedSocket = WebSocket & {
  isAlive?: boolean;
  userId?: string;
};

/** WS 鉴权在 handleConnection 中完成，跳过全局 JWT/Permission Guard */
@Public()
@WebSocketGateway({
  path: "/monitor/ws",
  cors: { origin: true, credentials: true },
})
export class MonitorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MonitorGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly monitorService: MonitorService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(
    client: AuthedSocket,
    ...args: unknown[]
  ): Promise<void> {
    const req = args[0] as IncomingMessage | undefined;
    const token = this.extractToken(req);
    if (!token) {
      this.closeUnauthorized(client);
      return;
    }

    try {
      const secret = this.configService.getOrThrow<string>("token.secret");
      const payload = await this.jwtService.verifyAsync<{
        id?: string;
        sub?: string;
      }>(token, {
        secret,
      });
      client.userId = payload.sub ?? payload.id;
      client.isAlive = true;
      client.send(JSON.stringify({ event: "connected", data: { ok: true } }));
    } catch (error) {
      this.logger.debug(
        `WS 鉴权失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.closeUnauthorized(client);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    client.isAlive = false;
  }

  /**
   * 前端每 5 秒发送 poll，返回 Redis 滑动窗口中的监控数据。
   */
  @SubscribeMessage("poll")
  async handlePoll(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() _body: unknown,
  ) {
    if (!client.userId) {
      return { event: "error", data: { message: "unauthorized" } };
    }
    const payload = await this.monitorService.getPayload();
    return { event: "metrics", data: payload };
  }

  private extractToken(req?: IncomingMessage): string | null {
    if (!req?.url) return null;
    try {
      const host = req.headers.host ?? "localhost";
      const url = new URL(req.url, `http://${host}`);
      const queryToken = url.searchParams.get("token");
      if (queryToken) return queryToken;

      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        return auth.slice(7);
      }
    } catch {
      return null;
    }
    return null;
  }

  private closeUnauthorized(client: AuthedSocket): void {
    try {
      client.send(
        JSON.stringify({ event: "error", data: { message: "unauthorized" } }),
      );
    } catch {
      // ignore
    }
    client.close();
  }
}
