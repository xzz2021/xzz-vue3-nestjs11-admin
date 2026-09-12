import { Injectable } from "@nestjs/common";
import { MONITOR_LATENCY_SAMPLES } from "./monitor.constants.js";

/**
 * 进程内环状缓冲，记录近期 HTTP 请求耗时，供监控快照取平均延迟。
 */
@Injectable()
export class MonitorLatencyTracker {
  private readonly samples: number[] = [];
  private index = 0;
  private filled = 0;

  record(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    if (this.samples.length < MONITOR_LATENCY_SAMPLES) {
      this.samples.push(durationMs);
      this.filled = this.samples.length;
      this.index = this.filled % MONITOR_LATENCY_SAMPLES;
      return;
    }
    this.samples[this.index] = durationMs;
    this.index = (this.index + 1) % MONITOR_LATENCY_SAMPLES;
    this.filled = MONITOR_LATENCY_SAMPLES;
  }

  getAverage(): { avgLatencyMs: number; sampleCount: number } {
    if (this.filled === 0) {
      return { avgLatencyMs: 0, sampleCount: 0 };
    }
    const sum = this.samples.slice(0, this.filled).reduce((a, b) => a + b, 0);
    return {
      avgLatencyMs: Math.round((sum / this.filled) * 10) / 10,
      sampleCount: this.filled,
    };
  }
}
