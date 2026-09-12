import { DANGEROUS_FILENAME_RE } from "./filename";

describe("DANGEROUS_FILENAME_RE", () => {
  it("blocks dangerous extensions including double extensions", () => {
    expect(DANGEROUS_FILENAME_RE.test("payload.exe")).toBe(true);
    expect(DANGEROUS_FILENAME_RE.test("shell.php.jpg")).toBe(true);
    expect(DANGEROUS_FILENAME_RE.test("run.HTML")).toBe(true);
    expect(DANGEROUS_FILENAME_RE.test("app.mjs")).toBe(true);
  });

  it("allows ordinary documents", () => {
    expect(DANGEROUS_FILENAME_RE.test("report.docx")).toBe(false);
    expect(DANGEROUS_FILENAME_RE.test("photo.png")).toBe(false);
    expect(DANGEROUS_FILENAME_RE.test("archive.zip")).toBe(false);
  });
});
