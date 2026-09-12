import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import type { FileCleanupJob } from "./file-cleanup.types.js";

export const DISK_CLEANUP_EVENTS = {
  UNLINKED: "disk.unlinked",
} as const;

@Injectable()
export class DiskCleanupEventBus {
  private readonly emitter = new EventEmitter();

  onUnlinked(handler: (job: FileCleanupJob) => unknown): void {
    this.emitter.on(DISK_CLEANUP_EVENTS.UNLINKED, handler);
  }

  async emitUnlinked(job: FileCleanupJob): Promise<unknown[]> {
    const listeners = this.emitter.listeners(
      DISK_CLEANUP_EVENTS.UNLINKED,
    ) as Array<(job: FileCleanupJob) => unknown>;
    if (!listeners.length) return [];
    return Promise.all(
      listeners.map((listener) => Promise.resolve(listener(job))),
    );
  }
}
