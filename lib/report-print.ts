export type ReportTone = 'high' | 'medium' | 'low';

export type ReportKeyValue = {
  label: string;
  value: string;
  photoUrls?: string[];
};

export type ReportMethodCard = {
  label: string;
  value: string;
  note: string;
  selected?: boolean;
};

export type ValuationComparableRow = {
  value: string;
  sourceName: string;
  detail: string;
  location: string;
  advertised: string;
  sourceUrl?: string | null;
};


export type ValuationReportPayload = {
  logoUrl: string;
  generatedAt: string;
  heroTitle: string;
  heroMeta: string;
  selectedLabel: string;
  headlineValue: string;
  confidenceLabel: string;
  confidenceTone: ReportTone;
  summaryRows: ReportKeyValue[];
  footerNote?: string;
};


export type AssetSheetPayload = {
  logoUrl: string;
  generatedAt: string;
  assetBadge: string;
  heroTitle: string;
  heroMeta: string;
  valueLabel: string;
  value: string;
  valueNote: string;
  statusLabel: string;
  issuerName?: string;
  issuerAddress?: string;
  issuerPhone?: string;
  issuerEmail?: string;
  clientRows?: ReportKeyValue[];
  summaryItems?: ReportKeyValue[];
  photoUrl?: string | null;
  photoUrls?: string[] | null;
  qrUrl?: string | null;
  scanUrl?: string | null;
  facts: ReportKeyValue[];
  notes?: ReportKeyValue[];
  methodCards?: ReportMethodCard[];
  contactRows?: ReportKeyValue[];
  footerNote?: string;
};

export type AssetRegisterSummaryRow = {
  asset: string;
  type: string;
  method: string;
  detail: string;
  value: string;
  replacementPrice?: string;
  status: string;
  brand?: string;
  model?: string;
  year?: string;
  usage?: string;
  condition?: string;
  serial?: string;
  insured?: string;
  insuredValue?: string;
  financed?: string;
  licensed?: string;
  licenseRegistrationNumber?: string;
  documents?: string;
  updated?: string;
  photoUrl?: string | null;
};

export type AssetRegisterSummaryPayload = {
  logoUrl: string;
  generatedAt: string;
  reportTitle?: string;
  reportSubtitle?: string;
  valueLabel?: string;
  assetSectionTitle?: string;
  emptyStateMessage?: string;
  ownerName: string;
  ownerMeta: string;
  intro: string;
  registerValue?: string;
  registerValueNote?: string;
  ownerRows?: ReportKeyValue[];
  stats: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
  notes?: ReportKeyValue[];
  rows: AssetRegisterSummaryRow[];
  footerNote?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeHref(value?: string | null): string | null {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  if (/^(https?:|mailto:|tel:)/i.test(text)) {
    return text;
  }

  return null;
}

function renderDocumentShell(options: {
  title: string;
  orientation?: 'portrait' | 'landscape';
  contentHtml: string;
}): string {
  const orientation = options.orientation ?? 'portrait';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #edf2f0;
        --paper: #ffffff;
        --paper-soft: #f7faf8;
        --text: #12332b;
        --muted: #5d736d;
        --line: #d9e4df;
        --brand-dark: #10382f;
        --brand-mid: #1c5a4c;
        --brand-soft: #e8f4ef;
        --accent: #355fba;
      }

      * {
        box-sizing: border-box;
      }

      @page {
        size: A4${orientation === 'landscape' ? ' landscape' : ''};
        margin: 14mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .screenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.75rem 1rem;
        padding: 0.82rem clamp(0.85rem, 3vw, 1.2rem);
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid rgba(17, 56, 45, 0.1);
        box-shadow: 0 10px 28px rgba(15, 38, 31, 0.07);
        backdrop-filter: blur(14px);
      }

      .screenBarText {
        min-width: 0;
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.4;
      }

      .screenBarActions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.55rem;
        flex-wrap: nowrap;
      }

      .screenButton {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        border: 1px solid rgba(16, 56, 47, 0.14);
        border-radius: 999px;
        background: var(--paper);
        color: var(--text);
        min-height: 2.65rem;
        padding: 0 1rem;
        font: inherit;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
      }

      .screenButtonPrimary {
        min-width: 9.8rem;
        color: #ffffff;
        background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-mid) 100%);
        border-color: transparent;
        box-shadow: 0 12px 24px rgba(16, 56, 47, 0.18);
      }

      .screenButton:focus-visible {
        outline: 3px solid rgba(53, 95, 186, 0.22);
        outline-offset: 2px;
      }

      .page {
        width: min(100%, 1040px);
        margin: 1.25rem auto 2rem;
        background: var(--paper);
        border-radius: 1.8rem;
        overflow: hidden;
        box-shadow:
          0 24px 60px rgba(15, 38, 31, 0.08),
          0 10px 24px rgba(15, 38, 31, 0.04);
      }

      .pageHeader {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.25rem;
        padding: 1.75rem 2rem 1.15rem;
        border-bottom: 1px solid var(--line);
      }

      .brandLockup {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 0;
      }

      .logo {
        width: 178px;
        max-width: 42vw;
        height: auto;
        object-fit: contain;
      }

      .documentKicker {
        display: inline-flex;
        align-items: center;
        min-height: 1.8rem;
        padding: 0 0.78rem;
        border-radius: 999px;
        background: var(--brand-soft);
        color: var(--brand-mid);
        border: 1px solid rgba(28, 90, 76, 0.12);
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      .documentMeta {
        text-align: right;
        min-width: 12rem;
      }

      .documentMetaLabel {
        display: block;
        color: var(--muted);
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      .documentMetaValue {
        display: block;
        margin-top: 0.35rem;
        color: var(--text);
        font-size: 1rem;
        font-weight: 800;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(18rem, 0.85fr);
        gap: 1.25rem;
        padding: 1.55rem 2rem 1.7rem;
        background: linear-gradient(135deg, #0f332b 0%, #1d5a4b 55%, #2a6170 100%);
        color: #ffffff;
      }

      .heroTitle {
        margin: 0.7rem 0 0.55rem;
        font-size: clamp(2rem, 5vw, 3.15rem);
        line-height: 0.98;
        letter-spacing: -0.06em;
      }

      .heroMeta {
        margin: 0;
        max-width: 42rem;
        color: rgba(234, 245, 241, 0.9);
        font-size: 1rem;
        line-height: 1.7;
      }

      .heroValueCard {
        display: grid;
        gap: 0.85rem;
        align-content: start;
        padding: 1.2rem;
        border-radius: 1.35rem;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.14);
      }

      .heroValueLabel,
      .cardLabel {
        color: rgba(234, 245, 241, 0.86);
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .heroValueAmount {
        font-size: clamp(2rem, 4vw, 2.95rem);
        line-height: 0.94;
        letter-spacing: -0.055em;
        font-weight: 900;
      }

      .heroValueMeta {
        color: rgba(234, 245, 241, 0.82);
        font-size: 0.93rem;
        line-height: 1.55;
      }

      .heroBadgeRow {
        display: flex;
        gap: 0.55rem;
        flex-wrap: wrap;
      }

      .heroBadge {
        display: inline-flex;
        align-items: center;
        min-height: 1.9rem;
        padding: 0 0.8rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
        background: rgba(255, 255, 255, 0.14);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: #ffffff;
      }

      .heroBadge.tone-high {
        background: rgba(97, 221, 175, 0.18);
      }

      .heroBadge.tone-medium {
        background: rgba(255, 218, 107, 0.18);
      }

      .heroBadge.tone-low {
        background: rgba(255, 190, 160, 0.18);
      }

      .content {
        display: grid;
        gap: 1rem;
        padding: 1.2rem 2rem 2rem;
      }

      .gridTwo {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .card {
        border: 1px solid var(--line);
        border-radius: 1.3rem;
        background: var(--paper-soft);
        padding: 1.05rem 1.1rem;
        break-inside: avoid;
      }

      .cardTitle {
        margin: 0 0 0.85rem;
        color: var(--text);
        font-size: 1.12rem;
        font-weight: 850;
        letter-spacing: -0.03em;
      }

      .keyValueList {
        display: grid;
        gap: 0.8rem;
      }

      .keyValueRow {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.72rem;
        border-bottom: 1px solid rgba(17, 56, 45, 0.08);
      }

      .keyValueRow:last-child {
        padding-bottom: 0;
        border-bottom: 0;
      }

      .keyValueLabel {
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.5;
      }

      .keyValueValue {
        color: var(--text);
        font-size: 0.94rem;
        line-height: 1.5;
        font-weight: 700;
        text-align: right;
      }

      .methodGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.9rem;
      }

      .methodCard {
        border: 1px solid rgba(16, 56, 47, 0.08);
        border-radius: 1.25rem;
        background: #ffffff;
        padding: 1rem;
        break-inside: avoid;
      }

      .methodCardSelected {
        border-color: rgba(28, 90, 76, 0.26);
        box-shadow: inset 0 0 0 1px rgba(28, 90, 76, 0.08);
        background: linear-gradient(180deg, #ffffff 0%, #f5fbf8 100%);
      }

      .methodValue {
        display: block;
        margin-top: 0.5rem;
        color: var(--text);
        font-size: 1.25rem;
        line-height: 1.1;
        letter-spacing: -0.04em;
        font-weight: 900;
      }

      .methodNote {
        display: block;
        margin-top: 0.5rem;
        color: var(--muted);
        font-size: 0.88rem;
        line-height: 1.55;
      }

      .selectedPill {
        display: inline-flex;
        align-items: center;
        min-height: 1.8rem;
        padding: 0 0.72rem;
        margin-top: 0.65rem;
        border-radius: 999px;
        background: var(--brand-soft);
        color: var(--brand-mid);
        font-size: 0.75rem;
        font-weight: 800;
      }

      .statsGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .statCard {
        border: 1px solid var(--line);
        border-radius: 1.2rem;
        background: #ffffff;
        padding: 0.95rem 1rem;
      }

      .statValue {
        display: block;
        color: var(--text);
        font-size: 1.45rem;
        line-height: 1;
        font-weight: 900;
        letter-spacing: -0.04em;
      }

      .statLabel {
        display: block;
        margin-top: 0.35rem;
        color: var(--muted);
        font-size: 0.86rem;
        font-weight: 700;
      }

      .statNote {
        display: block;
        margin-top: 0.28rem;
        color: var(--muted);
        font-size: 0.8rem;
        line-height: 1.45;
      }

      .photoFrame {
        overflow: hidden;
        border-radius: 1.15rem;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      .photoFrame img {
        display: block;
        width: 100%;
        height: 19rem;
        object-fit: cover;
      }

      .tableWrap {
        overflow: hidden;
        border-radius: 1.25rem;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead {
        display: table-header-group;
      }

      th,
      td {
        padding: 0.85rem 0.95rem;
        border-bottom: 1px solid rgba(17, 56, 45, 0.08);
        text-align: left;
        vertical-align: top;
      }

      th {
        background: #f4f8f6;
        color: var(--muted);
        font-size: 0.74rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      td {
        color: var(--text);
        font-size: 0.9rem;
        line-height: 1.55;
      }

      tr:last-child td {
        border-bottom: 0;
      }

      .muted {
        color: var(--muted);
      }

      .link {
        color: var(--accent);
        text-decoration: none;
        word-break: break-all;
      }

      .emptyState {
        padding: 1rem;
        border-radius: 1rem;
        background: rgba(17, 56, 45, 0.04);
        color: var(--muted);
      }

      .footer {
        padding: 0 2rem 2rem;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.65;
      }

      @media (max-width: 860px) {
        .pageHeader,
        .hero,
        .content,
        .footer {
          padding-left: 1.2rem;
          padding-right: 1.2rem;
        }

        .pageHeader,
        .hero,
        .gridTwo,
        .methodGrid,
        .statsGrid {
          grid-template-columns: 1fr;
        }

        .documentMeta {
          text-align: left;
          min-width: 0;
        }

        .screenBar {
          grid-template-columns: 1fr;
          padding: 0.72rem 0.8rem 0.78rem;
        }

        .screenBarText {
          font-size: 0.82rem;
        }

        .screenBarActions {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
          width: 100%;
          gap: 0.5rem;
        }

        .screenButton {
          width: 100%;
          min-height: 2.7rem;
          padding: 0 0.65rem;
          font-size: 0.85rem;
        }

        .screenButtonPrimary {
          min-width: 0;
        }
      }

      @media (max-width: 380px) {
        .screenBarActions {
          grid-template-columns: 1fr;
        }
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .screenBar {
          display: none !important;
        }

        .page {
          width: auto;
          margin: 0;
          border-radius: 0;
          box-shadow: none;
        }

        a {
          color: inherit;
          text-decoration: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="screenBar">
      <div class="screenBarText">Save or print this report. In the print dialog, choose <strong>Save as PDF</strong>.</div>
      <div class="screenBarActions">
        <button type="button" class="screenButton" onclick="window.close()">Close</button>
        <button type="button" class="screenButton screenButtonPrimary" onclick="window.print()">Save PDF / Print</button>
      </div>
    </div>
    ${options.contentHtml}
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

        function openPrintDialog() {
          waitForImages().then(function () {
            window.setTimeout(function () {
              window.focus();
              window.print();
            }, 220);
          });
        }

        if (document.readyState === 'complete') {
          openPrintDialog();
        } else {
          window.addEventListener('load', openPrintDialog, { once: true });
        }

        window.addEventListener('afterprint', function () {
          window.setTimeout(function () {
            window.close();
          }, 120);
        });
      })();
    </script>
  </body>
</html>`;
}

export function writeCanonicalReportHtml(
  reportWindow: Window | null,
  title: string,
  html: string,
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!reportWindow) {
    return false;
  }

  reportWindow.opener = null;
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.document.title = title;
  return true;
}

export function openCanonicalReportHtml(title: string, html: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return writeCanonicalReportHtml(window.open('', '_blank'), title, html);
}

function openPrintWindow(title: string, html: string): boolean {
  return openCanonicalReportHtml(title, html);
}

function renderLogoBlock(logoUrl: string, documentLabel: string): string {
  return `
    <div class="brandLockup">
      ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo" />` : ''}
      <div>
        <span class="documentKicker">${escapeHtml(documentLabel)}</span>
      </div>
    </div>
  `;
}

function renderKeyValueRows(rows: ReportKeyValue[]): string {
  if (!rows.length) {
    return '<div class="emptyState">Nothing to show here yet.</div>';
  }

  return `
    <div class="keyValueList">
      ${rows
        .map(
          (row) => `
            <div class="keyValueRow">
              <span class="keyValueLabel">${escapeHtml(row.label)}</span>
              <span class="keyValueValue">${escapeHtml(row.value)}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderMethodCards(cards: ReportMethodCard[]): string {
  if (!cards.length) {
    return '<div class="emptyState">No valuation methods were available for this document.</div>';
  }

  return `
    <div class="methodGrid">
      ${cards
        .map(
          (card) => `
            <article class="methodCard${card.selected ? ' methodCardSelected' : ''}">
              <span class="cardLabel">${escapeHtml(card.label)}</span>
              <strong class="methodValue">${escapeHtml(card.value)}</strong>
              <span class="methodNote">${escapeHtml(card.note)}</span>
              ${card.selected ? '<span class="selectedPill">Selected for this report</span>' : ''}
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}


function renderValuationReportDocument(payload: ValuationReportPayload): string {
  const toneClass = payload.confidenceTone === 'high'
    ? 'toneHigh'
    : payload.confidenceTone === 'medium'
      ? 'toneMedium'
      : 'toneLow';

  const summaryHtml = payload.summaryRows.length
    ? payload.summaryRows
        .map(
          (row) => `
            <div class="summaryRow">
              <span class="summaryLabel">${escapeHtml(row.label)}</span>
              <span class="summaryValue">${escapeHtml(row.value)}</span>
            </div>
          `,
        )
        .join('')
    : '<div class="emptyState">No machine details were available for this report.</div>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.heroTitle)} - Aim4price valuation report</title>
    <style>
      :root {
        color-scheme: light;
        --page-bg: #eef3f1;
        --paper: #ffffff;
        --ink: #0f2f27;
        --muted: #627770;
        --line: #dbe6e1;
        --brand-dark: #10382f;
        --brand-mid: #1b5a4a;
        --brand-blue: #305f97;
        --soft: #f5f8f7;
        --chip: #edf4f1;
      }

      * { box-sizing: border-box; }

      @page {
        size: A4;
        margin: 14mm;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: var(--page-bg);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .screenBar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.75rem 1rem;
        padding: 0.82rem clamp(0.85rem, 3vw, 1.2rem);
        border-bottom: 1px solid rgba(16, 56, 47, 0.1);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 10px 28px rgba(15, 42, 34, 0.07);
        backdrop-filter: blur(12px);
      }

      .screenText {
        min-width: 0;
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.4;
      }

      .screenActions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.55rem;
        flex-wrap: nowrap;
      }

      .screenButton {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        border: 1px solid rgba(16, 56, 47, 0.14);
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        min-height: 2.65rem;
        padding: 0 1rem;
        font: inherit;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
      }

      .screenButtonPrimary {
        min-width: 9.8rem;
        border-color: transparent;
        background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-mid) 55%, var(--brand-blue) 100%);
        color: #ffffff;
        box-shadow: 0 12px 24px rgba(16, 56, 47, 0.18);
      }

      .screenButton:focus-visible {
        outline: 3px solid rgba(48, 95, 151, 0.22);
        outline-offset: 2px;
      }

      .page {
        width: min(100%, 920px);
        margin: 1.2rem auto 2rem;
        background: var(--paper);
        border-radius: 1.9rem;
        overflow: hidden;
        box-shadow:
          0 28px 60px rgba(15, 42, 34, 0.08),
          0 12px 24px rgba(15, 42, 34, 0.05);
      }

      .pageHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 1.55rem 1.8rem 1.2rem;
        border-bottom: 1px solid var(--line);
      }

      .logo {
        width: 210px;
        max-width: 48vw;
        height: auto;
        object-fit: contain;
      }

      .generatedBlock {
        text-align: right;
      }

      .generatedLabel {
        display: block;
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .generatedValue {
        display: block;
        margin-top: 0.28rem;
        font-size: 1rem;
        font-weight: 800;
        color: var(--ink);
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
        gap: 1.15rem;
        padding: 1.5rem 1.8rem 1.35rem;
        background: linear-gradient(135deg, var(--brand-dark) 0%, #15483c 44%, var(--brand-blue) 100%);
        color: #ffffff;
      }

      .heroKicker {
        display: inline-flex;
        align-items: center;
        min-height: 1.85rem;
        padding: 0 0.78rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.14);
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      .heroTitle {
        margin: 0.9rem 0 0;
        font-size: 2.2rem;
        line-height: 1.04;
        letter-spacing: -0.03em;
      }

      .heroMeta {
        margin: 0.75rem 0 0;
        max-width: 34rem;
        color: rgba(255, 255, 255, 0.82);
        font-size: 1rem;
        line-height: 1.65;
      }

      .heroLead {
        margin: 1rem 0 0;
        max-width: 31rem;
        color: rgba(255, 255, 255, 0.78);
        font-size: 0.95rem;
        line-height: 1.68;
      }

      .valueCard {
        align-self: stretch;
        display: grid;
        gap: 0.65rem;
        padding: 1.3rem 1.35rem;
        border-radius: 1.4rem;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 250, 249, 0.98) 100%);
        color: var(--ink);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.94),
          0 14px 28px rgba(12, 42, 34, 0.12);
      }

      .valueLabel {
        color: var(--muted);
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .valueAmount {
        font-size: 2.95rem;
        line-height: 0.95;
        letter-spacing: -0.045em;
        color: #0f382f;
      }

      .badgeRow {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        min-height: 1.9rem;
        padding: 0 0.78rem;
        border-radius: 999px;
        background: var(--chip);
        border: 1px solid rgba(17, 56, 45, 0.08);
        color: var(--ink);
        font-size: 0.8rem;
        font-weight: 700;
      }

      .toneHigh {
        background: #e3f3ea;
        color: #0f6a46;
        border-color: rgba(15, 106, 70, 0.12);
      }

      .toneMedium {
        background: #fff1cd;
        color: #8a6500;
        border-color: rgba(138, 101, 0, 0.12);
      }

      .toneLow {
        background: #fde1de;
        color: #a3271b;
        border-color: rgba(163, 39, 27, 0.12);
      }

      .valueMeta {
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.6;
      }

      .content {
        padding: 1.45rem 1.8rem 1.6rem;
      }

      .summaryCard {
        border: 1px solid var(--line);
        border-radius: 1.45rem;
        background: linear-gradient(180deg, #ffffff 0%, var(--soft) 100%);
        overflow: hidden;
      }

      .summaryHead {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 1.2rem 1.3rem 1rem;
        border-bottom: 1px solid rgba(16, 56, 47, 0.08);
      }

      .summaryTitle {
        margin: 0;
        font-size: 1.14rem;
        line-height: 1.2;
      }

      .summaryCaption {
        margin-top: 0.32rem;
        color: var(--muted);
        font-size: 0.92rem;
      }

      .summaryGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .summaryRow {
        display: grid;
        gap: 0.26rem;
        padding: 1rem 1.3rem;
        border-top: 1px solid rgba(16, 56, 47, 0.08);
      }

      .summaryRow:nth-child(odd) {
        border-right: 1px solid rgba(16, 56, 47, 0.08);
      }

      .summaryLabel {
        color: var(--muted);
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .summaryValue {
        font-size: 1.02rem;
        line-height: 1.45;
        color: var(--ink);
        font-weight: 700;
      }

      .footer {
        padding: 1rem 1.8rem 1.45rem;
        color: var(--muted);
        font-size: 0.84rem;
        line-height: 1.55;
      }

      .emptyState {
        padding: 1.1rem 1.3rem;
        color: var(--muted);
        font-size: 0.95rem;
        line-height: 1.55;
      }

      @media (max-width: 760px) {
        .screenBar {
          grid-template-columns: 1fr;
          padding: 0.72rem 0.8rem 0.78rem;
        }

        .screenText {
          font-size: 0.82rem;
        }

        .screenActions {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
          width: 100%;
          gap: 0.5rem;
        }

        .screenButton {
          width: 100%;
          min-height: 2.7rem;
          padding: 0 0.65rem;
          font-size: 0.85rem;
        }

        .screenButtonPrimary {
          min-width: 0;
        }

        .page {
          width: calc(100% - 1rem);
          margin: 0.5rem auto 1rem;
          border-radius: 1.15rem;
        }

        .pageHeader,
        .content,
        .footer {
          padding-left: 1rem;
          padding-right: 1rem;
        }

        .hero {
          grid-template-columns: 1fr;
          padding: 1.2rem 1rem;
        }

        .heroTitle {
          font-size: 1.7rem;
        }

        .valueAmount {
          font-size: 2.25rem;
        }

        .summaryGrid {
          grid-template-columns: 1fr;
        }

        .summaryRow:nth-child(odd) {
          border-right: none;
        }
      }

      @media (max-width: 380px) {
        .screenActions {
          grid-template-columns: 1fr;
        }
      }

      @media print {
        body {
          background: #ffffff;
        }

        .screenBar {
          display: none !important;
        }

        .page {
          width: auto;
          margin: 0;
          border-radius: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="screenBar">
      <div class="screenText">Save or print this valuation. In the print dialog, choose <strong>Save as PDF</strong>.</div>
      <div class="screenActions">
        <button type="button" class="screenButton" onclick="window.close()">Close</button>
        <button type="button" class="screenButton screenButtonPrimary" onclick="window.print()">Save PDF / Print</button>
      </div>
    </div>

    <div class="page">
      <header class="pageHeader">
        ${payload.logoUrl ? `<img class="logo" src="${escapeHtml(payload.logoUrl)}" alt="Logo" />` : ''}
        <div class="generatedBlock">
          <span class="generatedLabel">Generated</span>
          <span class="generatedValue">${escapeHtml(payload.generatedAt)}</span>
        </div>
      </header>

      <section class="hero">
        <div>
          <span class="heroKicker">Valuation report</span>
          <h1 class="heroTitle">${escapeHtml(payload.heroTitle)}</h1>
          <p class="heroMeta">${escapeHtml(payload.heroMeta)}</p>
          <p class="heroLead">A clean Aim4price valuation summary designed for quick internal review, client sharing, finance discussions, and record keeping.</p>
        </div>

        <aside class="valueCard">
          <span class="valueLabel">${escapeHtml(payload.selectedLabel)}</span>
          <strong class="valueAmount">${escapeHtml(payload.headlineValue)}</strong>
          <div class="badgeRow">
            <span class="badge ${toneClass}">${escapeHtml(payload.confidenceLabel)}</span>
            <span class="badge">Excl. VAT</span>
          </div>
          <div class="valueMeta">Selected Aim4price output for the current machine profile and saved input set.</div>
        </aside>
      </section>

      <main class="content">
        <section class="summaryCard">
          <div class="summaryHead">
            <div>
              <h2 class="summaryTitle">Machine summary</h2>
              <div class="summaryCaption">Core equipment details used for the selected valuation output.</div>
            </div>
          </div>
          <div class="summaryGrid">
            ${summaryHtml}
          </div>
        </section>
      </main>

      <footer class="footer">${escapeHtml(
        payload.footerNote ?? 'Aim4price valuation report. All values shown exclude VAT and should be used as a practical market guide.',
      )}</footer>
    </div>

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

        function openPrintDialog() {
          waitForImages().then(function () {
            window.setTimeout(function () {
              window.focus();
              window.print();
            }, 220);
          });
        }

        if (document.readyState === 'complete') {
          openPrintDialog();
        } else {
          window.addEventListener('load', openPrintDialog, { once: true });
        }

        window.addEventListener('afterprint', function () {
          window.setTimeout(function () {
            window.close();
          }, 120);
        });
      })();
    </script>
  </body>
</html>`;
}

export function openValuationReportPrint(payload: ValuationReportPayload): boolean {
  return openPrintWindow(
    `${payload.heroTitle} - Aim4price valuation report`,
    renderValuationReportDocument(payload),
  );
}

function getAssetSheetValue(rows: ReportKeyValue[], label: string): string {
  const normalizedLabel = label.trim().toLowerCase();
  const row = rows.find((entry) => entry.label.trim().toLowerCase() === normalizedLabel);
  const value = String(row?.value ?? '').trim();

  return value || '-';
}

function isBlankReportValue(value: string): boolean {
  const normalized = value.trim();

  return !normalized || normalized === '—' || normalized === '-';
}

function normalizeReportPhotoUrl(value: unknown): string {
  const rawUrl = String(value ?? '').trim();

  if (!rawUrl) {
    return '';
  }

  const url = rawUrl.startsWith('data:') ? rawUrl : rawUrl.slice(0, 2000);

  if (url.startsWith('/') && !url.startsWith('//') && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${url}`;
  }

  return url;
}

function reportRowPhotoUrls(row: ReportKeyValue, maxCount = 6): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const rawUrl of row.photoUrls ?? []) {
    const url = normalizeReportPhotoUrl(rawUrl);

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push(url);

    if (urls.length >= maxCount) {
      break;
    }
  }

  return urls;
}

function renderAssetReportNotePhotoGrid(photoUrls: string[], title: string): string {
  if (!photoUrls.length) {
    return '';
  }

  return `
    <div class="assetReportNotePhotoGrid" aria-label="Owner message photo attachments">
      ${photoUrls
        .map(
          (url, index) => `
            <figure>
              <img src="${escapeHtml(url)}" alt="${escapeHtml(`${title} owner message photo ${index + 1}`)}" />
              <figcaption>Attachment ${index + 1}</figcaption>
            </figure>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderFullRegisterNotePhotoGrid(photoUrls: string[], title: string): string {
  if (!photoUrls.length) {
    return '';
  }

  return `
    <div class="fullRegisterNotePhotoGrid" aria-label="Owner message photo attachments">
      ${photoUrls
        .map(
          (url, index) => `
            <figure>
              <img src="${escapeHtml(url)}" alt="${escapeHtml(`${title} owner message photo ${index + 1}`)}" />
              <figcaption>Attachment ${index + 1}</figcaption>
            </figure>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderAssetReportRows(rows: ReportKeyValue[], emptyLabel: string): string {
  const visibleRows = rows.filter((row) => String(row.label ?? '').trim());

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
              <strong>${escapeHtml(isBlankReportValue(String(row.value ?? '')) ? '-' : row.value)}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderAssetReportNotes(rows: ReportKeyValue[]): string {
  const visibleRows = rows.filter((row) => String(row.value ?? '').trim() || reportRowPhotoUrls(row).length);

  if (!visibleRows.length) {
    return '';
  }

  return `
    <section class="assetReportSection assetReportNotesSection">
      <h2>Notes</h2>
      <div class="assetReportNoteCards">
        ${visibleRows
          .map((row) => {
            const isOwnerMessage = String(row.label ?? '').trim().toLowerCase() === 'owner message';
            const notePhotoUrls = reportRowPhotoUrls(row);
            const noteText = String(row.value ?? '').trim();

            return `
              <article class="assetReportNoteCard${isOwnerMessage ? ' assetReportOwnerMessageCard' : ''}">
                <span>${escapeHtml(row.label)}</span>
                ${noteText ? `<strong>${escapeHtml(noteText)}</strong>` : ''}
                ${renderAssetReportNotePhotoGrid(notePhotoUrls, row.label)}
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderAssetReportMedia(options: {
  photoUrls: string[];
  qrUrl?: string | null;
  scanUrl?: string | null;
  title: string;
}): string {
  const allPhotos = options.photoUrls.map(normalizeReportPhotoUrl).filter(Boolean);
  const photos = allPhotos.slice(0, 2);
  const remainingPhotoCount = Math.max(0, allPhotos.length - photos.length);

  if (!photos.length) {
    return '';
  }

  return `
    <section class="assetReportSideCard assetReportMediaCard">
      <h2>Asset Photos</h2>
      <div class="assetReportMediaGrid assetReportMediaCount${photos.length}">
        ${photos
          .map(
            (url, index) => `
              <figure class="assetReportMediaTile${index === 0 ? ' assetReportMediaTilePrimary' : ''}">
                <img src="${escapeHtml(url)}" alt="${escapeHtml(`${options.title} photo ${index + 1}`)}" />
                <figcaption>Photo ${index + 1}</figcaption>
              </figure>
            `,
          )
          .join('')}
      </div>
      ${remainingPhotoCount ? `<p class="assetReportMediaNote">${remainingPhotoCount} additional photo${remainingPhotoCount === 1 ? '' : 's'} saved in the asset register.</p>` : ''}
    </section>
  `;
}

function renderAssetReportBreakdown(payload: AssetSheetPayload): string {
  const selectedCards = (payload.methodCards ?? []).filter((card) => card.selected);
  const otherCards = (payload.methodCards ?? []).filter((card) => !card.selected);
  const cards = [...selectedCards, ...otherCards];

  if (cards.length) {
    return cards
      .map(
        (card) => `
          <div class="assetReportBreakdownRow${card.selected ? ' assetReportBreakdownRowSelected' : ''}">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)}<small>VAT Excluded</small></strong>
          </div>
        `,
      )
      .join('');
  }

  return `
    <div class="assetReportBreakdownRow assetReportBreakdownRowSelected">
      <span>${escapeHtml(payload.assetBadge || 'Asset')}</span>
      <strong>${escapeHtml(payload.value)}<small>VAT Excluded</small></strong>
    </div>
  `;
}

export function buildAssetSheetReportHtml(payload: AssetSheetPayload): string {
  const rawPhotoUrls = payload.photoUrls?.length ? payload.photoUrls : payload.photoUrl ? [payload.photoUrl] : [];
  const photoUrls = rawPhotoUrls.map(normalizeReportPhotoUrl).filter(Boolean);
  const safeTitle = escapeHtml(payload.heroTitle);
  const issuerPhone = String(payload.issuerPhone ?? '').trim();
  const issuerEmail = String(payload.issuerEmail ?? '').trim();
  const updatedLabel = payload.statusLabel || getAssetSheetValue(payload.facts, 'Last Updated') || payload.generatedAt;
  const footerNote =
    payload.footerNote ??
    'Values are indicative estimates based on saved asset-register information and available pricing inputs. This is not a certified valuation, inspection report or guarantee of selling price. Final value remains subject to physical inspection, documentation, attachments, condition, location and live market demand.';
  const clientRows = (payload.clientRows?.length
    ? payload.clientRows
    : [
        { label: 'Business Name', value: '-' },
        { label: 'Contact Details', value: '-' },
        { label: 'Business Email', value: '-' },
        { label: 'Location / Address', value: '-' },
      ]
  ).filter((row) => String(row.label ?? '').trim());
  const hiddenFactLabels = new Set(['value basis', 'last updated', 'insured', 'financed', 'documents']);
  const detailRows = payload.facts.filter((row) => !hiddenFactLabels.has(String(row.label ?? '').trim().toLowerCase()));
  const recordRows: ReportKeyValue[] = [
    { label: 'Insured', value: getAssetSheetValue(payload.facts, 'Insured') },
    { label: 'Financed', value: getAssetSheetValue(payload.facts, 'Financed') },
    { label: 'Documents', value: getAssetSheetValue(payload.facts, 'Documents') },
    { label: 'Updated', value: updatedLabel },
  ];
  const noteRows = (payload.notes ?? []).filter((row) => String(row.value ?? '').trim() || reportRowPhotoUrls(row).length);
  const photoSection = renderAssetReportMedia({ photoUrls, qrUrl: null, scanUrl: null, title: payload.heroTitle });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} - Aim4price asset report</title>
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

      .assetReportMediaCard {
        padding: 10px;
      }

      .assetReportMediaGrid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 7px;
      }

      .assetReportMediaTile {
        min-width: 0;
        margin: 0;
        overflow: hidden;
        border: 1px solid var(--line);
        background: var(--soft);
      }

      .assetReportMediaTile img {
        display: block;
        width: 100%;
        height: 23mm;
        object-fit: cover;
      }

      .assetReportMediaCount1 .assetReportMediaTile img {
        height: 45mm;
      }

      .assetReportMediaCount2 .assetReportMediaTile img {
        height: 23mm;
      }

      .assetReportMediaTile figcaption {
        display: none;
      }

      .assetReportMediaNote {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 7.4px;
        line-height: 1.25;
      }

      .assetReportNotesSection {
        padding: 11px 12px 12px;
      }

      .assetReportNoteCards {
        display: grid;
        gap: 7px;
      }

      .assetReportNoteCard {
        min-height: 20mm;
        display: grid;
        align-content: start;
        gap: 5px;
        padding: 7px 8px;
        border: 1px solid var(--line);
        background: var(--soft-2);
        break-inside: avoid;
      }

      .assetReportNoteCard span {
        color: #38404c;
        font-size: 8.3px;
        line-height: 1.25;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .assetReportNoteCard strong {
        color: var(--strong);
        font-size: 9.2px;
        line-height: 1.55;
        font-weight: 650;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .assetReportOwnerMessageCard {
        min-height: 28mm;
      }

      .assetReportNotePhotoGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin-top: 2px;
      }

      .assetReportNotePhotoGrid figure {
        overflow: hidden;
        margin: 0;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      .assetReportNotePhotoGrid img {
        display: block;
        width: 100%;
        height: 22mm;
        object-fit: cover;
      }

      .assetReportNotePhotoGrid figcaption {
        display: block;
        padding: 3px 4px;
        color: var(--muted);
        font-size: 6.8px;
        line-height: 1.15;
        font-weight: 700;
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
      <div class="assetReportScreenText">Save or print this asset report. In the print dialog, choose <strong>Save as PDF</strong>.</div>
      <div class="assetReportScreenActions">
        <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Save PDF / Print</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap">${payload.logoUrl ? `<img class="assetReportLogo" src="${escapeHtml(payload.logoUrl)}" alt="Logo" />` : ''}</div>
          <div class="assetReportDocumentTitle">
            <strong>Asset Valuation Report</strong>
            <span>Aim4price asset register</span>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(payload.generatedAt)}</strong></div>
            ${issuerEmail ? `<div class="assetReportMetaLine"><span>Email</span><strong>${escapeHtml(issuerEmail)}</strong></div>` : ''}
            ${issuerPhone ? `<div class="assetReportMetaLine"><span>Phone</span><strong>${escapeHtml(issuerPhone)}</strong></div>` : ''}
          </div>
        </header>

        <section class="assetReportOverview">
          <div class="assetReportIdentity">
            <p class="assetReportKicker">${escapeHtml(payload.assetBadge || 'Asset')}</p>
            <h1 class="assetReportTitle">${safeTitle}</h1>
            <p class="assetReportMeta">${escapeHtml(payload.heroMeta)}</p>
          </div>

          <aside class="assetReportValuationCard">
            <h2>${escapeHtml(payload.valueLabel || 'Estimated Value')}</h2>
            <strong class="assetReportValue">${escapeHtml(payload.value)}</strong>
            <span class="assetReportVat">VAT excluded</span>
            <div class="assetReportValueMeta">
              <div><span>Updated</span><strong>${escapeHtml(updatedLabel)}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetReportContentGrid">
          <div class="assetReportMainStack">
            <section class="assetReportSection assetReportTechnical">
              <h2>Asset Details</h2>
              ${renderAssetReportRows(detailRows, 'No asset details available.')}
            </section>

            <section class="assetReportSection assetReportClientCard">
              <h2>Client / Asset Owner</h2>
              ${renderAssetReportRows(clientRows, 'No client details available.')}
            </section>

            ${renderAssetReportNotes(noteRows)}
          </div>

          <aside class="assetReportSide">
            <section class="assetReportSideCard assetReportRecordRows">
              <h2>Record Summary</h2>
              ${renderAssetReportRows(recordRows, 'No record details available.')}
            </section>

            ${photoSection}
          </aside>
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">${escapeHtml(footerNote)}</div>
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

export function openAssetSheetPrint(payload: AssetSheetPayload): boolean {
  return openPrintWindow(
    `${payload.heroTitle} - Aim4price asset report`,
    buildAssetSheetReportHtml(payload),
  );
}

function sanitizeRegisterDisplayValue(value: unknown): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text && text !== '—' ? text : '-';
}

function renderFullRegisterMetaRows(rows: ReportKeyValue[]): string {
  const visibleRows = rows.filter((row) => String(row.label ?? '').trim());

  if (!visibleRows.length) {
    return '<div class="fullRegisterEmpty">No account details saved.</div>';
  }

  return visibleRows
    .map(
      (row) => `
        ${(() => {
          const normalizedLabel = String(row.label ?? '').trim().toLowerCase();
          const notePhotoUrls = reportRowPhotoUrls(row);
          const isTallRow = normalizedLabel === 'address' || normalizedLabel === 'owner message' || normalizedLabel === 'attached document' || normalizedLabel.includes('note') || normalizedLabel.includes('reply') || notePhotoUrls.length > 0;
          const rawValue = String(row.value ?? '').trim();
          const value = rawValue ? sanitizeRegisterDisplayValue(row.value) : '';

          return `
            <div class="fullRegisterMetaRow${isTallRow ? ' fullRegisterMetaRowTall' : ''}">
              <span>${escapeHtml(row.label)}</span>
              <div class="fullRegisterMetaValue">
                ${String(value ?? '').trim() ? `<strong>${escapeHtml(value)}</strong>` : ''}
                ${renderFullRegisterNotePhotoGrid(notePhotoUrls, row.label)}
              </div>
            </div>
          `;
        })()}
      `,
    )
    .join('');
}

function renderFullRegisterStats(payload: AssetRegisterSummaryPayload): string {
  const stats = payload.stats.filter((stat) => String(stat.label ?? '').trim()).slice(0, 8);

  if (!stats.length) {
    return '';
  }

  return `
    <section class="fullRegisterStatsGrid" aria-label="Asset register summary">
      ${stats
        .map(
          (stat) => `
            <article class="fullRegisterStatCard">
              <span>${escapeHtml(stat.label)}</span>
              <strong>${escapeHtml(stat.value)}</strong>
              ${stat.note ? `<small>${escapeHtml(stat.note)}</small>` : ''}
            </article>
          `,
        )
        .join('')}
    </section>
  `;
}

function renderFullRegisterNotes(rows: ReportKeyValue[]): string {
  const visibleRows = rows.filter((row) => String(row.label ?? '').trim() && (String(row.value ?? '').trim() || reportRowPhotoUrls(row).length));

  if (!visibleRows.length) {
    return '';
  }

  return `
    <section class="fullRegisterPanel fullRegisterNotesPanel">
      <div class="fullRegisterSectionTitle">
        <h2>Partner Notes / Replies</h2>
        <span>${escapeHtml(String(visibleRows.length))} ${visibleRows.length === 1 ? 'note' : 'notes'}</span>
      </div>
      <div class="fullRegisterNoteCards">
        ${visibleRows
          .map((row) => {
            const notePhotoUrls = reportRowPhotoUrls(row);
            const noteText = String(row.value ?? '').trim();

            return `
              <article class="fullRegisterNoteCard">
                <span>${escapeHtml(row.label)}</span>
                ${noteText ? `<strong>${escapeHtml(noteText)}</strong>` : ''}
                ${renderFullRegisterNotePhotoGrid(notePhotoUrls, row.label)}
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderFullRegisterAssetRows(rows: AssetRegisterSummaryRow[], emptyMessage?: string): string {
  if (!rows.length) {
    return `<div class="fullRegisterEmpty">${escapeHtml(emptyMessage || 'No assets are currently saved in this register.')}</div>`;
  }

  return `
    <div class="fullRegisterAssetList">
      ${rows
        .map((row, index) => {
          const title = sanitizeRegisterDisplayValue(row.asset);
          const photoUrl = normalizeReportPhotoUrl(row.photoUrl);
          const brand = sanitizeRegisterDisplayValue(row.brand);
          const model = sanitizeRegisterDisplayValue(row.model);
          const year = sanitizeRegisterDisplayValue(row.year);
          const usage = sanitizeRegisterDisplayValue(row.usage);
          const condition = sanitizeRegisterDisplayValue(row.condition);
          const serial = sanitizeRegisterDisplayValue(row.serial);
          const insured = sanitizeRegisterDisplayValue(row.insured);
          const insuredValue = sanitizeRegisterDisplayValue(row.insuredValue);
          const financed = sanitizeRegisterDisplayValue(row.financed);
          const licensed = sanitizeRegisterDisplayValue(row.licensed);
          const licenseRegistrationNumber = sanitizeRegisterDisplayValue(row.licenseRegistrationNumber);
          const documents = sanitizeRegisterDisplayValue(row.documents);
          const updated = sanitizeRegisterDisplayValue(row.updated || row.status);
          const method = sanitizeRegisterDisplayValue(row.method);
          const type = sanitizeRegisterDisplayValue(row.type);
          const value = sanitizeRegisterDisplayValue(row.value);
          const replacementPrice = sanitizeRegisterDisplayValue(row.replacementPrice);

          return `
            <article class="fullRegisterAssetCard">
              <div class="fullRegisterAssetMain">
                <div class="fullRegisterAssetThumb" aria-hidden="true">
                  ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(title)}" />` : `<span>${String(index + 1).padStart(2, '0')}</span>`}
                </div>

                <div class="fullRegisterAssetIdentity">
                  <span class="fullRegisterAssetType">${escapeHtml(type)}</span>
                  <h3>${escapeHtml(title)}</h3>
                  <div class="fullRegisterAssetMeta">
                    <span>Brand: <strong>${escapeHtml(brand)}</strong></span>
                    <span>Model: <strong>${escapeHtml(model)}</strong></span>
                    <span>Year: <strong>${escapeHtml(year)}</strong></span>
                  </div>
                </div>
              </div>

              <div class="fullRegisterAssetDetails">
                <div><span>Usage</span><strong>${escapeHtml(usage)}</strong></div>
                <div><span>Condition</span><strong>${escapeHtml(condition)}</strong></div>
                <div><span>Serial</span><strong>${escapeHtml(serial)}</strong></div>
              </div>

              <div class="fullRegisterAssetStatus">
                <div><span>Insured</span><strong>${escapeHtml(insured)}</strong></div>
                ${insuredValue !== '-' ? `<div><span>Insured value</span><strong>${escapeHtml(insuredValue)}</strong></div>` : ''}
                <div><span>Financed</span><strong>${escapeHtml(financed)}</strong></div>
                <div><span>Licensed</span><strong>${escapeHtml(licensed)}</strong></div>
                ${licenseRegistrationNumber !== '-' ? `<div><span>Registration</span><strong>${escapeHtml(licenseRegistrationNumber)}</strong></div>` : ''}
                <div><span>Documents</span><strong>${escapeHtml(documents)}</strong></div>
              </div>

              <div class="fullRegisterAssetValue">
                <span>Register value</span>
                <strong>${escapeHtml(value)}</strong>
                <small>VAT excluded</small>
                ${replacementPrice !== '-' ? `<b class="fullRegisterReplacementValue">Replacement: ${escapeHtml(replacementPrice)}</b>` : ''}
                <em>${escapeHtml(method)}</em>
                <i>${escapeHtml(updated)}</i>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

export function buildAssetRegisterSummaryReportHtml(payload: AssetRegisterSummaryPayload): string {
  const reportTitle = payload.reportTitle || 'Asset Register Report';
  const reportSubtitle = payload.reportSubtitle || 'Aim4price asset register';
  const valueLabel = payload.valueLabel || 'Register Value';
  const assetSectionTitle = payload.assetSectionTitle || 'Asset Register';
  const registerValue = payload.registerValue || payload.stats.find((stat) => stat.label.toLowerCase().includes('register value'))?.value || '-';
  const ownerRows = payload.ownerRows?.length
    ? payload.ownerRows
    : [
        { label: 'Account', value: payload.ownerName },
        { label: 'Details', value: payload.ownerMeta },
      ];
  const noteRows = payload.notes ?? [];
  const footerNote =
    payload.footerNote ??
    'Values are indicative estimates based on saved Aim4price asset-register information and available pricing inputs. Values exclude VAT unless stated otherwise. This is not a certified valuation, inspection report or guarantee of selling price. Final values remain subject to physical inspection, documents, attachments, condition, location and live market demand.';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.ownerName)} - ${escapeHtml(reportTitle)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --strong: #05070c;
        --muted: #5d6675;
        --faint: #8a94a3;
        --line: #c9d1db;
        --line-strong: #aeb8c6;
        --paper: #ffffff;
        --soft: #f6f7f9;
        --blue: #0f7bdc;
      }

      * {
        box-sizing: border-box;
      }

      @page {
        size: A4 landscape;
        margin: 8mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #e9edf2;
        color: var(--ink);
        font-family: Montserrat, Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .screenBar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.75rem 1rem;
        padding: 0.82rem clamp(0.85rem, 3vw, 1.2rem);
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #d6dce5;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.07);
        backdrop-filter: blur(14px);
      }

      .screenBarText {
        min-width: 0;
        color: #667085;
        font-size: 0.9rem;
        line-height: 1.4;
      }

      .screenBarActions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.55rem;
        flex-wrap: nowrap;
      }

      .screenButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: #ffffff;
        color: #101828;
        min-height: 2.65rem;
        padding: 0 1.1rem;
        font: inherit;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
      }

      .screenButtonPrimary {
        min-width: 9.8rem;
        background: #05070c;
        color: #ffffff;
        border-color: #05070c;
        box-shadow: 0 12px 24px rgba(5, 7, 12, 0.18);
      }

      .screenButton:focus-visible {
        outline: 3px solid rgba(16, 24, 40, 0.18);
        outline-offset: 2px;
      }

      .fullRegisterPage {
        width: 287mm;
        min-height: 202mm;
        margin: 14px auto;
        padding: 13mm 13mm 10mm;
        background: var(--paper);
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.14);
      }

      .fullRegisterHeader {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 14mm;
        padding-bottom: 7.5mm;
        border-bottom: 1px solid var(--line-strong);
      }

      .fullRegisterBrand {
        display: flex;
        align-items: center;
        gap: 5mm;
        min-width: 0;
      }

      .fullRegisterLogo {
        width: 22mm;
        height: 22mm;
        object-fit: contain;
        flex: 0 0 auto;
      }

      .fullRegisterTitleBlock h1 {
        margin: 0 0 1.5mm;
        color: var(--strong);
        font-size: 17pt;
        line-height: 1.04;
        font-weight: 800;
        letter-spacing: -0.05em;
      }

      .fullRegisterTitleBlock p {
        margin: 0;
        color: var(--muted);
        font-size: 8pt;
        line-height: 1.35;
        font-weight: 600;
      }

      .fullRegisterHeaderMeta {
        display: grid;
        grid-template-columns: auto auto;
        column-gap: 7mm;
        row-gap: 1.8mm;
        min-width: 80mm;
        font-size: 7.5pt;
      }

      .fullRegisterHeaderMeta span {
        color: var(--muted);
        font-weight: 600;
      }

      .fullRegisterHeaderMeta strong {
        color: var(--strong);
        font-weight: 800;
        text-align: right;
      }

      .fullRegisterHero {
        display: grid;
        grid-template-columns: minmax(0, 1.58fr) minmax(70mm, 0.68fr);
        gap: 5.5mm;
        margin-top: 5.5mm;
      }

      .fullRegisterPanel,
      .fullRegisterValuePanel,
      .fullRegisterStatCard,
      .fullRegisterAssetCard {
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .fullRegisterPanel {
        padding: 5.6mm;
      }

      .fullRegisterPanelLabel,
      .fullRegisterValuePanel span,
      .fullRegisterStatCard span,
      .fullRegisterAssetType,
      .fullRegisterSectionTitle span {
        display: block;
        color: #344054;
        font-size: 6.8pt;
        line-height: 1.2;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .fullRegisterOwnerName {
        margin: 2mm 0 1.5mm;
        color: var(--strong);
        font-size: 18pt;
        line-height: 1.04;
        font-weight: 800;
        letter-spacing: -0.055em;
      }

      .fullRegisterOwnerMeta {
        margin: 0;
        color: var(--muted);
        font-size: 8pt;
        line-height: 1.45;
        font-weight: 600;
        max-width: 142mm;
      }

      .fullRegisterIntro {
        margin: 2mm 0 0;
        color: #344054;
        font-size: 7.4pt;
        line-height: 1.45;
        font-weight: 600;
        max-width: 142mm;
      }

      .fullRegisterValuePanel {
        min-height: 34mm;
        padding: 6mm;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .fullRegisterValuePanel strong {
        display: block;
        margin: 2mm 0 1mm;
        color: var(--strong);
        font-size: 24pt;
        line-height: 0.95;
        font-weight: 800;
        letter-spacing: -0.07em;
      }

      .fullRegisterValuePanel small {
        color: var(--muted);
        font-size: 7.4pt;
        line-height: 1.45;
        font-weight: 600;
      }

      .fullRegisterStatsGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4mm;
        margin-top: 5mm;
      }

      .fullRegisterStatCard {
        min-height: 27mm;
        padding: 4.8mm;
      }

      .fullRegisterStatCard strong {
        display: block;
        margin-top: 2mm;
        color: var(--strong);
        font-size: 13pt;
        line-height: 1;
        font-weight: 800;
        letter-spacing: -0.045em;
      }

      .fullRegisterStatCard small {
        display: block;
        margin-top: 1.8mm;
        color: var(--muted);
        font-size: 6.9pt;
        line-height: 1.42;
        font-weight: 600;
      }

      .fullRegisterOwnerDetailsPanel {
        margin-top: 5.5mm;
        padding: 5.8mm 6.2mm 6.2mm;
      }

      .fullRegisterOwnerDetailsPanel .fullRegisterMetaRow {
        grid-template-columns: 36mm minmax(0, 1fr);
        min-height: 8.8mm;
      }

      .fullRegisterOwnerDetailsPanel .fullRegisterMetaRowTall {
        min-height: 14mm;
      }

      .fullRegisterNotesPanel {
        margin-top: 5.5mm;
        padding: 5.8mm 6.2mm 6.2mm;
      }

      .fullRegisterNoteCards {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4mm;
      }

      .fullRegisterNoteCard {
        min-height: 22mm;
        display: grid;
        align-content: start;
        gap: 2mm;
        padding: 4mm;
        border: 1px solid var(--line);
        background: var(--soft);
        break-inside: avoid;
      }

      .fullRegisterNoteCard span {
        color: #344054;
        font-size: 6.8pt;
        line-height: 1.2;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .fullRegisterNoteCard strong {
        color: var(--strong);
        font-size: 7.6pt;
        line-height: 1.5;
        font-weight: 650;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .fullRegisterNotePhotoGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 2mm;
        margin-top: 1mm;
      }

      .fullRegisterNotePhotoGrid figure {
        overflow: hidden;
        margin: 0;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      .fullRegisterNotePhotoGrid img {
        display: block;
        width: 100%;
        height: 24mm;
        object-fit: cover;
      }

      .fullRegisterNotePhotoGrid figcaption {
        display: block;
        padding: 1.1mm 1.3mm;
        color: var(--muted);
        font-size: 6.2pt;
        line-height: 1.15;
        font-weight: 700;
      }

      .fullRegisterAssetSection {
        margin-top: 5.5mm;
      }

      .fullRegisterSectionTitle {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 5mm;
        margin: 0 0 4mm;
      }

      .fullRegisterSectionTitle h2 {
        flex: 0 0 auto;
        margin: 0;
        color: var(--strong);
        font-size: 11pt;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.035em;
        white-space: nowrap;
      }

      .fullRegisterMetaRows {
        display: grid;
        gap: 0;
      }

      .fullRegisterMetaRow {
        display: grid;
        grid-template-columns: 30mm minmax(0, 1fr);
        min-height: 8mm;
        align-items: center;
        border-top: 1px solid var(--line);
        font-size: 7.4pt;
        line-height: 1.35;
      }

      .fullRegisterMetaRow:first-child {
        border-top: none;
      }

      .fullRegisterMetaRowTall {
        min-height: 12mm;
        align-items: start;
        padding-top: 1.8mm;
        padding-bottom: 1.8mm;
      }

      .fullRegisterMetaRow span {
        color: var(--muted);
        font-weight: 600;
      }

      .fullRegisterMetaRow strong {
        color: var(--strong);
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .fullRegisterMetaValue {
        display: grid;
        gap: 1.8mm;
        min-width: 0;
      }

      .fullRegisterAssetList {
        display: grid;
        gap: 3.8mm;
      }

      .fullRegisterAssetCard {
        display: grid;
        grid-template-columns: minmax(98mm, 1.35fr) minmax(56mm, 0.74fr) minmax(44mm, 0.56fr) minmax(50mm, 0.62fr);
        gap: 0;
        min-height: 34mm;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .fullRegisterAssetMain,
      .fullRegisterAssetDetails,
      .fullRegisterAssetStatus,
      .fullRegisterAssetValue {
        padding: 4mm 4.2mm;
        border-left: 1px solid var(--line);
      }

      .fullRegisterAssetMain {
        display: grid;
        grid-template-columns: 21mm minmax(0, 1fr);
        gap: 4.2mm;
        border-left: none;
        align-items: center;
      }

      .fullRegisterAssetThumb {
        width: 21mm;
        height: 21mm;
        border: 1px solid var(--line);
        background: var(--soft);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .fullRegisterAssetThumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .fullRegisterAssetThumb span {
        color: var(--faint);
        font-size: 7pt;
        font-weight: 800;
        letter-spacing: 0.08em;
      }

      .fullRegisterAssetIdentity h3 {
        margin: 1.5mm 0 1.8mm;
        color: var(--strong);
        font-size: 10.7pt;
        line-height: 1.12;
        font-weight: 800;
        letter-spacing: -0.045em;
        overflow-wrap: anywhere;
      }

      .fullRegisterAssetMeta {
        display: flex;
        flex-wrap: wrap;
        gap: 1.2mm 4mm;
        color: var(--muted);
        font-size: 6.9pt;
        line-height: 1.32;
        font-weight: 600;
        max-width: 100%;
      }

      .fullRegisterAssetMeta span {
        min-width: 0;
        max-width: 100%;
        overflow-wrap: anywhere;
      }

      .fullRegisterAssetMeta strong {
        color: var(--strong);
        font-weight: 800;
      }

      .fullRegisterAssetDetails,
      .fullRegisterAssetStatus {
        display: grid;
        gap: 1.85mm;
      }

      .fullRegisterAssetDetails div,
      .fullRegisterAssetStatus div {
        display: grid;
        grid-template-columns: 20mm minmax(0, 1fr);
        gap: 2.2mm;
        align-items: baseline;
        color: var(--muted);
        font-size: 6.9pt;
        line-height: 1.32;
        font-weight: 600;
      }

      .fullRegisterAssetStatus div {
        grid-template-columns: 19mm minmax(0, 1fr);
        gap: 2mm;
      }

      .fullRegisterAssetDetails span,
      .fullRegisterAssetStatus span {
        color: var(--muted);
      }

      .fullRegisterAssetDetails strong,
      .fullRegisterAssetStatus strong {
        color: var(--strong);
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .fullRegisterAssetValue {
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: right;
        min-width: 0;
      }

      .fullRegisterAssetValue span {
        color: var(--muted);
        font-size: 6.7pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .fullRegisterAssetValue strong {
        display: block;
        margin-top: 1.3mm;
        color: var(--strong);
        font-size: 12pt;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.045em;
        white-space: nowrap;
      }

      .fullRegisterAssetValue small,
      .fullRegisterAssetValue em,
      .fullRegisterAssetValue i {
        display: block;
        margin-top: 1.1mm;
        color: var(--muted);
        font-size: 6.55pt;
        line-height: 1.35;
        font-style: normal;
        font-weight: 600;
      }

      .fullRegisterReplacementValue {
        display: block;
        margin-top: 1.25mm;
        color: #103b31;
        font-size: 6.85pt;
        line-height: 1.35;
        font-style: normal;
        font-weight: 800;
      }

      .fullRegisterAssetValue em {
        color: var(--strong);
        font-weight: 800;
      }

      .fullRegisterAssetValue i {
        color: var(--faint);
      }

      .fullRegisterEmpty {
        border: 1px solid var(--line-strong);
        padding: 7mm;
        color: var(--muted);
        font-size: 8pt;
        font-weight: 600;
      }

      .fullRegisterFooter {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12mm;
        align-items: end;
        margin-top: 8mm;
        padding-top: 3.8mm;
        border-top: 1px solid var(--line-strong);
      }

      .fullRegisterPowered {
        margin: 0 0 1.5mm;
        color: var(--strong);
        font-size: 7.2pt;
        line-height: 1.2;
        font-weight: 800;
      }

      .fullRegisterDisclaimer {
        max-width: 218mm;
        color: #344054;
        font-size: 6.2pt;
        line-height: 1.45;
        font-weight: 500;
      }

      .fullRegisterFooterRight {
        color: var(--strong);
        font-size: 7pt;
        font-weight: 800;
        white-space: nowrap;
      }

      @media screen and (max-width: 980px) {
        .fullRegisterPage {
          width: calc(100% - 24px);
          padding: 28px;
          overflow-x: auto;
        }
      }

      @media screen and (max-width: 760px) {
        .screenBar {
          grid-template-columns: 1fr;
          padding: 0.72rem 0.8rem 0.78rem;
        }

        .screenBarText {
          font-size: 0.82rem;
        }

        .screenBarActions {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
          width: 100%;
          gap: 0.5rem;
        }

        .screenButton {
          width: 100%;
          min-height: 2.7rem;
          padding: 0 0.65rem;
          font-size: 0.85rem;
        }

        .screenButtonPrimary {
          min-width: 0;
        }
      }

      @media screen and (max-width: 380px) {
        .screenBarActions {
          grid-template-columns: 1fr;
        }
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .screenBar {
          display: none !important;
        }

        .fullRegisterPage {
          width: auto;
          min-height: auto;
          margin: 0;
          padding: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="screenBar">
      <div class="screenBarText">Save or print this asset register report. In the print dialog, choose <strong>Save as PDF</strong>.</div>
      <div class="screenBarActions">
        <button type="button" class="screenButton" onclick="window.close()">Close</button>
        <button type="button" class="screenButton screenButtonPrimary" onclick="window.print()">Save PDF / Print</button>
      </div>
    </div>

    <main class="fullRegisterPage">
      <header class="fullRegisterHeader">
        <div class="fullRegisterBrand">
          ${payload.logoUrl ? `<img class="fullRegisterLogo" src="${escapeHtml(payload.logoUrl)}" alt="Logo" />` : ''}
          <div class="fullRegisterTitleBlock">
            <h1>${escapeHtml(reportTitle)}</h1>
            <p>${escapeHtml(reportSubtitle)}</p>
          </div>
        </div>

        <div class="fullRegisterHeaderMeta">
          <span>Generated</span>
          <strong>${escapeHtml(payload.generatedAt)}</strong>
          <span>Assets</span>
          <strong>${escapeHtml(String(payload.rows.length))}</strong>
        </div>
      </header>

      <section class="fullRegisterHero">
        <div class="fullRegisterPanel">
          <span class="fullRegisterPanelLabel">Asset owner</span>
          <h2 class="fullRegisterOwnerName">${escapeHtml(payload.ownerName)}</h2>
          <p class="fullRegisterOwnerMeta">${escapeHtml(payload.ownerMeta)}</p>
          <p class="fullRegisterIntro">${escapeHtml(payload.intro)}</p>
        </div>

        <aside class="fullRegisterValuePanel">
          <span>${escapeHtml(valueLabel)}</span>
          <strong>${escapeHtml(registerValue)}</strong>
          <small>${escapeHtml(payload.registerValueNote || 'Total saved asset value - VAT excluded')}</small>
        </aside>
      </section>

      ${renderFullRegisterStats(payload)}

      <section class="fullRegisterPanel fullRegisterOwnerDetailsPanel">
        <div class="fullRegisterSectionTitle">
          <h2>Owner Details</h2>
        </div>
        <div class="fullRegisterMetaRows">${renderFullRegisterMetaRows(ownerRows)}</div>
      </section>

      ${renderFullRegisterNotes(noteRows)}

      <section class="fullRegisterPanel fullRegisterAssetSection">
        <div class="fullRegisterSectionTitle">
          <h2>${escapeHtml(assetSectionTitle)}</h2>
          <span>${escapeHtml(String(payload.rows.length))} ${payload.rows.length === 1 ? 'asset' : 'assets'}</span>
        </div>
        ${renderFullRegisterAssetRows(payload.rows, payload.emptyStateMessage)}
      </section>

      <footer class="fullRegisterFooter">
        <div>
          <p class="fullRegisterPowered">Powered by Aim4price.com</p>
          <div class="fullRegisterDisclaimer">${escapeHtml(footerNote)}</div>
        </div>
        <div class="fullRegisterFooterRight">${escapeHtml(reportTitle)}</div>
      </footer>
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

  return html;
}

export function openAssetRegisterSummaryPrint(payload: AssetRegisterSummaryPayload): boolean {
  return openPrintWindow(
    `${payload.ownerName} - Aim4price asset register report`,
    buildAssetRegisterSummaryReportHtml(payload),
  );
}

