import { extractIP, getIp, lookupIpLocation } from "@/processor/utils/index.js";
import { Public } from "@/processor/decorator/index.js";
import { TokenService } from "@/system/auth/token.service.js";
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
import { OnlineService } from "./online.service.js";

type PresenceSocket = WebSocket & {
  userId?: string;
  jti?: string;
  username?: string;
  phone?: string;
  exp?: number;
  isSuperAdmin?: boolean;
};

interface JwtPresencePayload {
  sub?: string;
  id?: string;
  username?: string;
  phone?: string;
  jti?: string;
  exp?: number;
  roles?: Array<{ code?: string } | string>;
}

@Public()
@WebSocketGateway({
  path: "/online/ws",
  cors: { origin: true, credentials: true },
})
export class OnlineGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OnlineGateway.name);
  /** jti -> sockets（同会话多标签） */
  private readonly sockets = new Map<string, Set<PresenceSocket>>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly onlineService: OnlineService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async handleConnection(
    client: PresenceSocket,
    ...args: unknown[]
  ): Promise<void> {
    const req = args[0] as IncomingMessage | undefined;
    const token = this.extractToken(req);
    if (!token) {
      this.closeWith(client, "unauthorized");
      return;
    }

    try {
      const secret = this.configService.getOrThrow<string>("token.secret");
      const payload = await this.jwtService.verifyAsync<JwtPresencePayload>(
        token,
        { secret },
      );
      const userId = payload.sub ?? payload.id;
      const jti = payload.jti;
      if (!userId || !jti) {
        this.closeWith(client, "invalid_token");
        return;
      }

      if (await this.tokenService.isBlacklisted(jti)) {
        await this.onlineService.remove(jti);
        this.closeWith(client, "revoked");
        return;
      }

      client.userId = userId;
      client.jti = jti;
      client.username = payload.username ?? "";
      client.phone = payload.phone ?? "";
      client.exp = payload.exp ?? Math.floor(Date.now() / 1000) + 3600;
      client.isSuperAdmin = Array.isArray(payload.roles)
        ? payload.roles.some((role) =>
            typeof role === "string"
              ? role === "super_admin"
              : role?.code === "super_admin",
          )
        : false;

      const ip = extractIP(getIp(req as IncomingMessage) || "") || "-";
      const userAgent = String(req?.headers["user-agent"] ?? "");
      const location = await lookupIpLocation(ip);

      await this.onlineService.upsert({
        jti,
        userId,
        username: client.username,
        phone: client.phone,
        ip,
        location,
        userAgent,
        exp: client.exp,
        isSuperAdmin: client.isSuperAdmin,
      });

      this.addSocket(jti, client);
      client.send(
        JSON.stringify({ event: "connected", data: { ok: true, jti } }),
      );
    } catch (error) {
      this.logger.debug(
        `在线 WS 鉴权失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.closeWith(client, "unauthorized");
    }
  }

  handleDisconnect(client: PresenceSocket): void {
    if (!client.jti) return;
    this.removeSocket(client.jti, client);
  }

  @SubscribeMessage("ping")
  async handlePing(
    @ConnectedSocket() client: PresenceSocket,
    @MessageBody() _body: unknown,
  ) {
    if (!client.jti || !client.userId) {
      return { event: "error", data: { message: "unauthorized" } };
    }

    if (await this.tokenService.isBlacklisted(client.jti)) {
      await this.onlineService.remove(client.jti);
      this.removeSocket(client.jti, client);
      try {
        client.send(
          JSON.stringify({ event: "forceLogout", data: { reason: "revoked" } }),
        );
      } catch {
        // ignore
      }
      client.close();
      return { event: "forceLogout", data: { reason: "revoked" } };
    }

    let session = await this.onlineService.touchPing(client.jti);
    if (!session) {
      session = await this.onlineService.upsert({
        jti: client.jti,
        userId: client.userId,
        username: client.username ?? "",
        phone: client.phone,
        ip: "-",
        userAgent: "",
        exp: client.exp ?? Math.floor(Date.now() / 1000) + 120,
        isSuperAdmin: client.isSuperAdmin ?? false,
      });
    }

    return {
      event: "pong",
      data: {
        serverTime: Date.now(),
        lastPingAt: session.lastPingAt,
      },
    };
  }

  /** 强制下线：通知并关闭指定会话的所有 WS */
  notifyForceLogout(jtis: string[], reason = "forced"): void {
    for (const jti of jtis) {
      const set = this.sockets.get(jti);
      if (!set) continue;
      for (const socket of [...set]) {
        try {
          socket.send(
            JSON.stringify({ event: "forceLogout", data: { reason } }),
          );
        } catch {
          // ignore
        }
        try {
          socket.close();
        } catch {
          // ignore
        }
      }
      this.sockets.delete(jti);
    }
  }

  notifyForceLogoutByUser(userId: string, reason = "forced"): void {
    const jtis: string[] = [];
    for (const [jti, set] of this.sockets) {
      for (const socket of set) {
        if (socket.userId === userId) {
          jtis.push(jti);
          break;
        }
      }
    }
    this.notifyForceLogout(jtis, reason);
  }

  private addSocket(jti: string, client: PresenceSocket) {
    let set = this.sockets.get(jti);
    if (!set) {
      set = new Set();
      this.sockets.set(jti, set);
    }
    set.add(client);
  }

  private removeSocket(jti: string, client: PresenceSocket) {
    const set = this.sockets.get(jti);
    if (!set) return;
    set.delete(client);
    if (!set.size) this.sockets.delete(jti);
  }

  private extractToken(req?: IncomingMessage): string | null {
    if (!req?.url) return null;
    try {
      const host = req.headers.host ?? "localhost";
      const url = new URL(req.url, `http://${host}`);
      const queryToken = url.searchParams.get("token");
      if (queryToken) return queryToken;
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) return auth.slice(7);
    } catch {
      return null;
    }
    return null;
  }

  private closeWith(client: PresenceSocket, message: string) {
    try {
      client.send(JSON.stringify({ event: "error", data: { message } }));
    } catch {
      // ignore
    }
    client.close();
  }
}
