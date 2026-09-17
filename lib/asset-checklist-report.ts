import { MAINTENANCE_REPORT_FONT_CSS, MAINTENANCE_REPORT_LAYOUT_CSS } from './maintenance-report-style.ts';
import { checklistOptions, type MaintenanceChecklist } from './maintenance-catalogue';
import { REPORT_THEME_CSS } from './report-theme';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildAssetChecklistReportHtml(asset: { title: string; serialNumber?: string }, checklist: MaintenanceChecklist, selectedKeys?: readonly string[], branding: { logoUrl?: string; generatedDate?: string } = {}) {
  const selected = selectedKeys ? new Set(selectedKeys) : null;
  let itemCount = 0;
  const sections = ([['checked', 'Inspection checks'], ['serviced', 'Service items'], ['repaired', 'Maintenance & repairs']] as const)
    .map(([mode, title]) => {
      // The repair section contains the owner's specific tasks; standard service work is already listed above.
      const items = checklistOptions(checklist, mode).filter(item => (mode !== 'repaired' || item.id.startsWith('asset_custom_')) && (!selected || selected.has(`${mode}:${item.id}`)));
      if (!items.length) return '';
      itemCount += items.length;
      return `<section><h2>${title}</h2><table><thead><tr><th class="boxCol">Done</th><th>Task / instructions</th><th class="notesCol">Faults / notes / N/A</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="checkbox"></span></td><td><strong>${escape(item.label)}</strong>${item.description ? `<p>${escape(item.description)}</p>` : ''}</td><td class="taskNotes"><div></div><div></div></td></tr>`).join('')}</tbody></table></section>`;
    }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Maintenance checklist</title><style>
  ${MAINTENANCE_REPORT_FONT_CSS}
  ${MAINTENANCE_REPORT_LAYOUT_CSS}
    .panel { margin-top: 12px; }
    .fields { display: flex; gap: 7mm; margin: 0; break-inside: avoid; }
    .fields span { flex: 1; border-bottom: 1px solid var(--line-strong); padding: 0 0 6mm; font-size: 9px; }
    .instructions { line-height: 1.4; margin: 10px 0; color: var(--muted); font-size: 8.9px; }
    h2 { font-size: 10.8px; margin: 10px 0 8px; break-after: avoid; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th { background: var(--brand-soft); text-align: left; font-size: 8.8px; }
    td, th { border: 1px solid var(--line-strong); padding: ${itemCount > 10 ? '3px' : '5px'} 8px; vertical-align: top; overflow-wrap: anywhere; }
    td { height: ${itemCount > 10 ? '6mm' : itemCount > 5 ? '8mm' : '12mm'}; line-height: 1.35; font-size: 9.4px; }
    td p { font-size: 8px; color: var(--muted); margin: 3px 0 0; white-space: pre-wrap; }
    .boxCol { width: 12mm; white-space: nowrap; } .notesCol { width: 40%; }
    .checkbox { display: block; width: 3.5mm; height: 3.5mm; border: 1px solid var(--ink); background: white; margin: 1px auto; }
    .taskNotes div { height: ${itemCount > 10 ? '4mm' : itemCount > 5 ? '6mm' : '9mm'}; border-bottom: 1px solid var(--line); }
    .taskNotes div + div { display: none; }
    .notes, .signoff { break-inside: avoid; }
    .notes div { height: ${itemCount > 10 ? '5mm' : '7mm'}; border-bottom: 1px solid var(--line-strong); }
    .signoff { margin-top: 12px; }
    ${REPORT_THEME_CSS}
  </style></head><body><main class="reportPage"><header class="topbar"><div class="brand">${branding.logoUrl ? `<img class="assetReportLogo" src="${escape(branding.logoUrl)}" alt="Report logo" />` : '<div class="assetReportLogoFallback">AIM4PRICE</div>'}<div><h1>Maintenance checklist</h1><p>Aim4price asset register</p></div></div><div class="meta"><span>Generated </span><strong>${escape(branding.generatedDate || '—')}</strong></div></header>
  <section class="hero"><div class="heroMain"><p class="eyebrow">Maintenance Management</p><h2 class="heroTitle">${escape(asset.title)}</h2><p class="heroMeta">Serial number: ${escape(asset.serialNumber || 'Not provided')} · ${escape(checklist.label)}</p></div><div class="heroStatus"><span>Working checklist</span><strong>${itemCount} ${itemCount === 1 ? 'item' : 'items'}</strong><p>Complete by hand</p></div></section>
  <section class="panel"><h2>Work details</h2><div class="fields"><span>Date:</span><span>Usage reading:</span><span>Worker / manager:</span></div></section>
  <p class="instructions">Tick each box when completed. Record faults or mark N/A for items that do not apply. Follow the manufacturer's service instructions and safe isolation procedures.</p>
  ${sections}<section class="notes"><h2>Additional work / faults / follow-up</h2><div></div><div></div><div></div></section>
  <section class="signoff"><div class="fields"><span>Completed by / signature:</span><span>Checked by / signature:</span></div></section><footer class="footer"><div><strong>Powered by Aim4price.com</strong><p>This is a blank working checklist. Downloading or ticking the printed sheet does not update maintenance records in Aim4price.</p></div><strong class="footerPage">Maintenance checklist</strong></footer></main></body></html>`;
}
