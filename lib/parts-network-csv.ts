/** CSV snapshots only. No inventory movements are recorded here. */
export type PartRow = {
  partNumber: string;
  quantity: number;
  price: number | null;
  brand?: string;
  description?: string;
};
export type PartColumns = {
  partNumber: number;
  quantity: number;
  price: number;
  brand?: number;
  description?: number;
};
export type PartImportOptions = {
  hasHeader?: boolean;
  stripPrefix?: string;
  defaultBrand?: string;
};
export const MAX_PARTS_CSV_BYTES = 2_000_000;
export function readPartsCsv(source: string): string[][] {
  if (new TextEncoder().encode(source).length > MAX_PARTS_CSV_BYTES)
    throw new Error("Use a table smaller than 2 MB.");
  const text = source.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = [";", "\t", ","].sort(
    (a, b) => first.split(b).length - first.split(a).length,
  )[0];
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(value.trim());
    value = "";
    closed = false;
  };
  const line = () => {
    field();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += ch;
    } else if (ch === delimiter) field();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      line();
    } else if (ch === '"' && !value && !closed) quoted = true;
    else {
      if ((closed && ch.trim()) || ch === '"')
        throw new Error("Invalid CSV quoting. Export the file again.");
      value += ch;
    }
    if (rows.length > 20001)
      throw new Error("Use at most 20,000 parts per upload.");
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted field.");
  if (value || row.length) line();
  if (!rows.length)
    throw new Error(
      "The table needs at least one part. Your existing list has not changed.",
    );
  return rows;
}
export function guessPartColumns(headers: string[]): PartColumns {
  const find = (terms: RegExp) =>
    headers.findIndex((h) => terms.test(h.trim()));
  return {
    partNumber: find(
      /^(part\s*(number|no\.?|code)|stock\s*code|item\s*code|code)$/i,
    ),
    quantity: find(/^(qty|quantity|on\s*hand|stock\s*quantity)$/i),
    price: find(/^(price|unit\s*price|selling\s*price)$/i),
    brand: find(/^(brand|make|manufacturer)$/i),
    description: find(/^(description|part\s*description|item\s*description)$/i),
  };
}
function number(value: string, line: number, name: string): number {
  // A single decimal comma is accepted; mixed separators must be unambiguous.
  let clean = value.replace(/^R\s*/i, "").replace(/\s/g, "");
  if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(clean))
    clean = clean.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(clean)) clean = clean.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean))
    throw new Error(
      `Row ${line}: enter a valid ${name} (no ambiguous thousands separators).`,
    );
  const result = Number(clean);
  if (!Number.isFinite(result) || result > 999999999)
    throw new Error(`Row ${line}: ${name} is too large.`);
  return result;
}
export function partsTableCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row.map((cell) => '"' + cell.replace(/"/g, '""') + '"').join(","),
    )
    .join("\n");
}
export function parsePartsSnapshot(
  csv: string,
  columns: PartColumns,
  options: PartImportOptions = {},
): PartRow[] {
  if (!columns || typeof columns !== "object")
    throw new Error("Choose the table columns.");
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw new Error("Choose the import options.");
  if (options.hasHeader !== undefined && typeof options.hasHeader !== "boolean")
    throw new Error("Choose whether the first row contains headings.");
  const rows = readPartsCsv(csv);
  const required = [columns.partNumber, columns.quantity];
  const optional = [
    columns.price,
    columns.brand ?? -1,
    columns.description ?? -1,
  ];
  const indexes = [...required, ...optional.filter((i) => i !== -1)];
  if (
    required.some((i) => i < 0) ||
    optional.some((i) => !Number.isInteger(i) || i < -1) ||
    new Set(indexes).size !== indexes.length ||
    indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= rows[0].length)
  )
    throw new Error(
      "Choose different columns for each field. Part number and quantity are required.",
    );
  const prefix = options.stripPrefix ?? "";
  const brand = options.defaultBrand ?? "";
  if (
    typeof prefix !== "string" ||
    prefix.length > 30 ||
    /[\x00-\x1f]/.test(prefix)
  )
    throw new Error("Enter a prefix of at most 30 characters.");
  if (
    typeof brand !== "string" ||
    brand.length > 100 ||
    /[\x00-\x1f]/.test(brand)
  )
    throw new Error("Enter a brand of at most 100 characters.");
  const start = options.hasHeader === false ? 0 : 1;
  const data = rows.slice(start);
  if (!data.length || data.length > 20000)
    throw new Error("Include between 1 and 20,000 parts.");
  const seen = new Set<string>();
  return data.map((row, i) => {
    const line = i + start + 1;
    if (row.length !== rows[0].length)
      throw new Error(
        `Row ${line}: the number of columns does not match the table.`,
      );
    let partNumber = row[columns.partNumber];
    if (prefix && partNumber.startsWith(prefix))
      partNumber = partNumber.slice(prefix.length);
    if (
      !partNumber ||
      partNumber.length > 100 ||
      /[\x00-\x1f]/.test(partNumber)
    )
      throw new Error(`Row ${line}: enter a valid part number.`);
    const key = partNumber.toUpperCase();
    if (seen.has(key))
      throw new Error(
        `Row ${line}: duplicate part number ${partNumber}. Combine it in your master list first.`,
      );
    seen.add(key);
    const quantity = number(row[columns.quantity], line, "quantity");
    if (!Number.isInteger(quantity))
      throw new Error(`Row ${line}: quantity must be a whole number.`);
    const optionalText = (
      index: number | undefined,
      name: string,
      max: number,
      fallback = "",
    ) => {
      const value =
        index === undefined || index < 0
          ? fallback.trim()
          : row[index].trim() || fallback.trim();
      if (value.length > max || /[\x00-\x1f]/.test(value))
        throw new Error(
          `Row ${line}: ${name} must be at most ${max} characters on one line.`,
        );
      return value;
    };
    const rowBrand = optionalText(columns.brand, "brand", 100, brand);
    const description = optionalText(columns.description, "description", 500);
    return {
      partNumber,
      quantity,
      price:
        columns.price < 0 || !row[columns.price].trim()
          ? null
          : number(row[columns.price], line, "unit price"),
      ...(rowBrand ? { brand: rowBrand } : {}),
      ...(description ? { description } : {}),
    };
  });
}
export function snapshotChanges(previous: PartRow[], next: PartRow[]) {
  const old = new Map(previous.map((p) => [p.partNumber.toUpperCase(), p]));
  let added = 0,
    updated = 0;
  for (const row of next) {
    const before = old.get(row.partNumber.toUpperCase());
    if (!before) added++;
    else if (
      before.price !== row.price ||
      before.quantity !== row.quantity ||
      (before.brand || "") !== (row.brand || "") ||
      (before.description || "") !== (row.description || "")
    )
      updated++;
    old.delete(row.partNumber.toUpperCase());
  }
  return { added, updated, removed: old.size, total: next.length };
}
