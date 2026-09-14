type AssetQrLabelOptions = {
  assetTitle: string;
  accountName?: string;
  serialNumber?: string;
  yearModel?: number | null;
  modelName?: string;
  qrImageUrl: string;
  /** Resolved through report-logo, which embeds uploads and validates remote URLs. */
  logoUrl: string;
  fallbackLogoUrl: string;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A self-contained label, also used by the authenticated app popup. */
export function buildAssetQrLabelHtml(options: AssetQrLabelOptions): string {
  const assetTitle = escapeHtml(options.assetTitle.trim() || 'Asset');
  const accountName = escapeHtml(options.accountName?.trim() || '');
  const serialNumber = escapeHtml(options.serialNumber?.trim() || '');
  const modelName = escapeHtml(options.modelName?.trim() || '');
  const yearModel = Number.isInteger(options.yearModel) && Number(options.yearModel) > 0
    ? String(options.yearModel) : '';
  const details = [
    yearModel ? `<div class="detailRow"><dt>Year model</dt><dd>${yearModel}</dd></div>` : '',
    modelName ? `<div class="detailRow"><dt>Model</dt><dd>${modelName}</dd></div>` : '',
    serialNumber ? `<div class="detailRow serialBlock"><dt>Serial number</dt><dd>${serialNumber}</dd></div>` : '',
  ].join('');
  const logoUrl = escapeHtml(options.logoUrl || options.fallbackLogoUrl);
  const fallbackLogoUrl = escapeHtml(options.fallbackLogoUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${assetTitle} QR label</title>
  <style>
    @font-face {
      font-family: Montserrat;
      src: url('/field-manager/montserrat-latin.woff') format('woff');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    :root { color-scheme: light; --green: #10382f; --line: #cbd9d1; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: clamp(16px, 4vw, 48px);
      color: var(--green);
      font-family: Montserrat, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background: radial-gradient(ellipse at top left, #dfece6 0, transparent 55%), #eef3f5;
      min-height: 100vh;
    }
    .shell { width: min(100%, 1200px); margin: 0 auto; }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 28px;
    }
    h1 { margin: 0; font-size: clamp(26px, 3vw, 36px); line-height: 1.15; letter-spacing: -.04em; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 48px;
      padding: 12px 20px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      color: var(--green);
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background .15s, box-shadow .15s;
    }
    button svg { width: 19px; height: 19px; flex: 0 0 auto; }
    button:hover { background: #e8f1ec; }
    button:focus-visible { outline: 3px solid #5a937d; outline-offset: 4px; }
    .printButton { background: var(--green); border-color: var(--green); color: #fff; box-shadow: 0 6px 16px #10382f20; }
    .printButton:hover { background: #1c5142; }
    .printButton:disabled { opacity: .6; cursor: wait; }
    .qrLabel {
      width: 100%;
      display: grid;
      grid-template-columns: minmax(220px, .85fr) minmax(0, 1.4fr);
      gap: 36px 40px;
      padding: clamp(28px, 4vw, 48px);
      border: 1px solid #adc5b9;
      border-radius: 32px;
      background: #fff;
      box-shadow: 0 20px 60px #10382f0e;
    }
    .labelTitle { grid-column: 1 / -1; min-width: 0; padding-bottom: 30px; border-bottom: 1px solid var(--line); }
    .assetEyebrow { margin: 0 0 12px; color: #637b70; font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
    .assetTitle { margin: 0; font-size: clamp(26px, 3vw, 38px); font-weight: 650; line-height: 1.3; letter-spacing: -.025em; overflow-wrap: anywhere; }
    .qrFrame { min-width: 0; width: 100%; max-width: 340px; align-self: center; justify-self: center; padding: 4px; background: #fff; }
    .qrFrame img { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: contain; }
    .labelCopy { min-width: 0; display: grid; align-content: center; gap: 32px; padding-left: 40px; border-left: 1px solid var(--line); }
    .labelHeading { min-width: 0; display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 24px; }
    .logoFrame { display: grid; place-items: center; width: 112px; height: 112px; padding: 12px; border: 1px solid #d8e3dd; border-radius: 20px; background: #fff; }
    .accountLogo { display: block; max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; }
    .accountName { margin: 0; min-width: 0; font-size: clamp(22px, 2.3vw, 30px); font-weight: 600; line-height: 1.35; letter-spacing: -.02em; overflow-wrap: anywhere; }
    .labelDetails { display: grid; align-content: start; gap: 22px; margin: 0; }
    .detailRow { display: grid; gap: 7px; }
    .detailRow dt { color: #52695f; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
    .detailRow dd { margin: 0; font-size: clamp(18px, 1.8vw, 22px); font-weight: 550; line-height: 1.4; overflow-wrap: anywhere; }
    .serialBlock dd { letter-spacing: .025em; }
    .printStatus { margin: 16px 0 0; color: #52695f; font-size: 14px; }
    .printStatus:empty { display: none; }
    @media screen and (max-width: 800px) {
      .qrLabel { grid-template-columns: minmax(168px, .8fr) minmax(0, 1.3fr); padding: 28px; gap: 28px; }
      .labelCopy { padding-left: 28px; gap: 28px; }
      .labelHeading { grid-template-columns: 1fr; gap: 16px; }
      .logoFrame { width: 96px; height: 96px; }
      .assetTitle { font-size: 28px; }
    }
    @media screen and (max-width: 600px) {
      body { padding: 16px; }
      .toolbar { align-items: stretch; gap: 16px; margin-bottom: 20px; }
      .actions { width: 100%; }
      .printButton { flex: 1; }
      button { padding: 12px 14px; }
      .qrLabel { grid-template-columns: 1fr; padding: 24px; gap: 24px; border-radius: 26px; }
      .labelTitle { padding-bottom: 24px; }
      .assetTitle { font-size: 25px; }
      .qrFrame { max-width: 280px; }
      .labelCopy { padding: 24px 0 0; border-left: 0; border-top: 1px solid var(--line); gap: 28px; }
      .labelHeading { grid-template-columns: 80px minmax(0, 1fr); gap: 18px; }
      .logoFrame { width: 80px; height: 80px; padding: 8px; border-radius: 16px; }
      .accountName { font-size: 21px; }
    }
    @page { size: A4; margin: 12mm; }
    @media print {
      body { padding: 0; min-height: 0; background: #fff; }
      .toolbar, .printStatus { display: none; }
      .shell { width: 100%; margin: 0; }
      .qrLabel {
        width: 186mm;
        max-width: 100%;
        grid-template-columns: 55mm minmax(0, 1fr);
        padding: 8mm;
        gap: 6mm;
        border: .3mm solid #859c8f;
        border-radius: 6mm;
        box-shadow: none;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .labelTitle { padding-bottom: 5mm; }
      .assetEyebrow { font-size: 8pt; margin-bottom: 2mm; }
      .assetTitle { font-size: 20pt; }
      .qrFrame { max-width: 55mm; padding: 1mm; }
      .labelCopy { gap: 5mm; padding-left: 6mm; }
      .labelHeading { grid-template-columns: 22mm minmax(0, 1fr); gap: 4mm; }
      .logoFrame { width: 22mm; height: 22mm; padding: 2mm; border-radius: 3mm; }
      .accountName { font-size: 15pt; }
      .labelDetails { gap: 4mm; }
      .detailRow { gap: 1.5mm; }
      .detailRow dt { font-size: 8pt; }
      .detailRow dd { font-size: 12pt; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="toolbar">
      <h1>Asset label</h1>
      <div class="actions">
        <button type="button" onclick="window.close()" aria-label="Close label window">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
          Close
        </button>
        <button type="button" class="printButton" id="printLabel" disabled onclick="window.print()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z" /><path d="M17 12h1" /></svg>
          Print / Save Label
        </button>
      </div>
    </header>
    <main>
      <section class="qrLabel" aria-label="Printable asset QR label">
        <header class="labelTitle">
          <p class="assetEyebrow">Asset</p>
          <h2 class="assetTitle">${assetTitle}</h2>
        </header>
        <div class="qrFrame"><img id="assetQr" src="${escapeHtml(options.qrImageUrl)}" alt="QR code for ${assetTitle}" /></div>
        <div class="labelCopy">
          <div class="labelHeading">
            <div class="logoFrame"><img class="accountLogo" id="accountLogo" src="${logoUrl}" data-fallback="${fallbackLogoUrl}" alt="Account logo" referrerpolicy="no-referrer" /></div>
            ${accountName ? `<p class="accountName">${accountName}</p>` : ''}
          </div>
          ${details ? `<dl class="labelDetails" aria-label="Asset details">${details}</dl>` : ''}
        </div>
      </section>
    </main>
    <p class="printStatus" id="printStatus" role="status" aria-live="polite"></p>
  </div>
  <script>
    (async function () {
      var logo = document.getElementById('accountLogo');
      var qr = document.getElementById('assetQr');
      var status = document.getElementById('printStatus');
      // Uploaded logos often contain large empty margins. Fit the actual artwork
      // into its frame without changing the stored image or touching the QR.
      async function fitLogoArtwork() {
        logo.dataset.originalSrc = logo.src;
        try {
          var canvas = document.createElement('canvas');
          var scale = Math.min(1, 1200 / Math.max(logo.naturalWidth, logo.naturalHeight));
          var width = canvas.width = Math.max(1, Math.round(logo.naturalWidth * scale));
          var height = canvas.height = Math.max(1, Math.round(logo.naturalHeight * scale));
          var context = canvas.getContext('2d');
          context.drawImage(logo, 0, 0, width, height);
          var pixels = context.getImageData(0, 0, width, height).data;
          var left = width, top = height, right = -1, bottom = -1;
          // Prefer alpha bounds, preserving white artwork on transparent logos.
          var transparent = [0, (width - 1) * 4, (height - 1) * width * 4, (width * height - 1) * 4]
            .every(function (i) { return pixels[i + 3] < 16; });
          for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
              var i = (y * width + x) * 4;
              if (pixels[i + 3] < 16 || (!transparent && pixels[i] > 245 && pixels[i + 1] > 245 && pixels[i + 2] > 245)) continue;
              left = Math.min(left, x); right = Math.max(right, x);
              top = Math.min(top, y); bottom = Math.max(bottom, y);
            }
          }
          if (right < left || bottom < top || (left === 0 && top === 0 && right === width - 1 && bottom === height - 1)) return;
          var cropped = document.createElement('canvas');
          cropped.width = right - left + 1; cropped.height = bottom - top + 1;
          cropped.getContext('2d').drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
          logo.src = cropped.toDataURL('image/png');
          await logo.decode();
        } catch (_) { /* Cross-origin images remain contained at their original aspect ratio. */ }
      }
      // A failed or slow remote logo must never leave a broken image on the label.
      async function decodeLogo() {
        var timer;
        try {
          await Promise.race([
            logo.decode(),
            new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error('Logo timeout')); }, 5000); })
          ]);
        } catch (_) {
          logo.src = logo.dataset.fallback;
          logo.alt = 'Aim4price logo';
          await logo.decode();
        } finally { clearTimeout(timer); }
      }
      try {
        await Promise.all([qr.decode(), decodeLogo()]);
        await fitLogoArtwork();
        // Use the bundled font for printing without waiting indefinitely on a failed request.
        var fontTimer;
        await Promise.race([document.fonts.ready, new Promise(function (resolve) { fontTimer = setTimeout(resolve, 3000); })]);
        clearTimeout(fontTimer);
        document.getElementById('printLabel').disabled = false;
      } catch (_) {
        status.textContent = 'Label could not load. Please close and try again.';
      }
    })();
  </script>
</body>
</html>`;
}
