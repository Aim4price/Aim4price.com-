import {
  parsePartsSnapshot,
  partsTableCsv,
  readPartsCsv,
  type PartColumns,
} from "./parts-network-csv";
export const PART_FIELDS = [
  "partNumber",
  "description",
  "quantity",
  "price",
  "brand",
] as const;
export const PART_LABELS = [
  "Part number",
  "Description",
  "Quantity",
  "Unit price",
  "Brand",
];
export const EDITOR_COLUMNS: PartColumns = {
  partNumber: 0,
  description: 1,
  quantity: 2,
  price: 3,
  brand: 4,
};
export const blankPart = () => ["", "", "", "", ""];
export function pastePartsCells(
  rows: string[][],
  text: string,
  row: number,
  column: number,
) {
  // Spreadsheet clipboard data is TSV. Never interpret a comma in a part code as a separator.
  const cells = readPartsCsv(text, {
    delimiter: "\t",
    preserveEmptyRows: true,
  });
  if (row + cells.length > 20000) throw new Error("Use at most 20,000 parts.");
  if (cells.some((c) => column + c.length > PART_FIELDS.length))
    throw new Error(
      "These cells extend beyond Brand. Paste into the first column or import a file to match columns.",
    );
  const next = rows.map((r) => [...r]);
  while (next.length < row + cells.length) next.push(blankPart());
  cells.forEach((r, i) =>
    r.forEach((value, j) => {
      next[row + i][column + j] = value;
    }),
  );
  return next;
}
export function partCellErrors(rows: string[][]) {
  const errors: Record<number, Record<number, string>> = {};
  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    if (row.every((v) => !v.trim())) return;
    row.forEach((value, col) => {
      const candidate = ["VALID", "", "1", "", ""];
      candidate[col] = value;
      try {
        parsePartsSnapshot(partsTableCsv([candidate]), EDITOR_COLUMNS, {
          hasHeader: false,
        });
      } catch (e) {
        (errors[i] ||= {})[col] = (e as Error).message.replace(/^Row 1: /, "");
      }
    });
    const key = row[0].trim().toUpperCase();
    if (key && seen.has(key)) {
      const message = `Duplicate part number ${row[0]}. Edit or remove a duplicate row.`;
      (errors[i] ||= {})[0] = message;
      (errors[seen.get(key)!] ||= {})[0] = message;
    } else if (key) seen.set(key, i);
  });
  return errors;
}
export function partRowErrors(rows: string[][]) {
  return Object.fromEntries(
    Object.entries(partCellErrors(rows)).map(([i, cells]) => [
      i,
      Object.values(cells)[0],
    ]),
  );
}
export const EXAMPLE_PARTS = [
  ["001234", "Oil filter", "4", "125.50", "Landini"],
  ["JD-5678", "Seal", "2", "", "John Deere"],
];
