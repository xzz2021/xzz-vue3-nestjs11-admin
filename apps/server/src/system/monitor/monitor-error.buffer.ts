import { Injectable } from "@nestjs/common";
import type { MonitorErrorItem } from "./monitor.types.js";
import { MONITOR_ERRORS_MAX } from "./monitor.constants.js";

/**
 * 内存环缓冲 + Redis 持久化由 MonitorService 负责同步。
 * 异常过滤器可直接调用 push，避免耦合采集逻辑。
 */
@Injectable()
export class MonitorErrorBuffer {
  private readonly items: MonitorErrorItem[] = [];

  push(item: Omit<MonitorErrorItem, "t"> & { t?: number }): MonitorErrorItem {
    const entry: MonitorErrorItem = {
      t: item.t ?? Date.now(),
      status: item.status,
      method: item.method.slice(0, 10),
      path: item.path.slice(0, 255),
      message: item.message.slice(0, 500),
    };
    this.items.unshift(entry);
    if (this.items.length > MONITOR_ERRORS_MAX) {
      this.items.length = MONITOR_ERRORS_MAX;
    }
    return entry;
  }

  list(): MonitorErrorItem[] {
    return [...this.items];
  }

  replace(items: MonitorErrorItem[]): void {
    this.items.length = 0;
    this.items.push(...items.slice(0, MONITOR_ERRORS_MAX));
  }
}
