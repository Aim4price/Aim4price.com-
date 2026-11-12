import {
  parsePartsSnapshot,
  partsTableCsv,
  readPartsCsv,
  type PartColumns,
} from "./parts-network-csv";
export const PART_FIELDS = [
  "partNumber",
  "quantity",
  "price",
  "brand",
  "description",
] as const;
export const PART_LABELS = [
  "Part number",
  "Quantity",
  "Unit price",
  "Brand",
  "Description",
];
export const EDITOR_COLUMNS: PartColumns = {
  partNumber: 0,
  quantity: 1,
  price: 2,
  brand: 3,
  description: 4,
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
      "These cells extend beyond Description. Paste into the first column or import a file to match columns.",
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
export function partRowErrors(rows: string[][]) {
  const errors: Record<number, string> = {};
  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    try {
      parsePartsSnapshot(partsTableCsv([row]), EDITOR_COLUMNS, {
        hasHeader: false,
      });
    } catch (e) {
      errors[i] = (e as Error).message.replace(/^Row 1: /, "");
    }
    const key = row[0].trim().toUpperCase();
    if (key && seen.has(key)) {
      errors[i] = errors[seen.get(key)!] =
        `Duplicate part number ${row[0]}. Edit or remove a duplicate row.`;
    } else if (key) seen.set(key, i);
  });
  return errors;
}
export const EXAMPLE_PARTS = [
  ["001234", "4", "125.50", "Landini", "Oil filter"],
  ["JD-5678", "2", "", "John Deere", "Seal"],
];
