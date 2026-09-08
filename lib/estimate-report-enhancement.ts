export const MAX_ESTIMATE_REPORT_PHOTOS = 4;
export const MAX_ESTIMATE_REPORT_PHOTO_DATA_URL_CHARS = 2_600_000;

const SUPPORTED_REPORT_PHOTO = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

type EstimateReportPayloadRecord = Record<string, unknown>;

function isRecord(value: unknown): value is EstimateReportPayloadRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function reportDate(value: unknown): string {
  const parsed = value ? new Date(String(value)) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(safeDate);
}

export function normalizeEstimateReportPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const photos: string[] = [];
  for (const candidate of value) {
    if (photos.length >= MAX_ESTIMATE_REPORT_PHOTOS) break;
    if (typeof candidate !== 'string') continue;
    if (candidate.length > MAX_ESTIMATE_REPORT_PHOTO_DATA_URL_CHARS) continue;
    if (!SUPPORTED_REPORT_PHOTO.test(candidate)) continue;
    photos.push(candidate);
  }
  return photos;
}

function extractReportLogoSrc(html: string): string {
  const match = html.match(/<img class="assetReportLogo" src="([^"]+)"/);
  return match?.[1] ?? '';
}

const ESTIMATE_REPORT_ENHANCEMENT_STYLE = `
  <style id="estimate-report-enhancements">
    .assetReportHeader {
      padding-bottom: 12px;
    }

    .assetReportOverview {
      margin-top: 14px;
    }

    .assetReportIdentity {
      padding: 13px 15px 14px;
    }

    .assetReportMeta {
      margin-top: 8px;
      line-height: 1.45;
    }

    .assetReportValuationCard {
      padding: 13px 13px;
    }

    .assetReportValueMeta {
      margin-top: 12px;
      padding-top: 9px;
    }

    .assetReportContentGrid {
      gap: 14px;
      margin-top: 14px;
    }

    .assetReportMainStack,
    .assetReportSide {
      gap: 12px;
    }

    .assetReportSection {
      padding: 12px 13px 13px;
    }

    .assetReportSideCard {
      padding: 12px 11px 11px;
    }

    .assetReportSection h2,
    .assetReportSideCard h2 {
      margin-bottom: 9px;
    }

    .assetReportRow {
      gap: 8px;
      min-height: 22px;
      padding: 2px 0;
    }

    .assetReportTechnical .assetReportRow {
      grid-template-columns: 34mm minmax(0, 1fr);
      min-height: 22px;
    }

    .assetReportClientCard .assetReportRow {
      grid-template-columns: 35mm minmax(0, 1fr);
      min-height: 22px;
      padding: 4px 0;
    }

    .assetReportSideCard .assetReportRow {
      grid-template-columns: 25mm minmax(0, 1fr);
      gap: 6px;
      min-height: 20px;
      padding: 2px 0;
      align-items: start;
    }

    .assetReportSideCard .assetReportRow span {
      font-size: 8.3px;
      line-height: 1.38;
    }

    .assetReportSideCard .assetReportRow strong {
      font-size: 8.45px;
      line-height: 1.38;
    }

    .assetReportSaleabilityRows .assetReportRow {
      min-height: 20.5px;
      padding: 2px 0;
    }

    .assetReportFooter {
      padding-top: 9px;
    }

    .estimateReportPhotoIntro {
      margin-top: 14px;
      padding: 14px 15px 15px;
      border: 1px solid var(--line-strong);
      background: #ffffff;
    }

    .estimateReportPhotoIntro h1 {
      margin: 0;
      color: var(--strong);
      font-size: 20px;
      line-height: 1.08;
      font-weight: 800;
      letter-spacing: -0.04em;
    }

    .estimateReportPhotoIntro p:last-child {
      margin: 7px 0 0;
      color: var(--muted);
      font-size: 8.9px;
      line-height: 1.45;
      font-weight: 600;
    }

    .estimateReportPhotoGrid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }

    .estimateReportPhotoGrid[data-count="1"] {
      grid-template-columns: minmax(0, 1fr);
    }

    .estimateReportPhotoFigure {
      display: grid;
      place-items: center;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      border: 1px solid var(--line-strong);
      background: #f4f6f5;
    }

    .estimateReportPhotoFigure img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #f4f6f5;
    }

    .estimateReportPhotoGrid[data-count="1"] .estimateReportPhotoFigure {
      height: 170mm;
    }

    .estimateReportPhotoGrid[data-count="2"] .estimateReportPhotoFigure {
      height: 150mm;
    }

    .estimateReportPhotoGrid[data-count="3"] .estimateReportPhotoFigure,
    .estimateReportPhotoGrid[data-count="4"] .estimateReportPhotoFigure {
      height: 78mm;
    }

    .estimateReportPhotoPage .assetReportDisclaimer {
      font-style: normal;
    }

    @media screen and (min-width: 761px) {
      .assetReportHeader {
        grid-template-columns: 22mm minmax(0, 1fr) 66mm;
        gap: 14px;
      }

      .assetReportOverview,
      .assetReportContentGrid {
        grid-template-columns: minmax(0, 1fr) 67mm;
      }
    }

    @media print {
      .assetReportHeader {
        grid-template-columns: 22mm minmax(0, 1fr) 66mm;
        gap: 14px;
      }

      .assetReportOverview,
      .assetReportContentGrid {
        grid-template-columns: minmax(0, 1fr) 67mm;
      }

      .estimateReportPhotoPage {
        break-before: page;
        page-break-before: always;
      }
    }
  </style>
`;

function renderPhotoPage(baseHtml: string, payload: EstimateReportPayloadRecord, photos: string[]): string {
  if (!photos.length) return '';

  const title = escapeHtml(payload.machineTitle || 'Aim4price estimate');
  const generated = escapeHtml(reportDate(payload.generatedAt));
  const logoSrc = extractReportLogoSrc(baseHtml);
  const logo = logoSrc
    ? `<img class="assetReportLogo" src="${logoSrc}" alt="Aim4price logo" />`
    : '';
  const photoFigures = photos
    .map((photo, index) => `
      <figure class="estimateReportPhotoFigure">
        <img src="${photo}" alt="Estimate photo ${index + 1}" />
      </figure>
    `)
    .join('');

  return `
    <main class="assetReportPage estimateReportPhotoPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap">${logo}</div>
          <div class="assetReportDocumentTitle">
            <strong>Asset Estimate Report</strong>
            <span>Estimate photos</span>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${generated}</strong></div>
            <div class="assetReportMetaLine"><span>Photos</span><strong>${photos.length}</strong></div>
          </div>
        </header>

        <section class="estimateReportPhotoIntro">
          <p class="assetReportKicker">Estimate Photos</p>
          <h1>${title}</h1>
          <p>Photos supplied for this estimate report only. They are not saved to the Asset Register.</p>
        </section>

        <section class="estimateReportPhotoGrid" data-count="${photos.length}" aria-label="Estimate photos">
          ${photoFigures}
        </section>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">Temporary report photos · not stored with the estimate or Asset Register.</div>
          </div>
          <div class="assetReportPageNumber">Page 2 of 2</div>
        </footer>
      </div>
    </main>
  `;
}

export function enhanceEstimateReportHtml(baseHtml: string, rawPayload: unknown): string {
  if (!baseHtml || !/<\/head>/i.test(baseHtml)) return baseHtml;

  const payload = isRecord(rawPayload) ? rawPayload : {};
  const photos = normalizeEstimateReportPhotos(payload.reportPhotos);
  const pageCount = photos.length ? 2 : 1;

  let html = baseHtml.replace(/<\/head>/i, `${ESTIMATE_REPORT_ENHANCEMENT_STYLE}</head>`);
  html = html.replace(/Page 1 of 1/g, `Page 1 of ${pageCount}`);

  if (photos.length) {
    const photoPage = renderPhotoPage(baseHtml, payload, photos);
    html = html.replace(/\n\s*<script>\s*\n\s*\(function \(\) \{/,
      `${photoPage}\n\n    <script>\n      (function () {`);
  }

  return html;
}
