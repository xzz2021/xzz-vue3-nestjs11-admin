import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MonitorLatencyTracker } from "./monitor-latency.tracker.js";

const SKIP_PATHS = [
  "/monitor",
  "/health",
  "/sse",
  "/auth/refresh",
  "/online",
  "/message",
];

@Injectable()
export class MonitorLatencyInterceptor implements NestInterceptor {
  constructor(private readonly latencyTracker: MonitorLatencyTracker) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const path = (request.url ?? "").split("?")[0];
    if (SKIP_PATHS.some((item) => path.includes(item))) {
      return next.handle();
    }

    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.latencyTracker.record(Date.now() - start),
        error: () => this.latencyTracker.record(Date.now() - start),
      }),
    );
  }
}
