export type ReportTone = 'high' | 'medium' | 'low';

export type ReportKeyValue = {
  label: string;
  value: string;
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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSummaryRows(rows: ReportKeyValue[]): string {
  if (!rows.length) {
    return '<div class="emptyState">No machine details were available for this report.</div>';
  }

  return rows
    .map(
      (row) => `
        <div class="summaryRow">
          <span class="summaryLabel">${escapeHtml(row.label)}</span>
          <span class="summaryValue">${escapeHtml(row.value)}</span>
        </div>
      `,
    )
    .join('');
}

function renderDocument(payload: ValuationReportPayload): string {
  const toneClass = payload.confidenceTone === 'high'
    ? 'toneHigh'
    : payload.confidenceTone === 'medium'
      ? 'toneMedium'
      : 'toneLow';

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
        font-size: 1.18rem;
        line-height: 1.2;
        color: var(--ink);
      }

      .summaryCaption {
        color: var(--muted);
        font-size: 0.9rem;
        line-height: 1.55;
      }

      .summaryGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .summaryRow {
        display: grid;
        gap: 0.32rem;
        padding: 1rem 1.3rem;
        border-bottom: 1px solid rgba(16, 56, 47, 0.08);
      }

      .summaryRow:nth-child(odd) {
        border-right: 1px solid rgba(16, 56, 47, 0.08);
      }

      .summaryRow:nth-last-child(-n + 2) {
        border-bottom: 0;
      }

      .summaryLabel {
        color: var(--muted);
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .summaryValue {
        color: var(--ink);
        font-size: 1rem;
        font-weight: 700;
        line-height: 1.55;
      }

      .emptyState {
        padding: 1rem 1.3rem 1.2rem;
        color: var(--muted);
        font-size: 0.95rem;
      }

      .footer {
        padding: 0 1.8rem 1.7rem;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.7;
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
        .summaryGrid {
          grid-template-columns: 1fr;
        }

        .generatedBlock {
          text-align: left;
        }

        .summaryRow,
        .summaryRow:nth-child(odd) {
          border-right: 0;
        }

        .summaryRow:nth-last-child(-n + 2) {
          border-bottom: 1px solid rgba(16, 56, 47, 0.08);
        }

        .summaryRow:last-child {
          border-bottom: 0;
        }
      }

      @media print {
        html, body {
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
          <p class="heroLead">Prepared from the saved machine profile and selected valuation inputs for a clean internal or client-facing snapshot.</p>
        </div>

        <aside class="valueCard">
          <span class="valueLabel">${escapeHtml(payload.selectedLabel)}</span>
          <strong class="valueAmount">${escapeHtml(payload.headlineValue)}</strong>
          <div class="badgeRow">
            <span class="badge ${toneClass}">${escapeHtml(payload.confidenceLabel)}</span>
            <span class="badge">Excl. VAT</span>
          </div>
          <div class="valueMeta">Indicative Aim4price output for the selected machine profile and saved input set.</div>
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
            ${renderSummaryRows(payload.summaryRows)}
          </div>
        </section>
      </main>

      <footer class="footer">${escapeHtml(
        payload.footerNote ?? 'Aim4price valuation report. All values shown exclude VAT and should be used as a practical market guide.'
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
  if (typeof window === 'undefined') {
    return false;
  }

  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(renderDocument(payload));
  printWindow.document.close();
  printWindow.document.title = `${payload.heroTitle} - Aim4price valuation report`;
  return true;
}
