import { RedisKeys } from '#/processor/constants/cache.js';
import { RbacPermissionCacheService } from '#/processor/rbac/rbac-permission-cache.service.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AuthorizationCacheUnavailableException } from './authorization.errors.js';
import type { AuthorizationSnapshot } from './authorization-snapshot.js';
import { scopeGrantStrategies } from './scope-grant-strategy.registry.js';

interface SnapshotCachePayload {
  pv: number;
  ov: number;
  snapshot: AuthorizationSnapshot;
}

interface CacheState {
  permissionGeneration: number;
  organizationGeneration: number;
  cached: string | null;
}

class SnapshotGenerationChangedError extends Error {}

@Injectable()
export class AuthorizationSnapshotCacheService {
  static readonly TTL_SECONDS = 5 * 60;
  static readonly TTL_JITTER_SECONDS = 60;
  static readonly MAX_GENERATION_RETRIES = 2;
  private static readonly CAS_SCRIPT = `
    local permissionGeneration = redis.call('GET', KEYS[1]) or '0'
    local organizationGeneration = redis.call('GET', KEYS[2]) or '0'
    if permissionGeneration ~= ARGV[1] or organizationGeneration ~= ARGV[2] then
      return 0
    end
    redis.call('SET', KEYS[3], ARGV[4], 'EX', ARGV[3])
    return 1
  `;

  private readonly redis: Redis;
  private readonly inflight = new Map<string, Promise<AuthorizationSnapshot>>();

  constructor(
    redisService: RedisService,
    private readonly permissionGeneration: RbacPermissionCacheService,
  ) {
    this.redis = redisService.getOrThrow();
  }

  async getOrLoad(
    userId: string,
    loader: () => Promise<AuthorizationSnapshot>,
  ): Promise<AuthorizationSnapshot> {
    for (
      let attempt = 0;
      attempt <= AuthorizationSnapshotCacheService.MAX_GENERATION_RETRIES;
      attempt++
    ) {
      const state = await this.readState(userId);
      const cached = await this.readValidSnapshot(userId, state);
      if (cached) return cached;

      const inflightKey = this.inflightKey(userId, state);
      const existing = this.inflight.get(inflightKey);
      if (existing) {
        try {
          return await existing;
        } catch (error) {
          if (error instanceof SnapshotGenerationChangedError) continue;
          throw error;
        }
      }

      const pending = this.loadForGeneration(userId, state, loader).finally(
        () => {
          this.inflight.delete(inflightKey);
        },
      );
      this.inflight.set(inflightKey, pending);
      try {
        return await pending;
      } catch (error) {
        if (error instanceof SnapshotGenerationChangedError) continue;
        throw error;
      }
    }
    throw new AuthorizationCacheUnavailableException(
      new Error('Authorization generations changed repeatedly'),
    );
  }

  private async readState(userId: string): Promise<CacheState> {
    try {
      const [permissionRaw, organizationRaw, cached] = await this.redis.mget(
        this.permissionGeneration.genKey(userId),
        RedisKeys.ORGANIZATION_GENERATION,
        this.key(userId),
      );
      return {
        permissionGeneration: this.parseGeneration(permissionRaw),
        organizationGeneration: this.parseGeneration(organizationRaw),
        cached,
      };
    } catch (error) {
      throw new AuthorizationCacheUnavailableException(error);
    }
  }

  private async readValidSnapshot(
    userId: string,
    state: CacheState,
  ): Promise<AuthorizationSnapshot | null> {
    if (state.cached === null) return null;
    const payload = this.parsePayload(state.cached);
    if (!payload) {
      try {
        await this.redis.del(this.key(userId));
      } catch (error) {
        throw new AuthorizationCacheUnavailableException(error);
      }
      return null;
    }
    return payload.pv === state.permissionGeneration &&
      payload.ov === state.organizationGeneration
      ? payload.snapshot
      : null;
  }

  private async loadForGeneration(
    userId: string,
    expected: CacheState,
    loader: () => Promise<AuthorizationSnapshot>,
  ): Promise<AuthorizationSnapshot> {
    const snapshot = await loader();
    const [permissionGeneration, organizationGeneration] =
      await this.readGenerations(userId);
    if (
      permissionGeneration !== expected.permissionGeneration ||
      organizationGeneration !== expected.organizationGeneration
    ) {
      throw new SnapshotGenerationChangedError();
    }

    const payload: SnapshotCachePayload = {
      pv: expected.permissionGeneration,
      ov: expected.organizationGeneration,
      snapshot,
    };
    const published = await this.publishIfCurrent(userId, expected, payload);
    if (!published) throw new SnapshotGenerationChangedError();
    return snapshot;
  }

  private async readGenerations(userId: string): Promise<[number, number]> {
    try {
      const [permissionRaw, organizationRaw] = await this.redis.mget(
        this.permissionGeneration.genKey(userId),
        RedisKeys.ORGANIZATION_GENERATION,
      );
      return [
        this.parseGeneration(permissionRaw),
        this.parseGeneration(organizationRaw),
      ];
    } catch (error) {
      throw new AuthorizationCacheUnavailableException(error);
    }
  }

  private async publishIfCurrent(
    userId: string,
    expected: CacheState,
    payload: SnapshotCachePayload,
  ): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        AuthorizationSnapshotCacheService.CAS_SCRIPT,
        3,
        this.permissionGeneration.genKey(userId),
        RedisKeys.ORGANIZATION_GENERATION,
        this.key(userId),
        String(expected.permissionGeneration),
        String(expected.organizationGeneration),
        String(this.ttlSeconds()),
        JSON.stringify(payload),
      );
      return Number(result) === 1;
    } catch (error) {
      throw new AuthorizationCacheUnavailableException(error);
    }
  }

  private key(userId: string): string {
    return `${RedisKeys.AUTHORIZATION_SNAPSHOT_PREFIX}${userId}`;
  }

  private inflightKey(userId: string, state: CacheState): string {
    return `${userId}:${state.permissionGeneration}:${state.organizationGeneration}`;
  }

  private parseGeneration(raw: string | null): number {
    const generation = Number(raw ?? 0);
    return Number.isFinite(generation) ? generation : 0;
  }

  private parsePayload(raw: string): SnapshotCachePayload | null {
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') return null;
      const payload = value as {
        pv?: unknown;
        ov?: unknown;
        snapshot?: unknown;
      };
      if (typeof payload.pv !== 'number' || !Number.isFinite(payload.pv))
        return null;
      if (typeof payload.ov !== 'number' || !Number.isFinite(payload.ov))
        return null;
      if (!this.isSnapshot(payload.snapshot)) return null;
      return payload as SnapshotCachePayload;
    } catch {
      return null;
    }
  }

  private isSnapshot(value: unknown): value is AuthorizationSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snapshot = value as {
      permissionCodes?: unknown;
      decisions?: unknown;
    };
    if (
      !Array.isArray(snapshot.permissionCodes) ||
      !snapshot.permissionCodes.every((code) => typeof code === 'string')
    ) {
      return false;
    }
    if (
      !snapshot.decisions ||
      typeof snapshot.decisions !== 'object' ||
      Array.isArray(snapshot.decisions)
    )
      return false;
    const permissionCodes = snapshot.permissionCodes;
    const decisions = snapshot.decisions as Record<string, unknown>;
    if (new Set(permissionCodes).size !== permissionCodes.length) return false;
    const wildcard = permissionCodes.length === 1 && permissionCodes[0] === '*';
    if (!wildcard) {
      if (permissionCodes.includes('*')) return false;
      const decisionCodes = Object.keys(decisions);
      if (
        decisionCodes.length !== permissionCodes.length ||
        !permissionCodes.every((code) => Object.hasOwn(decisions, code))
      ) {
        return false;
      }
    }
    return Object.values(decisions).every((decision) =>
      this.isDecision(decision),
    );
  }

  private isDecision(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const decision = value as { scoped?: unknown; grant?: unknown };
    if (decision.scoped === false) return true;
    if (
      decision.scoped !== true ||
      !decision.grant ||
      typeof decision.grant !== 'object'
    )
      return false;
    const grant = decision.grant as { all?: unknown; scopes?: unknown };
    if (typeof grant.all !== 'boolean' || !Array.isArray(grant.scopes))
      return false;
    if (grant.all) return grant.scopes.length === 0;
    if (!grant.scopes.every((scope) => scopeGrantStrategies.validate(scope)))
      return false;
    const types = grant.scopes.map((scope) => (scope as { type: string }).type);
    return new Set(types).size === types.length;
  }

  private ttlSeconds(): number {
    return (
      AuthorizationSnapshotCacheService.TTL_SECONDS +
      Math.floor(
        Math.random() *
          (AuthorizationSnapshotCacheService.TTL_JITTER_SECONDS + 1),
      )
    );
  }
}
