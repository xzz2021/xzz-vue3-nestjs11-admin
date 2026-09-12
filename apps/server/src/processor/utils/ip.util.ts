import type { IncomingMessage } from 'node:http';
import { createRequire } from 'node:module';
import type { Request } from 'express';
import { extractIP } from './string.js';

const UNKNOWN_LOCATION = '未知';
const LAN_LOCATION = '内网IP';
const MAX_LOCATION_LENGTH = 100;

type IpSearcher = {
  search(ip: string): Promise<{ region?: string | null }>;
};

type Ip2regionModule = {
  defaultDbFile: string;
  loadContentFromFile: (dbPath: string) => Buffer;
  newWithBuffer: (buffer: Buffer) => IpSearcher;
};

const requireIp2region = createRequire(import.meta.url);

let searcher: IpSearcher | null = null;

function isLan(ip: string) {
  const value = extractIP(ip).toLowerCase();
  if (value === 'localhost' || value === '::1' || value.startsWith('fe80:'))
    return true;
  if (/^f[cd][0-9a-f]{0,2}:/i.test(value)) return true;
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  const a = Number.parseInt(parts[0] ?? '', 10);
  const b = Number.parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

function firstHop(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '';
  return raw.split(',')[0]?.trim() ?? '';
}

function getSearcher(): IpSearcher {
  if (!searcher) {
    const mod = requireIp2region('ip2region-ts') as Ip2regionModule;
    searcher = mod.newWithBuffer(mod.loadContentFromFile(mod.defaultDbFile));
  }
  return searcher;
}

export function formatIpRegion(region?: string | null): string {
  if (!region) return '';
  const [country, , province, city] = region.split('|');
  return [country, province, city]
    .filter((part) => part && part !== '0')
    .join(' ')
    .slice(0, MAX_LOCATION_LENGTH);
}

export async function lookupIpLocation(ip?: string | null): Promise<string> {
  const normalized = extractIP(ip ?? '').trim();
  if (!normalized || normalized === '-') return UNKNOWN_LOCATION;
  if (isLan(normalized)) return LAN_LOCATION;
  try {
    const data = await getSearcher().search(normalized);
    return formatIpRegion(data?.region) || UNKNOWN_LOCATION;
  } catch {
    return UNKNOWN_LOCATION;
  }
}

export function getIp(request: Request | IncomingMessage) {
  const req = request as Request & {
    raw?: {
      connection?: { remoteAddress?: string };
      socket?: { remoteAddress?: string };
    };
  };

  // Express + trust proxy 已按受信任跳解析；不要再读客户端伪造的 XFF。
  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return firstHop(req.ip);
  }

  const socketIp =
    request.socket?.remoteAddress ||
    req.raw?.connection?.remoteAddress ||
    req.raw?.socket?.remoteAddress ||
    '';

  const headerIp = firstHop(
    request.headers['x-real-ip'] ?? request.headers['x-forwarded-for'],
  );
  if (headerIp && isLan(socketIp)) return headerIp;

  return socketIp;
}
