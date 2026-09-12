import { formatConnectFailure } from "./connect-error.js";

describe("formatConnectFailure", () => {
  it("summarizes ECONNREFUSED without a stack", () => {
    const error = Object.assign(new AggregateError([]), {
      code: "ECONNREFUSED",
      errors: [
        Object.assign(new Error("connect ECONNREFUSED ::1:6379"), {
          code: "ECONNREFUSED",
        }),
      ],
    });

    expect(formatConnectFailure("Redis", "127.0.0.1:6379", error)).toBe(
      "Redis 未启动，无法连接 127.0.0.1:6379",
    );
  });

  it("summarizes postgres unreachable errors", () => {
    expect(
      formatConnectFailure(
        "PostgreSQL",
        "127.0.0.1:5432",
        new Error("Can't reach database server at `127.0.0.1:5432`"),
      ),
    ).toBe("PostgreSQL 未就绪，无法连接 127.0.0.1:5432");
  });
});
