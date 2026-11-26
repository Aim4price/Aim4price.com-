import { templateGuideTitle } from './asset-sheet';

/** Read locally in the browser. Formulas are never evaluated or fetched. */
export async function readPartsExcel(
  buffer: ArrayBuffer,
  purpose: "parts" | "assets" = "parts",
): Promise<{ name: string; rows: string[][] }[]> {
  if (buffer.byteLength > 5_000_000)
    throw new Error("Use an Excel file smaller than 5 MB.");
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error(
      "Could not read this workbook. Use an unprotected .xlsx file or paste its cells.",
    );
  }
  return workbook.worksheets
    .filter((sheet) => sheet.state === "visible")
    .filter((sheet) => purpose !== "assets" || sheet.name !== "Guide" || sheet.getCell("A1").value !== templateGuideTitle)
    .map((sheet) => {
      if (sheet.rowCount > 20001 || sheet.columnCount > 100)
        throw new Error(`Use at most 20,000 ${purpose} and 100 columns per sheet.`);
      const rows: string[][] = [];
      sheet.eachRow((row) => {
        const cells = Array.from({ length: sheet.columnCount }, (_, index) => {
          const cell = row.getCell(index + 1);
          let value = cell.value;
          if (
            value &&
            typeof value === "object" &&
            ("formula" in value || "sharedFormula" in value)
          ) {
            if (value.result === undefined)
              throw new Error(
                `Sheet ${sheet.name}, ${cell.address}: save calculated values in Excel or paste values only.`,
              );
            value = value.result;
          }
          if (value === null || value === undefined) return "";
          if (typeof value === "string") return value.trim();
          if (purpose === "assets" && value instanceof Date) return value.toISOString().slice(0, 10);
          if (typeof value === "number") {
            if (purpose === "assets" && /^[0#.,]+%$/.test(cell.numFmt || "")) {
              return String(Number((value * 100).toFixed(6))) + "%";
            }
            if (
              !Number.isFinite(value) ||
              (Number.isInteger(value) && !Number.isSafeInteger(value))
            )
              throw new Error(
                `Sheet ${sheet.name}, ${cell.address}: store long identifiers as text.`,
              );
            // Preserve common zero-padded stock codes, rather than coercing them to numbers.
            return /^0+$/.test(cell.numFmt || "") &&
              Number.isInteger(value) &&
              value >= 0
              ? String(value).padStart(cell.numFmt.length, "0")
              : String(value);
          }
          if (typeof value === "object" && "richText" in value)
            return value.richText
              .map((run) => run.text)
              .join("")
              .trim();
          if (typeof value === "object" && "text" in value)
            return value.text.trim();
          throw new Error(
            `Sheet ${sheet.name}, ${cell.address}: use text or numbers, not dates or errors.`,
          );
        });
        if (cells.some(Boolean)) rows.push(cells);
      });
      return { name: sheet.name, rows };
    })
    .filter((sheet) => sheet.rows.length);
}
