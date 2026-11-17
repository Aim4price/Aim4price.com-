import { guessPartColumns, PART_DETAIL_PRESETS, type PartColumns, type PartDetailField } from "./parts-network-csv";

export const IMPORT_FIELDS = ["partNumber", "description", "quantity", "price", "brand"] as const;

export function columnLetter(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

/** Only headings are matched automatically. Unlabelled data always needs a choice. */
export function inspectPartsTable(table: string[][], fields: PartDetailField[], headerOverride?: boolean) {
  if (!table.length || !table.some(row => row.some(cell => cell.trim()))) throw new Error("This file has no parts. Choose another file or paste some cells.");
  const width = table.reduce((max, row) => Math.max(max, row.length), 0);
  if (width > 100) throw new Error("Use at most 100 columns per import.");
  const guessed = guessPartColumns(table[0]);
  const hasHeader = headerOverride ?? (guessed.partNumber >= 0 || IMPORT_FIELDS.filter(key => (guessed[key] ?? -1) >= 0).length >= 2);
  const candidates = [...fields, ...PART_DETAIL_PRESETS.filter(p => !fields.some(f => f.id === p.id || f.label.toLowerCase() === p.label.toLowerCase()))];
  const addedFields: PartDetailField[] = [];
  const used = new Set<string>();
  const mapping = Array.from({length: width}, (_, index) => {
    if (table.every(row => !row[index]?.trim())) return "skip";
    if (!hasHeader) return "";
    const heading = table[0][index] ?? "";
    const match = guessPartColumns([heading]);
    let key: string = IMPORT_FIELDS.find(field => match[field] === 0) ?? "";
    if (!key) {
      const field = candidates.find(f => f.label.toLowerCase() === heading.replace(/ \(private\)$/i, "").trim().toLowerCase());
      if (field && (fields.some(f => f.id === field.id) || fields.length + addedFields.length < 12)) {
        key = `detail:${field.id}`;
        if (!fields.some(f => f.id === field.id) && !addedFields.some(f => f.id === field.id)) addedFields.push({...field, private: field.private || / \(private\)$/i.test(heading)});
      }
    }
    if (!key || used.has(key)) return "";
    used.add(key);
    return key;
  });
  return {hasHeader, mapping, addedFields};
}

export function mappedPartColumns(mapping: string[]): PartColumns {
  const columns: PartColumns = {partNumber: -1, description: -1, quantity: -1, price: -1, brand: -1, details: {}};
  const used = new Set<string>();
  mapping.forEach((key, index) => {
    if (!key || key === "skip") return;
    if (used.has(key)) throw new Error("Use each parts field only once.");
    used.add(key);
    if (key.startsWith("detail:")) columns.details![key.slice(7)] = index;
    else if (IMPORT_FIELDS.includes(key as typeof IMPORT_FIELDS[number])) columns[key as typeof IMPORT_FIELDS[number]] = index;
  });
  return columns;
}
