import { ResOp, wrapSuccess } from "./response.model";
import {
  RESPONSE_SUCCESS_CODE,
  RESPONSE_SUCCESS_MSG,
} from "#/processor/constants";

describe("wrapSuccess", () => {
  it("wraps primitives, arrays and null as data", () => {
    expect(wrapSuccess(1).data).toBe(1);
    expect(wrapSuccess(["a"]).data).toEqual(["a"]);
    expect(wrapSuccess(null).data).toBeNull();
    expect(wrapSuccess(1).code).toBe(RESPONSE_SUCCESS_CODE);
    expect(wrapSuccess(1).message).toBe(RESPONSE_SUCCESS_MSG);
  });

  it("lifts handler message and keeps the rest as data", () => {
    const res = wrapSuccess({ list: [1], total: 2, message: "查询成功" });
    expect(res).toMatchObject({
      code: 200,
      message: "查询成功",
      data: { list: [1], total: 2 },
    });
  });

  it("strips handler status code so { code: 200, id } does not nest into data", () => {
    const res = wrapSuccess({ code: 200, message: "新增用户成功", id: "u1" });
    expect(res.message).toBe("新增用户成功");
    expect(res.data).toEqual({ id: "u1" });
    expect(res.data).not.toHaveProperty("code");
  });

  it("unwraps { message, data } so callers are not nested twice", () => {
    const res = wrapSuccess({ message: "添加部门成功", data: { id: "d1" } });
    expect(res.data).toEqual({ id: "d1" });
    expect(res.message).toBe("添加部门成功");
  });

  it("uses default message when handler omits it", () => {
    const res = wrapSuccess({ list: [], total: 0 });
    expect(res.message).toBe(RESPONSE_SUCCESS_MSG);
    expect(res.data).toEqual({ list: [], total: 0 });
  });

  it("returns message-only payload as data null", () => {
    const res = wrapSuccess({ message: "演示模式" });
    expect(res.message).toBe("演示模式");
    expect(res.data).toBeNull();
  });

  it("does not treat handler { code: 400 } as HTTP failure", () => {
    const res = wrapSuccess({ code: 400, message: "文件不存在" });
    expect(res.code).toBe(200);
    expect(res.message).toBe("文件不存在");
    expect(res.data).toBeNull();
  });

  it("passes through an existing ResOp", () => {
    const original = ResOp.success({ id: 1 }, "已包装");
    expect(wrapSuccess(original)).toBe(original);
  });

  it("includes a timestamp string", () => {
    expect(typeof wrapSuccess({ id: 1 }).timestamp).toBe("string");
    expect(wrapSuccess({ id: 1 }).timestamp.length).toBeGreaterThan(0);
  });
});

describe("ResOp.error", () => {
  it("builds a failure envelope with null data", () => {
    expect(ResOp.error(403, "无权限")).toMatchObject({
      code: 403,
      message: "无权限",
      data: null,
    });
  });
});
