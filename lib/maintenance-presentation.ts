/** Capitalise display labels without changing saved values, names or acronyms. */
export function maintenanceLabel(value: string | null | undefined): string {
  return (value || '').replace(/(^|[·•]\s*)(\s*)([a-z])/g,
    (_, separator: string, space: string, letter: string) => separator + space + letter.toUpperCase());
}
