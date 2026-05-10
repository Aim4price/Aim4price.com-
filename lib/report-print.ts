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
  photoUrl?: string | null;
  photoUrls?: string[] | null;
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

function renderAssetSheetFactCards(rows: ReportKeyValue[]): string {
  if (!rows.length) {
    return '<div class="assetSheetEmpty">No asset details were available for this sheet.</div>';
  }

  return `
    <div class="assetSheetFactGrid">
      ${rows
        .map(
          (row) => `
            <div class="assetSheetFactCard">
              <span class="assetSheetFactLabel">${escapeHtml(row.label)}</span>
              <strong class="assetSheetFactValue">${escapeHtml(row.value)}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderAssetSheetNotes(rows: ReportKeyValue[]): string {
  if (!rows.length) {
    return '';
  }

  return `
    <section class="assetSheetSection assetSheetAvoidBreak">
      <h2>Notes</h2>
      <div class="assetSheetNotes">
        ${rows
          .map(
            (row) => `
              <div class="assetSheetNote">
                <span>${escapeHtml(row.label)}</span>
                <p>${escapeHtml(row.value)}</p>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderAssetSheetPhotos(photoUrls: string[], title: string): string {
  if (!photoUrls.length) {
    return `
      <div class="assetSheetPhotoEmpty">
        <span>No photos saved</span>
        <small>Add photos to the asset register item to include them on this PDF.</small>
      </div>
    `;
  }

  return `
    <div class="assetSheetPhotoGrid${photoUrls.length === 1 ? ' assetSheetPhotoGridSingle' : ''}">
      ${photoUrls
        .map(
          (url, index) => `
            <figure class="assetSheetPhotoTile">
              <img src="${escapeHtml(url)}" alt="${escapeHtml(`${title} photo ${index + 1}`)}" />
              <figcaption>Photo ${index + 1}</figcaption>
            </figure>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderAssetSheetDocument(payload: AssetSheetPayload): string {
  const rawPhotoUrls = payload.photoUrls?.length ? payload.photoUrls : payload.photoUrl ? [payload.photoUrl] : [];
  const photoUrls = rawPhotoUrls
    .map((url) => String(url ?? '').trim())
    .filter(Boolean);
  const noteRows = [...(payload.contactRows ?? []), ...(payload.notes ?? [])].filter((row) => String(row.value ?? '').trim());
  const safeTitle = escapeHtml(payload.heroTitle);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} - Aim4price asset PDF</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');

      :root {
        color-scheme: light;
        --asset-bg: #eef4f2;
        --asset-paper: #ffffff;
        --asset-soft: #f6f9f8;
        --asset-soft-2: #edf4f1;
        --asset-text: #0b3028;
        --asset-muted: #61756f;
        --asset-line: #cddcd7;
        --asset-line-strong: #b9d0c8;
        --asset-brand: #0f372f;
        --asset-brand-2: #193f73;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: A4;
        margin: 12mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: var(--asset-bg);
        color: var(--asset-text);
        font-family: Montserrat, Arial, Helvetica, sans-serif;
      }

      body {
        min-height: 100vh;
      }

      .assetSheetScreenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 1.1rem;
        background: rgba(255, 255, 255, 0.94);
        border-bottom: 1px solid rgba(15, 55, 47, 0.1);
        backdrop-filter: blur(14px);
      }

      .assetSheetScreenText {
        color: var(--asset-muted);
        font-size: 0.86rem;
        line-height: 1.45;
      }

      .assetSheetScreenActions {
        display: flex;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .assetSheetButton {
        appearance: none;
        min-height: 2.65rem;
        padding: 0 1rem;
        border: 1px solid rgba(15, 55, 47, 0.14);
        border-radius: 999px;
        background: #ffffff;
        color: var(--asset-text);
        font: inherit;
        font-size: 0.86rem;
        font-weight: 800;
        cursor: pointer;
      }

      .assetSheetButtonPrimary {
        border-color: transparent;
        background: var(--asset-brand);
        color: #ffffff;
      }

      .assetSheetPage {
        width: min(100%, 1060px);
        margin: 1.25rem auto 2rem;
        padding: 0 1rem;
      }

      .assetSheetTopbar {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.85rem;
      }

      .assetSheetBrand {
        display: grid;
        gap: 0.15rem;
      }

      .assetSheetBrandName {
        color: var(--asset-brand);
        font-size: 1.55rem;
        line-height: 1;
        font-weight: 900;
        letter-spacing: -0.055em;
      }

      .assetSheetDocumentType {
        color: var(--asset-muted);
        font-size: 0.68rem;
        line-height: 1.4;
        font-weight: 800;
        letter-spacing: 0.11em;
        text-transform: uppercase;
      }

      .assetSheetGenerated {
        text-align: right;
        color: var(--asset-muted);
        font-size: 0.72rem;
        font-weight: 700;
        line-height: 1.45;
      }

      .assetSheetGenerated strong {
        display: block;
        color: var(--asset-text);
        font-size: 0.9rem;
        font-weight: 900;
      }

      .assetSheetCard {
        overflow: hidden;
        border: 1.5px solid var(--asset-line-strong);
        border-radius: 1.45rem;
        background: var(--asset-paper);
        box-shadow: 0 22px 48px rgba(15, 55, 47, 0.08);
      }

      .assetSheetHero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 1.2rem;
        align-items: start;
        padding: 1.35rem 1.45rem 1.05rem;
      }

      .assetSheetBadge {
        display: inline-flex;
        align-items: center;
        min-height: 1.65rem;
        padding: 0 0.75rem;
        border: 1px solid rgba(15, 55, 47, 0.12);
        border-radius: 999px;
        background: var(--asset-soft-2);
        color: var(--asset-brand);
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .assetSheetTitle {
        margin: 0.62rem 0 0.45rem;
        color: var(--asset-text);
        font-size: clamp(1.7rem, 4vw, 2.35rem);
        line-height: 1.03;
        font-weight: 900;
        letter-spacing: -0.06em;
      }

      .assetSheetMeta {
        margin: 0;
        color: var(--asset-muted);
        font-size: 0.92rem;
        font-weight: 750;
        line-height: 1.55;
      }

      .assetSheetValueBlock {
        min-width: 13rem;
        text-align: right;
      }

      .assetSheetValueLabel {
        display: block;
        color: var(--asset-muted);
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .assetSheetValue {
        display: block;
        margin-top: 0.35rem;
        color: var(--asset-text);
        font-size: clamp(1.75rem, 4vw, 2.45rem);
        line-height: 0.95;
        font-weight: 900;
        letter-spacing: -0.07em;
      }

      .assetSheetVat {
        display: block;
        margin-top: 0.35rem;
        color: var(--asset-muted);
        font-size: 0.72rem;
        font-weight: 900;
      }

      .assetSheetValueNote {
        display: inline-flex;
        margin-top: 0.75rem;
        padding: 0.42rem 0.65rem;
        border-radius: 999px;
        background: var(--asset-soft-2);
        color: var(--asset-brand);
        font-size: 0.72rem;
        font-weight: 850;
      }

      .assetSheetDivider {
        height: 1px;
        margin: 0 1.45rem;
        background: var(--asset-line);
      }

      .assetSheetMain {
        display: grid;
        grid-template-columns: minmax(16rem, 0.82fr) minmax(0, 1.18fr);
        gap: 1.15rem;
        padding: 1.15rem 1.45rem 1.35rem;
      }

      .assetSheetSection {
        min-width: 0;
      }

      .assetSheetSection h2 {
        margin: 0 0 0.7rem;
        color: var(--asset-text);
        font-size: 0.92rem;
        font-weight: 900;
        letter-spacing: -0.02em;
      }

      .assetSheetPhotoGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.65rem;
      }

      .assetSheetPhotoGridSingle {
        grid-template-columns: 1fr;
      }

      .assetSheetPhotoTile {
        min-width: 0;
        margin: 0;
        overflow: hidden;
        border: 1px solid var(--asset-line);
        border-radius: 1.05rem;
        background: var(--asset-soft);
        break-inside: avoid;
      }

      .assetSheetPhotoTile img {
        display: block;
        width: 100%;
        height: 9.5rem;
        object-fit: cover;
      }

      .assetSheetPhotoGridSingle .assetSheetPhotoTile img {
        height: 16.5rem;
      }

      .assetSheetPhotoTile figcaption {
        padding: 0.45rem 0.65rem;
        color: var(--asset-muted);
        font-size: 0.68rem;
        font-weight: 800;
      }

      .assetSheetPhotoEmpty {
        display: grid;
        place-items: center;
        min-height: 14.5rem;
        padding: 1rem;
        border: 1px solid var(--asset-line);
        border-radius: 1.05rem;
        background: linear-gradient(180deg, #f8fbfa 0%, #edf4f1 100%);
        color: var(--asset-muted);
        text-align: center;
      }

      .assetSheetPhotoEmpty span {
        display: block;
        color: var(--asset-text);
        font-size: 0.86rem;
        font-weight: 900;
      }

      .assetSheetPhotoEmpty small {
        display: block;
        max-width: 15rem;
        margin-top: 0.35rem;
        font-size: 0.72rem;
        font-weight: 650;
        line-height: 1.5;
      }

      .assetSheetFactGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.65rem;
      }

      .assetSheetFactCard {
        display: grid;
        grid-template-columns: minmax(5.85rem, 0.42fr) minmax(0, 1fr);
        min-height: 3.2rem;
        overflow: hidden;
        border: 1px solid var(--asset-line);
        border-radius: 0.82rem;
        background: #ffffff;
        break-inside: avoid;
      }

      .assetSheetFactLabel {
        display: flex;
        align-items: center;
        padding: 0.62rem 0.72rem;
        border-right: 1px solid var(--asset-line);
        background: var(--asset-soft);
        color: #203f71;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: -0.01em;
        text-transform: uppercase;
      }

      .assetSheetFactValue {
        display: flex;
        align-items: center;
        min-width: 0;
        padding: 0.62rem 0.78rem;
        color: var(--asset-text);
        font-size: 0.86rem;
        font-weight: 900;
        line-height: 1.35;
        word-break: break-word;
      }

      .assetSheetNotes {
        display: grid;
        gap: 0.65rem;
      }

      .assetSheetNote {
        border: 1px solid var(--asset-line);
        border-radius: 0.95rem;
        background: var(--asset-soft);
        padding: 0.75rem 0.85rem;
      }

      .assetSheetNote span {
        display: block;
        color: #203f71;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .assetSheetNote p {
        margin: 0.32rem 0 0;
        color: var(--asset-text);
        font-size: 0.84rem;
        font-weight: 650;
        line-height: 1.55;
        white-space: pre-wrap;
      }

      .assetSheetLower {
        display: grid;
        gap: 0.9rem;
        padding: 0 1.45rem 1.35rem;
      }

      .assetSheetDisclaimer {
        border-top: 1px solid var(--asset-line);
        padding: 1rem 1.45rem 1.15rem;
        background: #fbfdfc;
        color: var(--asset-muted);
        font-size: 0.68rem;
        line-height: 1.6;
      }

      .assetSheetDisclaimer strong {
        color: var(--asset-text);
        font-weight: 900;
      }

      .assetSheetDisclaimer ul {
        margin: 0.45rem 0 0;
        padding-left: 1rem;
      }

      .assetSheetDisclaimer li + li {
        margin-top: 0.22rem;
      }

      .assetSheetEmpty {
        padding: 0.9rem;
        border: 1px solid var(--asset-line);
        border-radius: 0.95rem;
        background: var(--asset-soft);
        color: var(--asset-muted);
        font-size: 0.8rem;
        font-weight: 700;
      }

      .assetSheetAvoidBreak {
        break-inside: avoid;
      }

      @media (max-width: 860px) {
        .assetSheetTopbar,
        .assetSheetHero,
        .assetSheetMain {
          grid-template-columns: 1fr;
        }

        .assetSheetTopbar {
          align-items: flex-start;
        }

        .assetSheetGenerated,
        .assetSheetValueBlock {
          text-align: left;
        }
      }

      @media (max-width: 640px) {
        .assetSheetPage {
          padding: 0 0.7rem;
        }

        .assetSheetFactGrid,
        .assetSheetPhotoGrid {
          grid-template-columns: 1fr;
        }
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .assetSheetScreenBar {
          display: none !important;
        }

        .assetSheetPage {
          width: auto;
          margin: 0;
          padding: 0;
        }

        .assetSheetCard {
          border-radius: 1rem;
          box-shadow: none;
        }

        .assetSheetPhotoTile img {
          max-height: 9.5rem;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetSheetScreenBar">
      <div class="assetSheetScreenText">Choose <strong>Save as PDF</strong> in the print dialog to download this asset PDF.</div>
      <div class="assetSheetScreenActions">
        <button type="button" class="assetSheetButton" onclick="window.close()">Close</button>
        <button type="button" class="assetSheetButton assetSheetButtonPrimary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <main class="assetSheetPage">
      <div class="assetSheetTopbar">
        <div class="assetSheetBrand">
          <span class="assetSheetBrandName">Aim4price</span>
          <span class="assetSheetDocumentType">Asset register PDF</span>
        </div>
        <div class="assetSheetGenerated">
          Generated
          <strong>${escapeHtml(payload.generatedAt)}</strong>
        </div>
      </div>

      <article class="assetSheetCard">
        <section class="assetSheetHero assetSheetAvoidBreak">
          <div>
            <span class="assetSheetBadge">${escapeHtml(payload.assetBadge)}</span>
            <h1 class="assetSheetTitle">${safeTitle}</h1>
            <p class="assetSheetMeta">${escapeHtml(payload.heroMeta)}</p>
          </div>

          <aside class="assetSheetValueBlock" aria-label="Asset value">
            <span class="assetSheetValueLabel">${escapeHtml(payload.valueLabel)}</span>
            <strong class="assetSheetValue">${escapeHtml(payload.value)}</strong>
            <span class="assetSheetVat">Excl. VAT</span>
            <span class="assetSheetValueNote">${escapeHtml(payload.valueNote)}</span>
          </aside>
        </section>

        <div class="assetSheetDivider"></div>

        <section class="assetSheetMain">
          <div class="assetSheetSection assetSheetAvoidBreak">
            <h2>Photos</h2>
            ${renderAssetSheetPhotos(photoUrls, payload.heroTitle)}
          </div>

          <div class="assetSheetSection">
            <h2>Asset details</h2>
            ${renderAssetSheetFactCards(payload.facts)}
          </div>
        </section>

        <div class="assetSheetLower">
          ${renderAssetSheetNotes(noteRows)}
        </div>

        <footer class="assetSheetDisclaimer">
          <strong>Disclaimer.</strong>
          <ul>
            <li>Aim4price values are indicative asset-register estimates and are not a certified valuation, inspection report or guarantee of selling price.</li>
            <li>All values shown on this sheet exclude VAT unless stated otherwise.</li>
            <li>Final market value can change after physical inspection, document checks, repairs, attachments, finance status, location and live market demand.</li>
          </ul>
        </footer>
      </article>
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

export function openAssetSheetPrint(payload: AssetSheetPayload): boolean {
  return openPrintWindow(
    `${payload.heroTitle} - Aim4price asset PDF`,
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
