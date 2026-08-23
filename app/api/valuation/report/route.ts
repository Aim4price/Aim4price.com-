import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ValuationReportKeyValue = {
  label: string;
  value: string;
};

type ValuationReportPayload = {
  generatedAt: string;
  machineTitle: string;
  sectorLabel: string;
  familyLabel: string;
  brandName: string;
  valuationPath: string;
  selectedMethodLabel: string;
  selectedValueExVat: number;
  aim4priceValueExVat: number | null;
  confidenceText: string;
  confidenceNote: string;
  yearSummary: string;
  usageSummary: string;
  conditionSummary: string;
  replacementPriceExVat: number | null;
  replacementBasisText: string;
  notes: string[];
  assetDetailRows: ValuationReportKeyValue[];
  clientRows: ValuationReportKeyValue[];
  recordRows: ValuationReportKeyValue[];
  saleabilityRows: ValuationReportKeyValue[];
};

type NormalizedValuationReport = {
  generatedAt: Date;
  generatedLabel: string;
  fileName: string;
  logoUrl: string;
  assetBadge: string;
  heroTitle: string;
  heroMeta: string;
  selectedMethodLabel: string;
  selectedValue: string;
  assetDetailRows: ValuationReportKeyValue[];
  clientRows: ValuationReportKeyValue[];
  recordRows: ValuationReportKeyValue[];
  saleabilityRows: ValuationReportKeyValue[];
};

const AIM4PRICE_EMAIL = 'aim4price@gmail.com';
const AIM4PRICE_PHONE = '0625721650';
const FOOTER_DISCLAIMER =
  'Values are indicative Aim4price estimates based on replacement price, saved asset information, age, usage, condition and available asset inputs. This is not a certified appraisal, inspection report or guarantee of selling price.';
const VALUATION_REPORT_LOGO_PUBLIC_PATH = '/brand/aim4price-mark-black.png';
let cachedValuationReportLogoDataUri: string | null | undefined;

async function getValuationReportLogoUrl(request: NextRequest): Promise<string> {
  const fallbackLogoUrl = new URL(VALUATION_REPORT_LOGO_PUBLIC_PATH, request.url).toString();

  if (cachedValuationReportLogoDataUri) {
    return cachedValuationReportLogoDataUri;
  }

  if (cachedValuationReportLogoDataUri === null) {
    return fallbackLogoUrl;
  }

  try {
    const logoPath = path.join(process.cwd(), 'public', 'brand', 'aim4price-mark-black.png');
    const logoBuffer = await readFile(logoPath);
    cachedValuationReportLogoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    return cachedValuationReportLogoDataUri;
  } catch (error) {
    console.warn('valuation report logo fallback used', error);
    cachedValuationReportLogoDataUri = null;
    return fallbackLogoUrl;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSpaces(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function readString(value: unknown, fallback = ''): string {
  const cleaned = normalizeSpaces(value);
  return cleaned || fallback;
}

function readNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function readDate(value: unknown): Date {
  const parsed = value ? new Date(String(value)) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

function formatReportDate(value: Date): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(value);
}

function formatReportMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';

  const rounded = Math.round(value);
  const formatted = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${rounded < 0 ? '-' : ''}R ${formatted}`;
}

function pdfFileSlug(value: string): string {
  const parts = String(value ?? '').match(/[A-Za-z0-9]+/g) ?? [];
  return parts.join('-') || 'Estimate';
}

function isBlankReportValue(value: unknown): boolean {
  const normalized = normalizeSpaces(value);
  return !normalized || /^(-|—|n\/a|null|undefined)$/i.test(normalized);
}

function isRemovedReportRowLabel(label: string): boolean {
  const normalized = normalizeSpaces(label);
  return (
    /^(Selected Value|Selected Value Type)$/i.test(normalized) ||
    /^Estimate Source\s*\/\s*Selected Value Type$/i.test(normalized)
  );
}

function normalizeUsageSummaryForReport(value: unknown, fallback = 'Usage captured'): string {
  const cleaned = readString(value, fallback);
  const parts = cleaned.split(/\s*•\s*/).map(normalizeSpaces).filter(Boolean);

  if (parts.length <= 1) return cleaned;

  const actualUsage = parts.find((part) => /\b(km|hours?|hrs?)\b/i.test(part) && !/\bestimated\b/i.test(part));
  if (actualUsage) return actualUsage;

  const percentageWorked = parts.find((part) => /%/.test(part));
  if (percentageWorked) return percentageWorked;

  return parts[0] ?? cleaned;
}

function normalizeReportRows(value: unknown): ValuationReportKeyValue[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPlainRecord)
    .map((row) => {
      const label = normalizeSpaces(row.label).replace(/Marketplace\s+Value/gi, 'Aim4price Value');
      const value = normalizeSpaces(row.value).replace(/Marketplace\s+Value/gi, 'Aim4price Value');

      return {
        label,
        value: /^Usage$/i.test(label) ? normalizeUsageSummaryForReport(value, '') : value,
      };
    })
    .filter(
      (row) =>
        row.label &&
        !isRemovedReportRowLabel(row.label) &&
        !/^Market\s+Evidence$/i.test(row.label) &&
        !isBlankReportValue(row.value),
    );
}

function normalizeSelectedMethodLabel(value: unknown): string {
  const cleaned = readString(value, 'Aim4price Value');
  if (/market/i.test(cleaned)) return 'Aim4price Value';
  if (/aim4price/i.test(cleaned)) return 'Aim4price Value';
  return cleaned;
}

function normalizeConfidenceText(value: unknown): string {
  const cleaned = readString(value, 'Low').replace(/^Confidence:\s*/i, '').trim();
  if (/^high$/i.test(cleaned)) return 'High';
  if (/^medium$/i.test(cleaned)) return 'Medium';
  if (/^low$/i.test(cleaned)) return 'Low';
  return cleaned || 'Low';
}


function pushRow(rows: ValuationReportKeyValue[], label: string, value: unknown) {
  const cleaned = normalizeSpaces(value);
  if (!label || isBlankReportValue(cleaned)) return;
  rows.push({ label, value: cleaned });
}

function modelFromTitle(machineTitle: string, brandName: string): string {
  if (!machineTitle) return '';
  if (!brandName) return machineTitle;

  const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return machineTitle.replace(new RegExp(`^${escapedBrand}\\s+`, 'i'), '').trim();
}

async function readRequestPayload(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const rawPayload = formData.get('payload');

    if (typeof rawPayload !== 'string' || !rawPayload.trim()) {
      throw new Error('An estimate report payload is required.');
    }

    return JSON.parse(rawPayload);
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    throw new Error('An estimate report payload is required.');
  }

  return JSON.parse(rawBody);
}

function normalizePayload(value: unknown, logoUrl: string): NormalizedValuationReport {
  if (!isPlainRecord(value)) {
    throw new Error('Invalid estimate report payload.');
  }

  const selectedValueExVat = readNumber(value.selectedValueExVat);
  if (selectedValueExVat === null) {
    throw new Error('A selected estimate amount is required before the PDF report can be created.');
  }

  const generatedAt = readDate(value.generatedAt);
  const generatedLabel = formatReportDate(generatedAt);
  const machineTitle = readString(value.machineTitle, 'Aim4price estimate');
  const familyLabel = readString(value.familyLabel, readString(value.sectorLabel, 'Asset'));
  const brandName = readString(value.brandName);
  const selectedMethodLabel = normalizeSelectedMethodLabel(value.selectedMethodLabel);
  const confidenceText = normalizeConfidenceText(value.confidenceText);
  const yearSummary = readString(value.yearSummary, 'Unknown');
  const usageSummary = normalizeUsageSummaryForReport(value.usageSummary);
  const conditionSummary = readString(value.conditionSummary, 'Condition captured');
  const valuationPath = readString(value.valuationPath, 'Estimate');
  const replacementPriceExVat = readNumber(value.replacementPriceExVat);

  const fallbackAssetRows: ValuationReportKeyValue[] = [];
  pushRow(fallbackAssetRows, 'Category', familyLabel);
  pushRow(fallbackAssetRows, 'Brand', brandName);
  pushRow(fallbackAssetRows, 'Model', modelFromTitle(machineTitle, brandName));
  pushRow(fallbackAssetRows, 'Year', yearSummary);
  pushRow(fallbackAssetRows, 'Usage', usageSummary);
  pushRow(fallbackAssetRows, 'Condition', conditionSummary);
  if (replacementPriceExVat !== null) {
    pushRow(fallbackAssetRows, 'Replacement Price', `${formatReportMoney(replacementPriceExVat)} excl. VAT`);
  }
  pushRow(fallbackAssetRows, 'Estimate Path', valuationPath);

  const fallbackClientRows: ValuationReportKeyValue[] = [
    { label: 'Business Name', value: 'Aim4price' },
    { label: 'Contact Details', value: AIM4PRICE_PHONE },
    { label: 'Business Email', value: AIM4PRICE_EMAIL },
  ];

  const fallbackRecordRows: ValuationReportKeyValue[] = [
    { label: 'Confidence', value: confidenceText },
    { label: 'Generated', value: generatedLabel },
  ];

  const fileName = `Aim4price-Estimate-${pdfFileSlug(machineTitle)}.pdf`;

  const assetDetailRows = normalizeReportRows(value.assetDetailRows);
  const clientRows = normalizeReportRows(value.clientRows);
  const recordRows = normalizeReportRows(value.recordRows);
  const saleabilityRows = normalizeReportRows(value.saleabilityRows);

  return {
    generatedAt,
    generatedLabel,
    fileName,
    logoUrl,
    assetBadge: familyLabel.toUpperCase(),
    heroTitle: machineTitle,
    heroMeta: `Year Model: ${yearSummary} • Usage: ${usageSummary} • Condition: ${conditionSummary}`,
    selectedMethodLabel,
    selectedValue: formatReportMoney(selectedValueExVat),
    assetDetailRows: assetDetailRows.length ? assetDetailRows : fallbackAssetRows,
    clientRows: clientRows.length ? clientRows : fallbackClientRows,
    recordRows: recordRows.length ? recordRows : fallbackRecordRows,
    saleabilityRows,
  };
}

function renderReportRows(rows: ValuationReportKeyValue[], emptyLabel: string): string {
  const visibleRows = rows.filter((row) => normalizeSpaces(row.label));

  if (!visibleRows.length) {
    return `<div class="assetReportEmpty">${escapeHtml(emptyLabel)}</div>`;
  }

  return `
    <div class="assetReportRows">
      ${visibleRows
        .map(
          (row) => `
            <div class="assetReportRow">
              <span>${escapeHtml(row.label)}</span>
              <strong>${escapeHtml(isBlankReportValue(row.value) ? '-' : row.value)}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderValuationReportHtml(payload: NormalizedValuationReport): string {
  const safeTitle = escapeHtml(payload.heroTitle);
  const safeFileName = escapeHtml(payload.fileName);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeFileName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --strong: #070b12;
        --muted: #5f6b7a;
        --faint: #8b95a3;
        --paper: #ffffff;
        --soft: #f5f6f8;
        --soft-2: #fafbfc;
        --line: #d7dde5;
        --line-strong: #b9c2ce;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: A4;
        margin: 8mm 9mm 8mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
        color: var(--ink);
        font-family: "Montserrat", "Segoe UI", Arial, Helvetica, sans-serif;
        font-size: 9.6px;
        line-height: 1.35;
      }

      .assetReportScreenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px 16px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #d7dce2;
        box-shadow: 0 10px 26px rgba(17, 24, 39, 0.07);
      }

      .assetReportScreenText {
        min-width: 0;
        color: var(--muted);
        font-size: 12.5px;
        line-height: 1.4;
      }

      .assetReportScreenActions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: nowrap;
      }

      .assetReportButton {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        min-height: 42px;
        padding: 0 16px;
        border: 1px solid #cfd5dd;
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        font: inherit;
        font-size: 12.5px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
      }

      .assetReportButtonPrimary {
        min-width: 150px;
        border-color: var(--strong);
        background: var(--strong);
        color: #ffffff;
        box-shadow: 0 12px 22px rgba(7, 11, 18, 0.18);
      }

      .assetReportButton:focus-visible {
        outline: 3px solid rgba(17, 24, 39, 0.18);
        outline-offset: 2px;
      }

      .assetReportPage {
        width: min(100%, 210mm);
        min-height: 297mm;
        margin: 18px auto;
        padding: 11mm 11mm 9mm;
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetReportInner {
        position: relative;
        min-height: calc(297mm - 20mm);
        padding-bottom: 20mm;
      }

      .assetReportHeader {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr) 62mm;
        gap: 12px;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--line-strong);
      }

      .assetReportLogoWrap {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 18mm;
      }

      .assetReportLogo {
        display: block;
        width: 18mm;
        height: auto;
        object-fit: contain;
      }

      .assetReportDocumentTitle strong {
        display: block;
        color: var(--strong);
        font-size: 16px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.025em;
      }

      .assetReportDocumentTitle span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 8.9px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .assetReportHeaderMeta {
        display: grid;
        gap: 4px;
        color: var(--muted);
        font-size: 8.3px;
      }

      .assetReportMetaLine {
        display: grid;
        grid-template-columns: 21mm minmax(0, 1fr);
        gap: 7px;
        align-items: baseline;
      }

      .assetReportMetaLine span {
        color: var(--muted);
        font-weight: 600;
      }

      .assetReportMetaLine strong {
        color: var(--strong);
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportOverview {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 62mm;
        align-items: stretch;
        margin-top: 11px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportIdentity {
        min-width: 0;
        padding: 11px 13px 12px;
      }

      .assetReportKicker {
        margin: 0 0 6px;
        color: var(--muted);
        font-size: 8.1px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .assetReportTitle {
        margin: 0;
        color: var(--strong);
        font-size: 21.5px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.045em;
      }

      .assetReportMeta {
        margin: 7px 0 0;
        color: #3f4652;
        font-size: 9.2px;
        line-height: 1.35;
        font-weight: 600;
      }

      .assetReportValuationCard {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 11px 12px;
        border-left: 1px solid var(--line-strong);
        background: var(--soft-2);
      }

      .assetReportValuationCard h2 {
        margin: 0 0 6px;
        color: #2b313b;
        font-size: 8.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }

      .assetReportValue {
        display: block;
        margin: 0;
        color: var(--strong);
        font-size: 30px;
        line-height: 0.96;
        font-weight: 800;
        letter-spacing: -0.055em;
        white-space: nowrap;
      }

      .assetReportVat {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 8.5px;
        font-weight: 600;
      }

      .assetReportValueMeta {
        display: grid;
        gap: 4px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
      }

      .assetReportValueMeta div,
      .assetReportRecordRows .assetReportRow {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr);
        gap: 7px;
        min-height: 17px;
        align-items: baseline;
      }

      .assetReportValueMeta span,
      .assetReportRecordRows .assetReportRow span {
        color: var(--muted);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetReportValueMeta strong,
      .assetReportRecordRows .assetReportRow strong {
        color: var(--strong);
        font-size: 8.3px;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportContentGrid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 62mm;
        gap: 12px;
        align-items: start;
        margin-top: 12px;
      }

      .assetReportMainStack {
        display: grid;
        gap: 10px;
      }

      .assetReportSection,
      .assetReportSideCard {
        break-inside: avoid;
      }

      .assetReportSection {
        padding: 10px 11px 11px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportSection h2,
      .assetReportSideCard h2 {
        margin: 0 0 8px;
        color: var(--strong);
        font-size: 10.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .assetReportRows {
        width: 100%;
        border-top: 1px solid var(--line);
      }

      .assetReportRow {
        display: grid;
        grid-template-columns: 30mm minmax(0, 1fr);
        min-height: 20px;
        align-items: center;
        border-bottom: 1px solid var(--line);
      }

      .assetReportRow span {
        color: #38404c;
        font-size: 8.8px;
        line-height: 1.3;
        font-weight: 600;
      }

      .assetReportRow strong {
        color: var(--strong);
        font-size: 9px;
        line-height: 1.3;
        font-weight: 700;
        word-break: break-word;
      }

      .assetReportTechnical .assetReportRows {
        display: grid;
        grid-template-columns: 1fr;
        border-top: 1px solid var(--line);
      }

      .assetReportTechnical .assetReportRow {
        grid-template-columns: 31mm minmax(0, 1fr);
        min-height: 21px;
      }

      .assetReportClientCard .assetReportRow {
        grid-template-columns: 31mm minmax(0, 1fr);
        min-height: 20px;
        align-items: start;
        padding: 3px 0;
      }

      .assetReportClientCard .assetReportRow span,
      .assetReportClientCard .assetReportRow strong {
        line-height: 1.35;
      }

      .assetReportEmpty {
        padding: 6px 0;
        color: var(--muted);
        font-size: 8.8px;
      }

      .assetReportSide {
        display: grid;
        gap: 10px;
      }

      .assetReportSideCard {
        padding: 10px 10px 9px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportSideCard .assetReportRows {
        border-top: 1px solid var(--line);
      }

      .assetReportSideCard .assetReportRow {
        grid-template-columns: 21mm minmax(0, 1fr);
        min-height: 17.5px;
      }

      .assetReportSideCard .assetReportRow span {
        font-size: 8.1px;
      }

      .assetReportSideCard .assetReportRow strong {
        font-size: 8.2px;
      }

      .assetReportRecordRows .assetReportRows {
        display: grid;
        gap: 0;
      }

      .assetReportRecordRows .assetReportRow:last-child {
        border-bottom: 0;
      }

      .assetReportFooter {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
        padding-top: 8px;
        border-top: 1px solid var(--line-strong);
      }

      .assetReportPowered {
        margin: 0 0 4px;
        color: var(--strong);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetReportDisclaimer {
        max-width: 166mm;
        color: #323a45;
        font-size: 7.35px;
        line-height: 1.35;
        font-style: italic;
      }

      .assetReportPageNumber {
        color: var(--strong);
        font-size: 8px;
        font-weight: 700;
        white-space: nowrap;
      }

      @media screen and (max-width: 760px) {
        .assetReportScreenBar {
          grid-template-columns: 1fr;
          padding: 10px 12px 12px;
        }

        .assetReportScreenText {
          font-size: 12px;
        }

        .assetReportScreenActions {
          display: grid;
          grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
          width: 100%;
          gap: 8px;
        }

        .assetReportButton {
          width: 100%;
          min-height: 44px;
          padding: 0 10px;
          font-size: 12px;
        }

        .assetReportButtonPrimary {
          min-width: 0;
        }

        .assetReportPage {
          padding: 24px;
        }

        .assetReportHeader,
        .assetReportOverview,
        .assetReportContentGrid {
          grid-template-columns: 1fr;
        }

        .assetReportValuationCard {
          border-left: 0;
          border-top: 1px solid var(--line-strong);
        }

        .assetReportHeaderMeta,
        .assetReportMetaLine strong,
        .assetReportValueMeta strong,
        .assetReportRecordRows .assetReportRow strong {
          text-align: left;
        }

        .assetReportTechnical .assetReportRows {
          grid-template-columns: 1fr;
        }
      }

      @media screen and (max-width: 380px) {
        .assetReportScreenActions {
          grid-template-columns: 1fr;
        }
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .assetReportScreenBar {
          display: none !important;
        }

        .assetReportPage {
          width: auto;
          height: 281mm;
          min-height: 0;
          margin: 0;
          padding: 0;
          box-shadow: none;
          overflow: hidden;
        }

        .assetReportInner {
          height: 281mm;
          min-height: 0;
          padding-bottom: 21mm;
        }

        .assetReportHeader {
          grid-template-columns: 22mm minmax(0, 1fr) 62mm;
        }

        .assetReportOverview,
        .assetReportContentGrid {
          grid-template-columns: minmax(0, 1fr) 62mm;
        }

        .assetReportTechnical .assetReportRows {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetReportScreenBar">
      <div class="assetReportScreenText">Save or print this estimate report. In the print dialog, choose <strong>Save as PDF</strong>.</div>
      <div class="assetReportScreenActions">
        <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Save PDF / Print</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap"><img class="assetReportLogo" src="${escapeHtml(payload.logoUrl)}" alt="Aim4price logo" /></div>
          <div class="assetReportDocumentTitle">
            <strong>Asset Estimate Report</strong>
            <span>Aim4price estimate report</span>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(payload.generatedLabel)}</strong></div>
            <div class="assetReportMetaLine"><span>Email</span><strong>${escapeHtml(AIM4PRICE_EMAIL)}</strong></div>
          </div>
        </header>

        <section class="assetReportOverview">
          <div class="assetReportIdentity">
            <p class="assetReportKicker">${escapeHtml(payload.assetBadge || 'Asset')}</p>
            <h1 class="assetReportTitle">${safeTitle}</h1>
            <p class="assetReportMeta">${escapeHtml(payload.heroMeta)}</p>
          </div>

          <aside class="assetReportValuationCard">
            <h2>Estimated Value</h2>
            <strong class="assetReportValue">${escapeHtml(payload.selectedValue)}</strong>
            <span class="assetReportVat">VAT excluded</span>
            <div class="assetReportValueMeta">
              <div><span>Generated</span><strong>${escapeHtml(payload.generatedLabel)}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetReportContentGrid">
          <div class="assetReportMainStack">
            <section class="assetReportSection assetReportTechnical">
              <h2>Asset Details</h2>
              ${renderReportRows(payload.assetDetailRows, 'No asset details available.')}
            </section>

            <section class="assetReportSection assetReportClientCard">
              <h2>Client / Asset Owner</h2>
              ${renderReportRows(payload.clientRows, 'No client details available.')}
            </section>
          </div>

          <aside class="assetReportSide">
            ${payload.saleabilityRows.length ? `
              <section class="assetReportSideCard assetReportRecordRows">
                <h2>Saleability</h2>
                ${renderReportRows(payload.saleabilityRows, 'No Saleability details available.')}
              </section>
            ` : ''}
            <section class="assetReportSideCard assetReportRecordRows">
              <h2>Record Summary</h2>
              ${renderReportRows(payload.recordRows, 'No record details available.')}
            </section>
          </aside>
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">${escapeHtml(FOOTER_DISCLAIMER)}</div>
          </div>
          <div class="assetReportPageNumber">Page 1 of 1</div>
        </footer>
      </div>
    </main>

    <script>
      (function () {
        function waitForImages() {
          var images = Array.prototype.slice.call(document.images || []);
          if (!images.length) {
            return Promise.resolve();
          }

          return Promise.all(images.map(function (image) {
            if (image.complete) {
              return Promise.resolve();
            }

            return new Promise(function (resolve) {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          }));
        }

        function waitForFonts() {
          if (document.fonts && document.fonts.ready) {
            return Promise.race([
              document.fonts.ready.catch(function () { return undefined; }),
              new Promise(function (resolve) { window.setTimeout(resolve, 900); }),
            ]);
          }

          return Promise.resolve();
        }

        function openPrintDialog() {
          Promise.all([waitForImages(), waitForFonts()]).then(function () {
            window.setTimeout(function () {
              window.focus();
              window.print();
            }, 250);
          });
        }

        if (document.readyState === 'complete') {
          openPrintDialog();
        } else {
          window.addEventListener('load', openPrintDialog, { once: true });
        }
      })();
    </script>
  </body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const rawPayload = await readRequestPayload(request);
    const logoUrl = await getValuationReportLogoUrl(request);
    const payload = normalizePayload(rawPayload, logoUrl);
    const html = renderValuationReportHtml(payload);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${payload.fileName.replace(/\.pdf$/i, '.html')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('valuation report failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create estimate PDF report.' },
      { status: 400 },
    );
  }
}
