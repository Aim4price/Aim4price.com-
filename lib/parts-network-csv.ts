/** CSV snapshots only. No inventory movements are recorded here. */
export type PartRow = { partNumber: string; quantity: number; price: number };
export type PartColumns = {
  partNumber: number;
  quantity: number;
  price: number;
};
export const MAX_PARTS_CSV_BYTES = 2_000_000;
export function readPartsCsv(source: string): string[][] {
  if (new TextEncoder().encode(source).length > MAX_PARTS_CSV_BYTES)
    throw new Error("Use a CSV smaller than 2 MB.");
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
  if (rows.length < 2)
    throw new Error(
      "The CSV needs headings and at least one part. Your existing list has not changed.",
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
export function parsePartsSnapshot(
  csv: string,
  columns: PartColumns,
): PartRow[] {
  if (!columns || typeof columns !== "object")
    throw new Error("Choose the CSV columns.");
  const rows = readPartsCsv(csv),
    indexes = [columns.partNumber, columns.quantity, columns.price];
  if (
    new Set(indexes).size !== 3 ||
    indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= rows[0].length)
  )
    throw new Error(
      "Choose three different columns for part number, quantity and unit price.",
    );
  const seen = new Set<string>();
  return rows.slice(1).map((row, i) => {
    if (row.length !== rows[0].length)
      throw new Error(
        `Row ${i + 2}: the number of columns does not match the headings.`,
      );
    const partNumber = row[columns.partNumber];
    if (
      !partNumber ||
      partNumber.length > 100 ||
      /[\x00-\x1f]/.test(partNumber)
    )
      throw new Error(`Row ${i + 2}: enter a valid part number.`);
    const key = partNumber.toUpperCase();
    if (seen.has(key))
      throw new Error(
        `Row ${i + 2}: duplicate part number ${partNumber}. Combine it in your master list first.`,
      );
    seen.add(key);
    const quantity = number(row[columns.quantity], i + 2, "quantity");
    if (!Number.isInteger(quantity))
      throw new Error(`Row ${i + 2}: quantity must be a whole number.`);
    return {
      partNumber,
      quantity,
      price: number(row[columns.price], i + 2, "unit price"),
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
    else if (before.price !== row.price || before.quantity !== row.quantity)
      updated++;
    old.delete(row.partNumber.toUpperCase());
  }
  return { added, updated, removed: old.size, total: next.length };
}
