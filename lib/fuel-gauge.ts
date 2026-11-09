/** Empty means not chosen, never an empty tank. Zero is a valid explicit reading. */
export function fuelGaugeReading(value: string): number | null {
  if (!value.trim()) return null;
  const reading = Number(value);
  return Number.isFinite(reading) && reading >= 0 && reading <= 100 ? reading : null;
}

export function fuelGaugeError(before: string, after?: string): string {
  const start = fuelGaugeReading(before);
  if (start === null) return 'Choose the fuel level before filling.';
  if (after === undefined) return '';
  const end = fuelGaugeReading(after);
  if (end === null) return 'Choose the fuel level after filling.';
  return end < start ? 'The fuel level after filling cannot be lower than before filling.' : '';
}
