type AssetQrLabelOptions = {
  assetTitle: string;
  serialNumber?: string;
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
  const serialNumber = escapeHtml(options.serialNumber?.trim() || '');
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
    .shell { width: min(100%, 1120px); margin: 0 auto; }
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
      min-height: 390px;
      display: grid;
      grid-template-columns: minmax(240px, .8fr) minmax(0, 1.6fr);
      align-items: center;
      gap: clamp(24px, 3.5vw, 44px);
      padding: clamp(24px, 3.5vw, 40px);
      border: 2px solid #bacdc2;
      border-radius: 32px;
      background: #fff;
      box-shadow: 0 20px 60px #10382f0e;
    }
    .qrFrame {
      min-width: 0;
      padding: 4px;
      border: 1px solid #d6e2da;
      border-radius: 24px;
      background: #fff;
    }
    .qrFrame img { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: contain; }
    .labelCopy { min-width: 0; display: grid; gap: 28px; }
    .labelHeading { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 24px; }
    .logoFrame { display: grid; place-items: center; width: 100%; height: 112px; }
    .accountLogo { display: block; max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; }
    .assetTitle {
      margin: 0;
      font-size: clamp(26px, 3.2vw, 38px);
      font-weight: 800;
      line-height: 1.14;
      letter-spacing: -.035em;
      overflow-wrap: anywhere;
    }
    .serialBlock { display: grid; gap: 8px; padding-top: 22px; border-top: 1px solid var(--line); }
    .serialBlock span { color: #52695f; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
    .serialBlock strong { font-size: clamp(20px, 2.4vw, 26px); font-weight: 650; line-height: 1.3; overflow-wrap: anywhere; }
    .printStatus { margin: 16px 0 0; color: #52695f; font-size: 14px; }
    .printStatus:empty { display: none; }
    @media screen and (max-width: 800px) {
      .qrLabel { grid-template-columns: minmax(160px, .8fr) minmax(0, 1.3fr); min-height: 0; padding: 22px; gap: 24px; }
      .labelHeading { grid-template-columns: 1fr; gap: 14px; }
      .logoFrame { width: 100px; height: 70px; }
      .assetTitle { font-size: 26px; }
      .labelCopy { gap: 20px; }
    }
    @media screen and (max-width: 520px) {
      body { padding: 16px; }
      .toolbar { align-items: stretch; gap: 16px; margin-bottom: 20px; }
      .actions { width: 100%; }
      .printButton { flex: 1; }
      button { padding: 12px 14px; }
      .qrLabel { grid-template-columns: 1fr; padding: 24px; gap: 24px; border-radius: 26px; }
      .qrFrame { width: min(100%, 260px); justify-self: center; }
      .labelHeading { grid-template-columns: 76px minmax(0, 1fr); gap: 16px; }
      .logoFrame { width: 76px; height: 76px; }
      .assetTitle { font-size: 23px; }
    }
    @page { size: A4; margin: 12mm; }
    @media print {
      body { padding: 0; min-height: 0; background: #fff; }
      .toolbar, .printStatus { display: none; }
      .shell { width: 100%; margin: 0; }
      .qrLabel {
        width: 186mm;
        max-width: 100%;
        min-height: 78mm;
        grid-template-columns: 55mm minmax(0, 1fr);
        padding: 7mm;
        gap: 7mm;
        border: .4mm solid #859c8f;
        border-radius: 7mm;
        box-shadow: none;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .qrFrame { padding: 1mm; border-radius: 5mm; }
      .labelCopy { gap: 6mm; }
      .labelHeading { grid-template-columns: 23mm minmax(0, 1fr); gap: 5mm; }
      .logoFrame { width: 23mm; height: 23mm; }
      .assetTitle { font-size: 22pt; }
      .serialBlock { gap: 2mm; padding-top: 5mm; }
      .serialBlock span { font-size: 8pt; }
      .serialBlock strong { font-size: 15pt; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="toolbar">
      <h1>QR label</h1>
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
        <div class="qrFrame"><img id="assetQr" src="${escapeHtml(options.qrImageUrl)}" alt="QR code for ${assetTitle}" /></div>
        <div class="labelCopy">
          <div class="labelHeading">
            <div class="logoFrame"><img class="accountLogo" id="accountLogo" src="${logoUrl}" data-fallback="${fallbackLogoUrl}" alt="Account logo" referrerpolicy="no-referrer" /></div>
            <h2 class="assetTitle">${assetTitle}</h2>
          </div>
          ${serialNumber ? `<div class="serialBlock"><span>Serial number</span><strong>${serialNumber}</strong></div>` : ''}
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
