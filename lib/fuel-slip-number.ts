export type FuelSlipNumericFields = {
  litres: number | null;
  pricePerLitre: number | null;
  totalAmount: number | null;
};

export type FuelSlipReconciliationResult = {
  fields: FuelSlipNumericFields;
  warnings: string[];
  mismatch: boolean;
};

function cleanNumericText(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\f\v]+/g, ' ')
    .trim();
}

const FUEL_SLIP_DECIMAL_TOKEN = /-?\d(?:[\d ]*\d)?(?:\s*[,.:]\s*\d{1,4})*/g;

function extractDecimalTokens(value: string): string[] {
  return [...value.matchAll(FUEL_SLIP_DECIMAL_TOKEN)]
    .map((match) => cleanNumericText(match[0]))
    .filter((token) => /\d/.test(token));
}

function preferredDecimalToken(value: string): string {
  const text = cleanNumericText(value);
  if (!text) return '';

  if (/^T\s*[:=]\s*\d{1,2}:\d{2}(?::\d{2})?$/i.test(text) || /^\d{1,2}:\d{2}:\d{2}$/.test(text)) {
    return '';
  }

  const afterAt = /@\s*((?:ZAR\s*)?(?:R\s*)?-?\d[\d ,.:]*\d?)/i.exec(text);
  if (afterAt) {
    const atTokens = extractDecimalTokens(afterAt[1]);
    if (atTokens.length) return atTokens[0];
  }

  const currencyMatches = [...text.matchAll(/(?:ZAR\s*)?R\s*(-?\d[\d ,.:]*\d?)/gi)]
    .map((match) => extractDecimalTokens(match[1])[0])
    .filter((token): token is string => Boolean(token));
  if (currencyMatches.length) return currencyMatches[currencyMatches.length - 1];

  const labelled = /\b(?:litres?|liters?|ltrs?|qty|quantity|amount|amnt|total|purchase|sale|price|rate)\b[^0-9-]{0,16}(-?\d[\d ,.:]*\d?)/i.exec(text);
  if (labelled) {
    const labelledTokens = extractDecimalTokens(labelled[1]);
    if (labelledTokens.length) return labelledTokens[0];
  }

  const tokens = extractDecimalTokens(text);
  return tokens.length <= 1 ? (tokens[0] ?? text) : tokens[tokens.length - 1];
}

export function roundFuelSlipDecimal(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function roundFuelSlipLitres(value: number): number {
  return roundFuelSlipDecimal(value, 3);
}

export function roundFuelSlipRate(value: number): number {
  return roundFuelSlipDecimal(value, 4);
}

export function roundFuelSlipAmount(value: number): number {
  return roundFuelSlipDecimal(value, 2);
}

export function parseFuelSlipDecimal(value: unknown, decimals = 2): number | null {
  let text = preferredDecimalToken(cleanNumericText(value))
    .replace(/(\d)\s*:\s*(\d)/g, '$1.$2')
    .replace(/(?:zar|rand)/gi, '')
    .replace(/litres?|liters?|ltrs?/gi, '')
    .replace(/\bper\b/gi, '')
    .replace(/\br\b/gi, '')
    .replace(/^\s*r\s*/i, '')
    .replace(/[^0-9, .\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/[0-9]/.test(text)) return null;

  text = text.replace(/\s+(?=\d{3}(?:\D|$))/g, '');
  text = text.replace(/\s+/g, '');

  const sign = text.startsWith('-') ? '-' : '';
  text = text.replace(/-/g, '');

  const separators = [...text.matchAll(/[,.]/g)].map((match) => ({ value: match[0], index: match.index ?? -1 }));

  if (separators.length > 0) {
    const lastSeparator = separators[separators.length - 1];
    const before = text.slice(0, lastSeparator.index).replace(/[,.]/g, '');
    const after = text.slice(lastSeparator.index + 1).replace(/[,.]/g, '');
    const hasMixedSeparators = new Set(separators.map((entry) => entry.value)).size > 1;
    const hasRepeatedSeparators = separators.length > 1;
    const singleThousandsGroup = !hasMixedSeparators
      && !hasRepeatedSeparators
      && after.length === 3
      && before.length >= 1
      && before.length <= 3
      && decimals <= 2;

    if (after.length > 0 && after.length <= 4 && !singleThousandsGroup) {
      text = `${before || '0'}.${after}`;
    } else {
      text = `${before}${after}`;
    }
  }

  const parsed = Number(`${sign}${text}`);
  if (!Number.isFinite(parsed)) return null;

  return roundFuelSlipDecimal(parsed, decimals);
}

export function fuelSlipDecimalToInput(value: number | null | undefined, decimals?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (typeof decimals === 'number') return roundFuelSlipDecimal(value, decimals).toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return String(value);
}

export function reconcileFuelSlipNumbers(input: FuelSlipNumericFields): FuelSlipReconciliationResult {
  let litres = input.litres;
  let pricePerLitre = input.pricePerLitre;
  let totalAmount = input.totalAmount;
  const warnings: string[] = [];
  let mismatch = false;

  if ((totalAmount === null || !Number.isFinite(totalAmount)) && litres !== null && pricePerLitre !== null && litres > 0 && pricePerLitre > 0) {
    totalAmount = roundFuelSlipAmount(litres * pricePerLitre);
  }

  if ((litres === null || !Number.isFinite(litres)) && totalAmount !== null && pricePerLitre !== null && totalAmount > 0 && pricePerLitre > 0) {
    litres = roundFuelSlipLitres(totalAmount / pricePerLitre);
  }

  if ((pricePerLitre === null || !Number.isFinite(pricePerLitre)) && totalAmount !== null && litres !== null && totalAmount > 0 && litres > 0) {
    pricePerLitre = roundFuelSlipRate(totalAmount / litres);
  }

  if (litres !== null && pricePerLitre !== null && totalAmount !== null && litres > 0 && pricePerLitre > 0 && totalAmount > 0) {
    const expectedTotal = roundFuelSlipAmount(litres * pricePerLitre);
    const difference = Math.abs(expectedTotal - totalAmount);
    const tolerance = Math.max(1, Math.abs(totalAmount) * 0.01);

    if (difference > tolerance) {
      mismatch = true;
      warnings.push(
        `Litres × price per litre does not match the printed total. Expected R${expectedTotal.toFixed(2)}, printed R${totalAmount.toFixed(2)}.`,
      );
    }
  }

  return {
    fields: {
      litres: litres === null || !Number.isFinite(litres) ? null : roundFuelSlipLitres(litres),
      pricePerLitre: pricePerLitre === null || !Number.isFinite(pricePerLitre) ? null : roundFuelSlipRate(pricePerLitre),
      totalAmount: totalAmount === null || !Number.isFinite(totalAmount) ? null : roundFuelSlipAmount(totalAmount),
    },
    warnings,
    mismatch,
  };
}
