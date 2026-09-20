export function parseCorsOrigins(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function httpCorsOptions(origins: string[]) {
  return {
    origin: origins,
    credentials: true,
    vary: ["origin"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  };
}

export function wsCorsOptions(raw = process.env.CORS_ORIGINS) {
  const origins = parseCorsOrigins(raw);
  return {
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  };
}
