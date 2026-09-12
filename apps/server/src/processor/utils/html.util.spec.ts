import { isRichTextEmpty, sanitizeRichText } from "./html.util";

describe("sanitizeRichText", () => {
  it("保留编辑器常用的排版标签与样式", () => {
    const html =
      '<p style="text-align:center;"><strong>标题</strong></p><ul><li><span style="color:#ff0000;">红色</span></li></ul>';
    const result = sanitizeRichText(html);
    expect(result).toContain("text-align:center");
    expect(result).toContain("<strong>标题</strong>");
    expect(result).toContain("color:#ff0000");
  });

  it("移除脚本标签及其内容", () => {
    expect(sanitizeRichText("<p>hi</p><script>alert(1)</script>")).toBe(
      "<p>hi</p>",
    );
  });

  it("移除事件属性", () => {
    expect(
      sanitizeRichText('<img src="https://a.com/a.png" onerror="alert(1)">'),
    ).not.toContain("onerror");
  });

  it("拦截危险协议与内联框架", () => {
    expect(
      sanitizeRichText('<a href="javascript:alert(1)">点我</a>'),
    ).not.toContain("javascript:");
    expect(sanitizeRichText('<iframe src="https://evil.com"></iframe>')).toBe(
      "",
    );
  });

  it("保留 base64 图片，编辑器默认以 data URI 插入图片", () => {
    const html = '<img src="data:image/png;base64,iVBORw0KGgo=">';
    expect(sanitizeRichText(html)).toContain("data:image/png;base64");
  });

  it("纯文本告警内容不会被破坏", () => {
    expect(sanitizeRichText("CPU 使用率 > 90%")).toContain("90%");
  });
});

describe("isRichTextEmpty", () => {
  it("识别只有空段落的内容", () => {
    expect(isRichTextEmpty("<p><br></p>")).toBe(true);
    expect(isRichTextEmpty("<p>&nbsp;</p>")).toBe(true);
  });

  it("图片等非文本内容视为非空", () => {
    expect(isRichTextEmpty('<p><img src="https://a.com/a.png"></p>')).toBe(
      false,
    );
    expect(isRichTextEmpty("<p>内容</p>")).toBe(false);
  });
});
