import { MAINTENANCE_REPORT_FONT_CSS, MAINTENANCE_REPORT_LAYOUT_CSS } from './maintenance-report-style';
import { REPORT_THEME_CSS } from './report-theme';
import type { AssetPart, PartsData } from './asset-parts';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function buildAssetPartsReportHtml(asset: { title: string; serialNumber?: string }, parts: AssetPart[], maintenance: PartsData['maintenance'], branding: { logoUrl?: string; generatedDate: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Parts report</title><style>
    ${MAINTENANCE_REPORT_FONT_CSS}
    ${MAINTENANCE_REPORT_LAYOUT_CSS}
    table { border-collapse:collapse; width:100%; table-layout:fixed; margin-top:14px; }
    thead { display:table-header-group; }
    tr { break-inside:avoid; }
    th,td { border:1px solid var(--line-strong); padding:8px; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
    th { background:var(--brand-soft); font-size:8.8px; }
    td { font-size:9.4px; line-height:1.45; }
    td p { margin:4px 0 0; white-space:pre-wrap; }
    td small { display:block; margin-top:4px; color:var(--muted); font-size:8px; }
    .partCol { width:32%; } .numberCol { width:26%; }
    .hero { break-inside:avoid; }
    ${REPORT_THEME_CSS}
  </style></head><body><main class="reportPage">
    <header class="topbar"><div class="brand">${branding.logoUrl ? `<img class="assetReportLogo" src="${escape(branding.logoUrl)}" alt="Report logo"/>` : '<div class="assetReportLogoFallback">AIM4PRICE</div>'}<div><h1>Parts report</h1><p>Aim4price asset register</p></div></div><div class="meta"><span>Generated</span><strong>${escape(branding.generatedDate)}</strong></div></header>
    <section class="hero"><div class="heroMain"><p class="eyebrow">Parts reference</p><h2 class="heroTitle">${escape(asset.title)}</h2><p class="heroMeta">Serial / VIN: ${escape(asset.serialNumber || 'Not provided')}</p></div><div class="heroStatus"><span>Selected parts</span><strong>${parts.length} ${parts.length === 1 ? 'part' : 'parts'}</strong><p>Saved to this asset</p></div></section>
    <table><thead><tr><th class="partCol">Part</th><th class="numberCol">Part number / brand</th><th>Notes / maintenance</th></tr></thead><tbody>${parts.map(part => {
      const record = maintenance.find(item => item.id === part.maintenanceId);
      return `<tr><td><strong>${escape(part.name)}</strong>${part.itemLabel !== part.name ? `<small>${escape(part.itemLabel)}</small>` : ''}</td><td><strong>${escape(part.partNumber)}</strong>${part.brand ? `<small>${escape(part.brand)}</small>` : ''}</td><td>${part.notes ? `<p>${escape(part.notes)}</p>` : ''}${record ? `<small>Maintenance: ${escape(record.title)}</small>` : ''}${!part.notes && !record ? '—' : ''}</td></tr>`;
    }).join('')}</tbody></table>
    <footer class="footer"><div><strong>Powered by Aim4price.com</strong><p>Confirm fitment against the model and serial / VIN before ordering. This report does not record costs or completed maintenance.</p></div><strong class="footerPage">Parts report</strong></footer>
  </main></body></html>`;
}
