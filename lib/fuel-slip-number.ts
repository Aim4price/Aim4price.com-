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
const FUEL_SLIP_NUMBERISH_FRAGMENT = /-?(?:\d|[oOlI|!sSgGqQbBzZ](?=[0-9oOlI|!sSgGqQbBzZ]))(?:[0-9oOlI|!sSgGqQbBcCkKzZ\s,.:;；]*[0-9oOlI|!sSgGqQbBcCkKzZ])?/g;

function ocrDigitReplacement(character: string): string | null {
  if (/\d/.test(character)) return character;
  if (/[oO]/.test(character)) return '0';
  if (/[lI|!kK]/.test(character)) return '1';
  if (/[zZ]/.test(character)) return '2';
  if (/[sS]/.test(character)) return '5';
  if (/[bB]/.test(character)) return '6';
  if (/[gGqQ]/.test(character)) return '9';
  if (/[cC]/.test(character)) return '0';
  return null;
}

function repairNumberishFragment(value: string): string {
  const characters = [...value.replace(/[;；]/g, '.').replace(/[·•]/g, '.')];
  let output = '';

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];

    if (/[-\s,.:]/.test(character)) {
      output += character;
      continue;
    }

    if (/[cC]/.test(character)) {
      const previous = output.trimEnd().slice(-1);
      const next = ocrDigitReplacement(characters[index + 1] ?? '');
      if (/[,.:]/.test(previous) && next !== null) {
        continue;
      }
    }

    const replacement = ocrDigitReplacement(character);
    output += replacement ?? character;
  }

  return output;
}

function repairFuelSlipNumberishText(value: string): string {
  return cleanNumericText(value)
    .replace(/\bR\s*[kK](?=\s*\d)/g, 'R ')
    .replace(/(\d)\s*[;；]\s*(?=[\doOlI|!sSgGqQbBcCkKzZ])/g, '$1.')
    .replace(FUEL_SLIP_NUMBERISH_FRAGMENT, (fragment) => (/\d/.test(fragment) ? repairNumberishFragment(fragment) : fragment));
}

function extractDecimalTokens(value: string): string[] {
  return [...repairFuelSlipNumberishText(value).matchAll(FUEL_SLIP_DECIMAL_TOKEN)]
    .map((match) => cleanNumericText(match[0]))
    .filter((token) => /\d/.test(token));
}

function preferredDecimalToken(value: string): string {
  const text = repairFuelSlipNumberishText(value);
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
    .replace(/(\d)\s*[:;]\s*(\d)/g, '$1.$2')
    .replace(/(?:zar|rand)/gi, '')
    .replace(/litres?|liters?|ltrs?/gi, '')
    .replace(/\bper\b/gi, '')
    .replace(/\br\b/gi, '')
    .replace(/^\s*r\s*/i, '')
    .replace(/[^0-9, .\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/[0-9]/.test(text)) return null;

  const spaceDecimalGroups = text.split(/\s+/).filter(Boolean);
  const hasCommaOrDot = /[,.]/.test(text);
  const hasColon = /:/.test(text);

  if (!hasCommaOrDot && !hasColon && spaceDecimalGroups.length >= 2) {
    const lastGroup = spaceDecimalGroups[spaceDecimalGroups.length - 1];
    const integerGroups = spaceDecimalGroups.slice(0, -1);
    const canUseSpaceAsDecimal = lastGroup.length === 2 || (decimals >= 3 && lastGroup.length >= 1 && lastGroup.length <= 4 && (lastGroup.length !== 3 || spaceDecimalGroups.length === 2));

    if (canUseSpaceAsDecimal && integerGroups.every((group, index) => index === 0 ? /^-?\d{1,3}$/.test(group) : /^\d{3}$/.test(group))) {
      text = `${integerGroups.join('')}.${lastGroup}`;
    } else {
      text = text.replace(/\s+(?=\d{3}(?:\D|$))/g, '').replace(/\s+/g, '');
    }
  } else {
    text = text.replace(/\s+(?=\d{3}(?:\D|$))/g, '');
    text = text.replace(/\s+/g, '');
  }

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

function finiteFuelSlipNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function reconcileFuelSlipNumbers(input: FuelSlipNumericFields): FuelSlipReconciliationResult {
  const litres = finiteFuelSlipNumber(input.litres) ? roundFuelSlipLitres(input.litres) : null;
  const pricePerLitre = finiteFuelSlipNumber(input.pricePerLitre) ? roundFuelSlipRate(input.pricePerLitre) : null;
  const totalAmount = finiteFuelSlipNumber(input.totalAmount) ? roundFuelSlipAmount(input.totalAmount) : null;

  return {
    fields: {
      litres,
      pricePerLitre,
      totalAmount,
    },
    warnings: [],
    mismatch: false,
  };
}
