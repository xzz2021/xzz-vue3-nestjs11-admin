import {
  buildRedisOptions,
  type AppRedisConfig,
} from '@/infrastructure/database/redis/redis-options.js';
import { Public } from '@/processor/decorator/index.js';
import { TokenService } from '@/system/auth/token.service.js';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Redis } from 'ioredis';
import type { IncomingMessage } from 'node:http';
import type { Server } from 'ws';
import WebSocket from 'ws';
import { MESSAGE_PUSH_CHANNEL } from './message.constants.js';
import { MessageDeliveryService } from './message-delivery.service.js';
import type { MessagePushPayload } from './message.types.js';

type MsgSocket = WebSocket & {
  userId?: string;
  jti?: string;
};

@Public()
@WebSocketGateway({
  path: '/message/ws',
  cors: { origin: true, credentials: true },
})
export class MessageGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger = new Logger(MessageGateway.name);
  private readonly sockets = new Map<string, Set<MsgSocket>>();
  private subscriber: Redis | null = null;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly delivery: MessageDeliveryService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async onModuleInit() {
    try {
      //  Redis 协议 + BullMQ 约束 决定了不能全挤在一条连接上。所以需要单独连接一个 ioredis 实例。
      const redisCfg = this.configService.get<AppRedisConfig>('redis');
      // Pub/Sub 须独立连接；无密码时不传 password，避免重复 AUTH WARN
      this.subscriber = new Redis(
        buildRedisOptions(redisCfg, {
          enableOfflineQueue: true,
          maxRetriesPerRequest: null,
          lazyConnect: false,
        }),
      );
      await this.subscriber.subscribe(MESSAGE_PUSH_CHANNEL);
      this.subscriber.on('message', (channel, raw) => {
        if (channel !== MESSAGE_PUSH_CHANNEL) return;
        try {
          const payload = JSON.parse(raw) as MessagePushPayload;
          this.pushToUser(payload);
        } catch (error) {
          this.logger.debug(
            `解析推送消息失败: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
      this.logger.log(`已订阅 Redis 频道 ${MESSAGE_PUSH_CHANNEL}`);
    } catch (error) {
      this.logger.error(
        `消息推送订阅失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(MESSAGE_PUSH_CHANNEL);
        this.subscriber.disconnect();
      } catch {
        // ignore
      }
      this.subscriber = null;
    }
  }

  async handleConnection(client: MsgSocket, ...args: unknown[]) {
    const req = args[0] as IncomingMessage | undefined;
    const token = this.extractToken(req);
    if (!token) {
      this.closeWith(client, 'unauthorized');
      return;
    }
    try {
      const secret = this.configService.getOrThrow<string>('token.secret');
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        id?: string;
        jti?: string;
      }>(token, { secret });
      const userId = payload.sub ?? payload.id;
      const jti = payload.jti;
      if (!userId || !jti) {
        this.closeWith(client, 'invalid_token');
        return;
      }
      if (await this.tokenService.isBlacklisted(jti)) {
        this.closeWith(client, 'revoked');
        return;
      }
      client.userId = userId;
      client.jti = jti;
      this.addSocket(userId, client);
      const unread = await this.delivery.getUnreadCount(userId);
      client.send(
        JSON.stringify({ event: 'connected', data: { ok: true, unread } }),
      );
    } catch (error) {
      this.logger.debug(
        `消息 WS 鉴权失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.closeWith(client, 'unauthorized');
    }
  }

  handleDisconnect(client: MsgSocket) {
    if (!client.userId) return;
    this.removeSocket(client.userId, client);
  }

  @SubscribeMessage('unread')
  async handleUnread(@ConnectedSocket() client: MsgSocket) {
    if (!client.userId)
      return { event: 'error', data: { message: 'unauthorized' } };
    const unread = await this.delivery.getUnreadCount(client.userId);
    return { event: 'unread', data: { unread } };
  }

  @SubscribeMessage('ping')
  async handlePing(
    @ConnectedSocket() client: MsgSocket,
    @MessageBody() _body: unknown,
  ) {
    if (!client.userId || !client.jti)
      return { event: 'error', data: { message: 'unauthorized' } };
    if (await this.tokenService.isBlacklisted(client.jti)) {
      this.closeWith(client, 'revoked');
      return { event: 'forceLogout', data: { reason: 'revoked' } };
    }
    return { event: 'pong', data: { serverTime: Date.now() } };
  }

  private pushToUser(payload: MessagePushPayload) {
    const set = this.sockets.get(payload.userId);
    if (!set?.size) return;
    const packet = JSON.stringify({ event: 'message', data: payload });
    for (const socket of [...set]) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(packet);
        }
      } catch {
        // ignore
      }
    }
  }

  private addSocket(userId: string, client: MsgSocket) {
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set();
      this.sockets.set(userId, set);
    }
    set.add(client);
  }

  private removeSocket(userId: string, client: MsgSocket) {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(client);
    if (!set.size) this.sockets.delete(userId);
  }

  private extractToken(req?: IncomingMessage): string | null {
    if (!req?.url) return null;
    try {
      const host = req.headers.host ?? 'localhost';
      const url = new URL(req.url, `http://${host}`);
      const queryToken = url.searchParams.get('token');
      if (queryToken) return queryToken;
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) return auth.slice(7);
    } catch {
      return null;
    }
    return null;
  }

  private closeWith(client: MsgSocket, message: string) {
    try {
      client.send(JSON.stringify({ event: 'error', data: { message } }));
    } catch {
      // ignore
    }
    client.close();
  }
}
