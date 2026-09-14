<script setup lang="ts">
import { buildMonitorWsUrl, getMonitorSnapshotApi } from '@/api/monitor'
import type { MetricPoint, MonitorErrorItem, MonitorPayload, MonitorSnapshot } from '@/api/monitor/types'
import { ContentWrap } from '@/components/ContentWrap'
import { Echart } from '@/components/Echart'
import { useI18n } from '@/hooks/web/useI18n'
import { useUserStore } from '@/store/modules/user'
import dayjs from 'dayjs'
import type { EChartsOption } from 'echarts'
import { ElCard, ElCol, ElEmpty, ElRow, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { set } from 'lodash-es'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const { t } = useI18n()
const userStore = useUserStore()

const POLL_MS = 15000
const connected = ref(false)
const lastUpdated = ref('')
const snapshot = ref<MonitorSnapshot | null>(null)
const metrics = ref<MetricPoint[]>([])
const errors = ref<MonitorErrorItem[]>([])

let ws: WebSocket | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let disposed = false

const formatBytes = (bytes?: number) => {
  if (bytes == null || !Number.isFinite(bytes)) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

const formatDuration = (seconds?: number) => {
  if (seconds == null) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const statusType = (status?: string) => (status === 'up' ? 'success' : 'danger')

const applyPayload = (payload: MonitorPayload) => {
  snapshot.value = payload.snapshot
  metrics.value = payload.metrics ?? []
  errors.value = payload.errors ?? []
  lastUpdated.value = dayjs(payload.snapshot.timestamp).format('HH:mm:ss')
  updateCharts()
}

const cpuOptions = reactive<EChartsOption>({
  title: { text: t('monitor.cpuTrend'), left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 20, top: 50, bottom: 30, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: [] },
  yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  series: [
    {
      name: 'CPU',
      type: 'line',
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.12 },
      data: []
    }
  ]
}) as EChartsOption

const memOptions = reactive<EChartsOption>({
  title: { text: t('monitor.memoryUsage'), left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['42%', '68%'],
      avoidLabelOverlap: true,
      label: { formatter: '{b}\n{d}%' },
      data: []
    }
  ]
}) as EChartsOption

const latencyOptions = reactive<EChartsOption>({
  title: { text: t('monitor.apiLatency'), left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 20, top: 50, bottom: 30, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: [] },
  yAxis: { type: 'value', axisLabel: { formatter: '{value} ms' } },
  series: [
    {
      name: 'Latency',
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: []
    }
  ]
}) as EChartsOption

const updateCharts = () => {
  const points = metrics.value
  const times = points.map((p) => dayjs(p.t).format('HH:mm:ss'))
  set(cpuOptions, 'xAxis.data', times)
  set(
    cpuOptions,
    'series[0].data',
    points.map((p) => p.cpu)
  )
  set(latencyOptions, 'xAxis.data', times)
  set(
    latencyOptions,
    'series[0].data',
    points.map((p) => p.latency)
  )

  const mem = snapshot.value?.memory
  if (mem) {
    set(memOptions, 'series[0].data', [
      { name: t('monitor.used'), value: Math.round(mem.used / (1024 * 1024)) },
      { name: t('monitor.free'), value: Math.round(mem.free / (1024 * 1024)) }
    ])
  }
}

const cards = computed(() => {
  const s = snapshot.value
  return [
    {
      title: t('monitor.appStatus'),
      status: s?.app.status,
      lines: [
        `PID ${s?.app.pid ?? '-'}`,
        `Node ${s?.app.nodeVersion ?? '-'}`,
        `${t('monitor.uptime')} ${formatDuration(s?.app.uptime)}`
      ]
    },
    {
      title: 'PostgreSQL',
      status: s?.postgres.status,
      lines: [`${t('monitor.latency')} ${s?.postgres.latencyMs ?? '-'} ms`, s?.postgres.message || t('monitor.healthy')]
    },
    {
      title: 'Redis',
      status: s?.redis.status,
      lines: [`${t('monitor.latency')} ${s?.redis.latencyMs ?? '-'} ms`, s?.redis.message || t('monitor.healthy')]
    },
    {
      title: t('monitor.serverInfo'),
      status: 'up',
      lines: [
        s?.server.hostname ?? '-',
        `${s?.server.platform ?? '-'} / ${s?.server.arch ?? '-'}`,
        `CPU ${s?.cpu.usage ?? 0}% · ${t('monitor.load')} ${s?.cpu.load1 ?? '-'}`
      ]
    }
  ]
})

const stopPoll = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const closeWs = () => {
  stopPoll()
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    try {
      ws.close()
    } catch {
      // ignore
    }
    ws = null
  }
  connected.value = false
}

const sendPoll = () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ event: 'poll', data: {} }))
}

const scheduleReconnect = () => {
  if (disposed || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectWs()
  }, 3000)
}

const connectWs = () => {
  const token = userStore.getToken
  if (!token || disposed) return
  closeWs()

  try {
    ws = new WebSocket(buildMonitorWsUrl(token))
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    connected.value = true
    sendPoll()
    pollTimer = setInterval(sendPoll, POLL_MS)
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as { event?: string; data?: MonitorPayload }
      if (msg.event === 'metrics' && msg.data?.snapshot) {
        applyPayload(msg.data)
      }
    } catch {
      // ignore malformed
    }
  }

  ws.onerror = () => {
    connected.value = false
  }

  ws.onclose = () => {
    connected.value = false
    stopPoll()
    scheduleReconnect()
  }
}

const fetchFallback = async () => {
  try {
    const res = await getMonitorSnapshotApi()
    if (res?.data?.snapshot) {
      applyPayload(res.data)
    }
  } catch {
    // WS 会继续重试
  }
}

onMounted(async () => {
  await fetchFallback()
  connectWs()
})

onBeforeUnmount(() => {
  disposed = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  closeWs()
})
</script>

<template>
  <ContentWrap :title="t('router.server')">
    <div class="mb-12px flex items-center justify-between flex-wrap gap-8px">
      <div class="text-14px text-[var(--el-text-color-secondary)]">
        {{ t('monitor.refreshHint') }}
      </div>
      <div class="flex items-center gap-12px text-13px">
        <ElTag :type="connected ? 'success' : 'info'" effect="plain" size="small">
          {{ connected ? t('monitor.wsConnected') : t('monitor.wsDisconnected') }}
        </ElTag>
        <span v-if="lastUpdated">{{ t('monitor.updatedAt') }} {{ lastUpdated }}</span>
      </div>
    </div>

    <ElRow :gutter="12" class="mb-12px">
      <ElCol v-for="card in cards" :key="card.title" :xs="24" :sm="12" :lg="6" class="mb-12px">
        <ElCard shadow="hover" class="h-full">
          <div class="flex items-center justify-between mb-8px">
            <span class="font-600">{{ card.title }}</span>
            <ElTag :type="statusType(card.status)" size="small">
              {{ card.status === 'up' ? 'UP' : 'DOWN' }}
            </ElTag>
          </div>
          <div
            v-for="(line, idx) in card.lines"
            :key="idx"
            class="text-13px text-[var(--el-text-color-secondary)] leading-22px truncate"
            :title="line"
          >
            {{ line }}
          </div>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="12" class="mb-12px">
      <ElCol :xs="24" :lg="8" class="mb-12px">
        <ElCard shadow="never">
          <Echart :options="cpuOptions" height="280px" />
        </ElCard>
      </ElCol>
      <ElCol :xs="24" :lg="8" class="mb-12px">
        <ElCard shadow="never">
          <Echart :options="memOptions" height="280px" />
        </ElCard>
      </ElCol>
      <ElCol :xs="24" :lg="8" class="mb-12px">
        <ElCard shadow="never">
          <Echart :options="latencyOptions" height="280px" />
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="12" class="mb-12px">
      <ElCol :xs="24" :md="12" class="mb-12px">
        <ElCard :header="t('monitor.resource')" shadow="never">
          <div class="text-13px leading-28px">
            <div
              >{{ t('monitor.memory') }}：{{ formatBytes(snapshot?.memory.used) }} /
              {{ formatBytes(snapshot?.memory.total) }} ({{ snapshot?.memory.usage ?? 0 }}%)</div
            >
            <div v-if="snapshot?.disk">
              {{ t('monitor.disk') }}（{{ snapshot.disk.mount }}）：{{ formatBytes(snapshot.disk.used) }} /
              {{ formatBytes(snapshot.disk.total) }} ({{ snapshot.disk.usage }}%)
            </div>
            <div
              >{{ t('monitor.apiAvg') }}：{{ snapshot?.api.avgLatencyMs ?? 0 }} ms（n={{
                snapshot?.api.sampleCount ?? 0
              }}）</div
            >
            <div
              >{{ t('monitor.cpuModel') }}：{{ snapshot?.server.cpuModel || '-' }} ×
              {{ snapshot?.server.cpuCount || '-' }}</div
            >
          </div>
        </ElCard>
      </ElCol>
      <ElCol :xs="24" :md="12" class="mb-12px">
        <ElCard :header="t('monitor.errorLog')" shadow="never">
          <ElTable v-if="errors.length" :data="errors" size="small" max-height="220" stripe>
            <ElTableColumn prop="t" :label="t('monitor.time')" width="90">
              <template #default="{ row }">
                {{ dayjs(row.t).format('HH:mm:ss') }}
              </template>
            </ElTableColumn>
            <ElTableColumn prop="status" label="Status" width="70" />
            <ElTableColumn prop="method" label="Method" width="80" />
            <ElTableColumn prop="path" :label="t('monitor.path')" min-width="120" show-overflow-tooltip />
            <ElTableColumn prop="message" :label="t('monitor.message')" min-width="140" show-overflow-tooltip />
          </ElTable>
          <ElEmpty v-else :description="t('monitor.noError')" :image-size="64" />
        </ElCard>
      </ElCol>
    </ElRow>
  </ContentWrap>
</template>
