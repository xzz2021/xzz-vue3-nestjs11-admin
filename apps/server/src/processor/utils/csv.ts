export function escapeCsvCell(value: unknown): string {
  let text =
    value == null
      ? ""
      : typeof value === "string"
        ? value
        : typeof value === "number" ||
            typeof value === "boolean" ||
            typeof value === "bigint"
          ? `${value}`
          : value instanceof Date
            ? value.toISOString()
            : (JSON.stringify(value) ?? "");
  const firstSignificant = [...text].find((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const controlCharacter =
      codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    return !/\s/u.test(character) && !controlCharacter;
  });
  if (
    text.startsWith("\t") ||
    (firstSignificant !== undefined && "=+-@".includes(firstSignificant))
  ) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsvRow(values: unknown[]): string {
  return `${values.map(escapeCsvCell).join(",")}\r\n`;
}

export function csvHeaderLine(columns: string[]): string {
  return serializeCsvRow(columns);
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char === "\r") continue;
    field += char;
  }

  if (inQuotes) {
    throw new Error("CSV 引号未闭合");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

export function recordsFromCsv(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header || header.length === 0) {
    throw new Error("CSV 缺少表头");
  }
  return rows.slice(1).map((row, index) => {
    if (row.length !== header.length) {
      throw new Error(`第 ${index + 2} 行列数与表头不一致`);
    }
    const record: Record<string, string> = {};
    header.forEach((key, column) => {
      record[key.trim()] = row[column] ?? "";
    });
    return record;
  });
}
