export type ReportTone = 'high' | 'medium' | 'low';

export type ReportKeyValue = {
  label: string;
  value: string;
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
  status: string;
};

export type AssetRegisterSummaryPayload = {
  logoUrl: string;
  generatedAt: string;
  ownerName: string;
  ownerMeta: string;
  intro: string;
  stats: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.95rem 1.15rem;
        background: rgba(255, 255, 255, 0.92);
        border-bottom: 1px solid rgba(17, 56, 45, 0.08);
        backdrop-filter: blur(14px);
      }

      .screenBarText {
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.45;
      }

      .screenBarActions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .screenButton {
        appearance: none;
        border: 1px solid rgba(16, 56, 47, 0.1);
        border-radius: 999px;
        background: var(--paper);
        color: var(--text);
        min-height: 2.8rem;
        padding: 0 1rem;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .screenButtonPrimary {
        color: #ffffff;
        background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-mid) 100%);
        border-color: transparent;
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
      <div class="screenBarText">Choose <strong>Save as PDF</strong> in the print dialog to create the final PDF file.</div>
      <div class="screenBarActions">
        <button type="button" class="screenButton" onclick="window.close()">Close</button>
        <button type="button" class="screenButton screenButtonPrimary" onclick="window.print()">Print / Save PDF</button>
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

function openPrintWindow(title: string, html: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;
  return true;
}

function renderLogoBlock(logoUrl: string, documentLabel: string): string {
  return `
    <div class="brandLockup">
      <img class="logo" src="${escapeHtml(logoUrl)}" alt="Aim4price" />
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.95rem 1.2rem;
        border-bottom: 1px solid rgba(16, 56, 47, 0.08);
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(12px);
      }

      .screenText {
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.45;
      }

      .screenActions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .screenButton {
        appearance: none;
        border: 1px solid rgba(16, 56, 47, 0.1);
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        min-height: 2.7rem;
        padding: 0 1rem;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .screenButtonPrimary {
        border-color: transparent;
        background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-mid) 55%, var(--brand-blue) 100%);
        color: #ffffff;
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
          flex-direction: column;
          align-items: stretch;
        }

        .screenActions {
          width: 100%;
        }

        .screenButton {
          flex: 1 1 0;
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
      <div class="screenText">Choose <strong>Save as PDF</strong> in the print dialog to create the final valuation PDF.</div>
      <div class="screenActions">
        <button type="button" class="screenButton" onclick="window.close()">Close</button>
        <button type="button" class="screenButton screenButtonPrimary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <div class="page">
      <header class="pageHeader">
        <img class="logo" src="${escapeHtml(payload.logoUrl)}" alt="Aim4price" />
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
  const visibleRows = rows.filter((row) => String(row.value ?? '').trim());

  if (!visibleRows.length) {
    return '';
  }

  return `
    <section class="assetReportSection assetReportNotesSection">
      <h2>Notes</h2>
      ${renderAssetReportRows(visibleRows, 'No notes saved.')}
    </section>
  `;
}

function renderAssetReportMedia(options: {
  photoUrls: string[];
  qrUrl?: string | null;
  scanUrl?: string | null;
  title: string;
}): string {
  const allPhotos = options.photoUrls.map((url) => String(url ?? '').trim()).filter(Boolean);
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

function renderAssetSheetDocument(payload: AssetSheetPayload): string {
  const rawPhotoUrls = payload.photoUrls?.length ? payload.photoUrls : payload.photoUrl ? [payload.photoUrl] : [];
  const photoUrls = rawPhotoUrls.map((url) => String(url ?? '').trim()).filter(Boolean);
  const safeTitle = escapeHtml(payload.heroTitle);
  const issuerName = String(payload.issuerName ?? '').trim() || 'Aim4price';
  const issuerAddress = String(payload.issuerAddress ?? '').trim();
  const issuerPhone = String(payload.issuerPhone ?? '').trim();
  const issuerEmail = String(payload.issuerEmail ?? '').trim();
  const updatedLabel = payload.statusLabel || getAssetSheetValue(payload.facts, 'Last Updated') || payload.generatedAt;
  const basisFromPayload = String(payload.valueNote ?? '').replace(/\s+value\s+basis\s*$/i, '').trim();
  const basisFromFacts = getAssetSheetValue(payload.facts, 'Value Basis');
  const valueBasis = basisFromPayload && !isBlankReportValue(basisFromPayload) ? basisFromPayload : basisFromFacts;
  const footerNote =
    payload.footerNote ??
    'Values are indicative estimates based on saved asset-register information and available pricing inputs. This is not a certified valuation, inspection report or guarantee of selling price. Final value remains subject to physical inspection, documentation, attachments, condition, location and live market demand.';
  const clientRows = (payload.clientRows?.length
    ? payload.clientRows
    : [
        { label: 'Name', value: '-' },
        { label: 'Email', value: '-' },
        { label: 'Phone', value: '-' },
      ]
  ).filter((row) => String(row.label ?? '').trim());
  const hiddenFactLabels = new Set(['value basis', 'last updated', 'serial number', 'insured', 'financed', 'documents']);
  const detailRows = payload.facts.filter((row) => !hiddenFactLabels.has(String(row.label ?? '').trim().toLowerCase()));
  const recordRows: ReportKeyValue[] = [
    { label: 'Serial Number', value: getAssetSheetValue(payload.facts, 'Serial Number') },
    { label: 'Insured', value: getAssetSheetValue(payload.facts, 'Insured') },
    { label: 'Financed', value: getAssetSheetValue(payload.facts, 'Financed') },
    { label: 'Documents', value: getAssetSheetValue(payload.facts, 'Documents') },
    { label: 'Updated', value: updatedLabel },
  ];
  const noteRows = [...(payload.contactRows ?? []), ...(payload.notes ?? [])].filter((row) => String(row.value ?? '').trim());
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
        --ink: #151923;
        --muted: #626b78;
        --soft: #f5f6f8;
        --soft-2: #fafafa;
        --line: #d7dde5;
        --line-dark: #bfc7d1;
        --black: #0b0f16;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: A4;
        margin: 9mm 10mm 8mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
        color: var(--ink);
        font-family: "Montserrat", "Segoe UI", Arial, Helvetica, sans-serif;
        font-size: 9.8px;
        line-height: 1.24;
      }

      .assetReportScreenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #d7dce2;
      }

      .assetReportScreenText {
        color: var(--muted);
        font-size: 13px;
      }

      .assetReportScreenActions {
        display: flex;
        gap: 10px;
      }

      .assetReportButton {
        appearance: none;
        min-height: 38px;
        padding: 0 16px;
        border: 1px solid #cfd5dd;
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      .assetReportButtonPrimary {
        border-color: var(--black);
        background: var(--black);
        color: #ffffff;
      }

      .assetReportPage {
        width: min(100%, 210mm);
        min-height: 297mm;
        margin: 18px auto;
        padding: 10mm 10mm 8mm;
        background: #ffffff;
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetReportInner {
        position: relative;
        min-height: calc(297mm - 18mm);
        padding-bottom: 18mm;
      }

      .assetReportHeader {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr) 62mm;
        gap: 12px;
        align-items: start;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
      }

      .assetReportLogo {
        display: block;
        width: 17mm;
        height: auto;
        object-fit: contain;
      }

      .assetReportDocumentTitle strong {
        display: block;
        color: var(--black);
        font-size: 14.2px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .assetReportDocumentTitle span {
        display: block;
        margin-top: 2px;
        color: var(--muted);
        font-size: 8.8px;
        font-weight: 500;
      }

      .assetReportHeaderMeta {
        display: grid;
        gap: 3px;
        color: var(--muted);
        font-size: 8.4px;
      }

      .assetReportMetaLine {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr);
        gap: 7px;
        align-items: baseline;
      }

      .assetReportMetaLine span {
        color: var(--muted);
        font-weight: 500;
      }

      .assetReportMetaLine strong {
        color: var(--black);
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportTopGrid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 61mm;
        gap: 11px;
        align-items: start;
        margin-top: 11px;
      }

      .assetReportIdentity {
        min-width: 0;
        padding: 10px 11px;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      .assetReportKicker {
        margin: 0 0 5px;
        color: var(--muted);
        font-size: 8.3px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .assetReportTitle {
        margin: 0;
        color: var(--black);
        font-size: 20px;
        line-height: 1.04;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .assetReportMeta {
        margin: 5px 0 0;
        color: #3f4652;
        font-size: 9.6px;
        font-weight: 600;
      }

      .assetReportValuationCard {
        padding: 10px 11px;
        border: 1px solid var(--line-dark);
        background: var(--soft-2);
      }

      .assetReportValuationCard h2 {
        margin: 0 0 5px;
        color: #2b313b;
        font-size: 9px;
        line-height: 1.1;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .assetReportValue {
        display: block;
        margin: 0;
        color: var(--black);
        font-size: 28px;
        line-height: 0.98;
        font-weight: 800;
        letter-spacing: -0.055em;
      }

      .assetReportVat {
        display: block;
        margin-top: 3px;
        color: var(--muted);
        font-size: 8.7px;
        font-weight: 500;
      }

      .assetReportValueMeta {
        display: grid;
        gap: 3px;
        margin-top: 9px;
        padding-top: 7px;
        border-top: 1px solid var(--line);
      }

      .assetReportValueMeta div,
      .assetReportRecordRows .assetReportRow {
        display: grid;
        grid-template-columns: 20mm minmax(0, 1fr);
        gap: 7px;
        min-height: 15px;
        align-items: baseline;
      }

      .assetReportValueMeta span,
      .assetReportRecordRows .assetReportRow span {
        color: var(--muted);
        font-size: 8.2px;
        font-weight: 600;
      }

      .assetReportValueMeta strong,
      .assetReportRecordRows .assetReportRow strong {
        color: var(--black);
        font-size: 8.4px;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportMainGrid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 61mm;
        gap: 11px;
        align-items: start;
        margin-top: 10px;
      }

      .assetReportSection,
      .assetReportSideCard {
        break-inside: avoid;
      }

      .assetReportSection {
        margin-bottom: 10px;
      }

      .assetReportSection h2,
      .assetReportSideCard h2 {
        margin: 0 0 6px;
        color: var(--black);
        font-size: 10.5px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .assetReportRows {
        width: 100%;
      }

      .assetReportRow {
        display: grid;
        grid-template-columns: 28mm minmax(0, 1fr);
        min-height: 16px;
        align-items: baseline;
        border-bottom: 1px solid var(--line);
      }

      .assetReportRow span {
        color: #303744;
        font-size: 8.7px;
        font-weight: 600;
      }

      .assetReportRow strong {
        color: var(--black);
        font-size: 8.7px;
        font-weight: 700;
        word-break: break-word;
      }

      .assetReportTechnical .assetReportRows {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 10px;
      }

      .assetReportTechnical .assetReportRow {
        grid-template-columns: 20mm minmax(0, 1fr);
      }

      .assetReportEmpty {
        padding: 5px 0;
        color: var(--muted);
        font-size: 8.7px;
      }

      .assetReportSide {
        display: grid;
        gap: 9px;
      }

      .assetReportSideCard {
        padding: 9px;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      .assetReportRecordRows .assetReportRows {
        display: grid;
        gap: 0;
      }

      .assetReportRecordRows .assetReportRow {
        border-bottom: 1px solid var(--line);
      }

      .assetReportRecordRows .assetReportRow:last-child {
        border-bottom: 0;
      }

      .assetReportMediaCard {
        padding: 9px;
      }

      .assetReportMediaGrid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
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
        height: 22mm;
        object-fit: cover;
      }

      .assetReportMediaCount1 .assetReportMediaTile img {
        height: 43mm;
      }

      .assetReportMediaCount2 .assetReportMediaTile img {
        height: 22mm;
      }

      .assetReportMediaTile figcaption {
        display: none;
      }

      .assetReportMediaNote {
        margin: 5px 0 0;
        color: var(--muted);
        font-size: 7.5px;
        line-height: 1.2;
      }

      .assetReportNotesSection .assetReportRow {
        grid-template-columns: 28mm minmax(0, 1fr);
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
        border-top: 1px solid var(--line);
      }

      .assetReportPowered {
        margin: 0 0 3px;
        color: var(--black);
        font-size: 8.5px;
        font-weight: 600;
      }

      .assetReportDisclaimer {
        max-width: 166mm;
        color: #2f3742;
        font-size: 6.8px;
        line-height: 1.22;
        font-style: italic;
      }

      .assetReportPageNumber {
        color: var(--black);
        font-size: 8px;
        font-weight: 600;
        white-space: nowrap;
      }

      @media (max-width: 760px) {
        .assetReportPage {
          padding: 24px;
        }

        .assetReportHeader,
        .assetReportTopGrid,
        .assetReportMainGrid {
          grid-template-columns: 1fr;
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
          height: 280mm;
          min-height: 0;
          margin: 0;
          padding: 0;
          box-shadow: none;
          overflow: hidden;
        }

        .assetReportInner {
          height: 280mm;
          min-height: 0;
          padding-bottom: 18mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetReportScreenBar">
      <div class="assetReportScreenText">Choose <strong>Save as PDF</strong> in the print dialog to download this asset report.</div>
      <div class="assetReportScreenActions">
        <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div>${payload.logoUrl ? `<img class="assetReportLogo" src="${escapeHtml(payload.logoUrl)}" alt="Aim4price" />` : ''}</div>
          <div class="assetReportDocumentTitle">
            <strong>Asset Valuation Report</strong>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(payload.generatedAt)}</strong></div>
            ${issuerEmail ? `<div class="assetReportMetaLine"><span>Email</span><strong>${escapeHtml(issuerEmail)}</strong></div>` : ''}
            ${issuerPhone ? `<div class="assetReportMetaLine"><span>Phone</span><strong>${escapeHtml(issuerPhone)}</strong></div>` : ''}
          </div>
        </header>

        <section class="assetReportTopGrid">
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
              <div><span>Basis</span><strong>${escapeHtml(valueBasis)}</strong></div>
              <div><span>Updated</span><strong>${escapeHtml(updatedLabel)}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetReportMainGrid">
          <div>
            <section class="assetReportSection">
              <h2>Client / Asset Owner</h2>
              ${renderAssetReportRows(clientRows, 'No client details available.')}
            </section>

            <section class="assetReportSection assetReportTechnical">
              <h2>Asset Details</h2>
              ${renderAssetReportRows(detailRows, 'No asset details available.')}
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
    renderAssetSheetDocument(payload),
  );
}

export function openAssetRegisterSummaryPrint(payload: AssetRegisterSummaryPayload): boolean {
  const contentHtml = `
    <div class="page">
      <header class="pageHeader">
        ${renderLogoBlock(payload.logoUrl, 'Asset register summary')}
        <div class="documentMeta">
          <span class="documentMetaLabel">Generated</span>
          <span class="documentMetaValue">${escapeHtml(payload.generatedAt)}</span>
        </div>
      </header>

      <section class="hero">
        <div>
          <span class="documentKicker">Asset register</span>
          <h1 class="heroTitle">${escapeHtml(payload.ownerName)}</h1>
          <p class="heroMeta">${escapeHtml(payload.ownerMeta)}</p>
        </div>

        <aside class="heroValueCard">
          <span class="heroValueLabel">Document overview</span>
          <strong class="heroValueAmount">Short summary</strong>
          <div class="heroBadgeRow">
            <span class="heroBadge">Asset register</span>
            <span class="heroBadge">Excl. VAT values</span>
          </div>
          <div class="heroValueMeta">${escapeHtml(payload.intro)}</div>
        </aside>
      </section>

      <main class="content">
        <section class="statsGrid">
          ${payload.stats
            .map(
              (stat) => `
                <article class="statCard">
                  <strong class="statValue">${escapeHtml(stat.value)}</strong>
                  <span class="statLabel">${escapeHtml(stat.label)}</span>
                  ${stat.note ? `<span class="statNote">${escapeHtml(stat.note)}</span>` : ''}
                </article>
              `,
            )
            .join('')}
        </section>

        <section class="card">
          <h2 class="cardTitle">Register contents</h2>
          ${
            payload.rows.length
              ? `
                <div class="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Type</th>
                        <th>Method</th>
                        <th>Detail</th>
                        <th>Value</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${payload.rows
                        .map(
                          (row) => `
                            <tr>
                              <td><strong>${escapeHtml(row.asset)}</strong></td>
                              <td>${escapeHtml(row.type)}</td>
                              <td>${escapeHtml(row.method)}</td>
                              <td>${escapeHtml(row.detail)}</td>
                              <td><strong>${escapeHtml(row.value)}</strong></td>
                              <td>${escapeHtml(row.status)}</td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
              : '<div class="emptyState">No assets are currently saved in the register.</div>'
          }
        </section>
      </main>

      <footer class="footer">${escapeHtml(
        payload.footerNote ?? 'Aim4price asset register summary. All values shown exclude VAT.',
      )}</footer>
    </div>
  `;

  return openPrintWindow(
    `${payload.ownerName} - Aim4price asset register summary`,
    renderDocumentShell({
      title: `${payload.ownerName} - Aim4price asset register summary`,
      orientation: 'landscape',
      contentHtml,
    }),
  );
}
