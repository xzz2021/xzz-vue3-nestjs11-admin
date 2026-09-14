export type ServiceStatus = 'up' | 'down'

export interface MetricPoint {
  t: number
  cpu: number
  mem: number
  memUsed: number
  memTotal: number
  latency: number
  load: number
}

export interface HealthProbe {
  status: ServiceStatus
  latencyMs: number
  message?: string
}

export interface MonitorSnapshot {
  timestamp: number
  uptime: number
  app: {
    status: ServiceStatus
    pid: number
    nodeVersion: string
    uptime: number
  }
  server: {
    hostname: string
    platform: string
    arch: string
    cpuCount: number
    cpuModel: string
  }
  cpu: {
    usage: number
    load1: number
    load5: number
    load15: number
  }
  memory: {
    total: number
    used: number
    free: number
    usage: number
  }
  disk: {
    total: number
    used: number
    free: number
    usage: number
    mount: string
  } | null
  postgres: HealthProbe
  redis: HealthProbe
  api: {
    avgLatencyMs: number
    sampleCount: number
  }
}

export interface MonitorErrorItem {
  t: number
  status: number
  method: string
  path: string
  message: string
}

export interface MonitorPayload {
  snapshot: MonitorSnapshot
  metrics: MetricPoint[]
  errors: MonitorErrorItem[]
}
