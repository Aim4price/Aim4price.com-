'use client';

import type { InputHTMLAttributes } from 'react';

type GroupedCurrencyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
};

export function normalizeCurrencyInput(value: string): string {
  const compact = value.replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const decimalIndex = compact.indexOf('.');

  if (decimalIndex === -1) return compact;

  const whole = compact.slice(0, decimalIndex);
  const decimal = compact.slice(decimalIndex + 1).replace(/\./g, '').slice(0, 2);
  return `${whole}.${decimal}`;
}

export function formatCurrencyInput(value: string | number | null | undefined): string {
  const normalized = normalizeCurrencyInput(String(value ?? ''));
  if (!normalized) return '';

  const hasDecimal = normalized.includes('.');
  const [wholeValue, decimal = ''] = normalized.split('.');
  const whole = wholeValue.replace(/^0+(?=\d)/, '') || '0';
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return hasDecimal ? `${groupedWhole}.${decimal}` : groupedWhole;
}

export function parseCurrencyInput(value: string): number | null {
  const normalized = normalizeCurrencyInput(value);
  if (!normalized || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function GroupedCurrencyInput({ value, onValueChange, ...props }: GroupedCurrencyInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={formatCurrencyInput(value)}
      onChange={(event) => onValueChange(normalizeCurrencyInput(event.target.value))}
    />
  );
}
