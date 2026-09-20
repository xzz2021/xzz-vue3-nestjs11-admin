import {
  createQuietRedis,
  logRedisConnectFailure,
  redisTarget,
} from '#/infrastructure/database/redis/redis-connection.log.js';
import {
  buildRedisOptions,
  type AppRedisConfig,
} from '#/infrastructure/database/redis/redis-options.js';
import { Public } from '#/processor/decorator/index.js';
import { wsCorsOptions } from '#/processor/utils/cors.util.js';
import { TokenService } from '#/system/auth/token.service.js';
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
import type { Redis } from 'ioredis';
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
  cors: wsCorsOptions(),
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
    const redisCfg = this.configService.get<AppRedisConfig>('redis');
    const target = redisTarget(redisCfg?.host, redisCfg?.port);
    // Pub/Sub 须独立连接；不在启动阶段 await subscribe，避免 Redis 未启动时卡住整个进程
    const subscriber = createQuietRedis(
      buildRedisOptions(redisCfg, {
        enableOfflineQueue: true,
        maxRetriesPerRequest: null,
        lazyConnect: false,
      }),
      this.logger,
      target,
    );
    this.subscriber = subscriber;
    subscriber.on('message', (channel, raw) => {
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

    const subscribe = async () => {
      try {
        await subscriber.subscribe(MESSAGE_PUSH_CHANNEL);
        this.logger.log(`已订阅 Redis 频道 ${MESSAGE_PUSH_CHANNEL}`);
      } catch (error) {
        logRedisConnectFailure(this.logger, target, error);
      }
    };

    if (subscriber.status === 'ready') {
      void subscribe();
      return;
    }
    subscriber.once('ready', () => {
      void subscribe();
    });
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
