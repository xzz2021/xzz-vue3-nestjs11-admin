import {
  csvHeaderLine,
  escapeCsvCell,
  parseCsv,
  recordsFromCsv,
  serializeCsvRow,
} from "./csv.js";

describe("CSV cell escaping", () => {
  it.each([
    ["a,b", '"a,b"'],
    ['a"b', '"a""b"'],
    ["a\nb", '"a\nb"'],
    ["=SUM(1,2)", '"\'=SUM(1,2)"'],
    ["+1", "'+1"],
    ["-1", "'-1"],
    ["@cmd", "'@cmd"],
    ["\tcmd", "'\tcmd"],
    ["  =SUM(1,2)", '"\'  =SUM(1,2)"'],
    ["\r\n+cmd", '"\'\r\n+cmd"'],
    ["\u0000\u001f-cmd", "'\u0000\u001f-cmd"],
    ["\u007f=cmd", "'\u007f=cmd"],
    [" \t@cmd", "' \t@cmd"],
  ])("escapes %p as %p", (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });
});

describe("CSV serialize / parse", () => {
  it("serializes a header and round-trips quoted fields", () => {
    const header = csvHeaderLine(["username", "phone", "roleCodes"]);
    const row = serializeCsvRow(["admin", "13800138000", "admin;user"]);
    const text = `${header}${row}`;
    expect(parseCsv(text)).toEqual([
      ["username", "phone", "roleCodes"],
      ["admin", "13800138000", "admin;user"],
    ]);
  });

  it("parses quoted commas, escaped quotes and CRLF rows", () => {
    const text = 'name,note\r\n"a,b","say ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ["a,b", 'say "hi"'],
    ]);
  });

  it("strips BOM and maps rows to records by header", () => {
    const text = "\uFEFFusername,phone\nadmin,13800138000\n";
    expect(recordsFromCsv(text)).toEqual([
      { username: "admin", phone: "13800138000" },
    ]);
  });

  it("rejects a row whose column count does not match the header", () => {
    expect(() => recordsFromCsv("a,b\n1\n")).toThrow(/列数/);
  });
});
