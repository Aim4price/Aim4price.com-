import { checklistOptions, type MaintenanceChecklist } from './maintenance-catalogue';
import { REPORT_THEME_CSS } from './report-theme';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildAssetChecklistReportHtml(asset: { title: string; serialNumber?: string }, checklist: MaintenanceChecklist) {
  const sections = ([['checked', 'Inspection checks'], ['serviced', 'Service items'], ['repaired', 'Maintenance & repairs']] as const)
    .map(([mode, title]) => {
      // The repair section contains the owner's specific tasks; standard service work is already listed above.
      const items = checklistOptions(checklist, mode).filter(item => mode !== 'repaired' || item.id.startsWith('asset_custom_'));
      if (!items.length) return '';
      return `<section><h2>${title}</h2><table><thead><tr><th class="boxCol">Done</th><th>Task / instructions</th><th class="notesCol">Faults / notes / N/A</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="checkbox"></span></td><td><strong>${escape(item.label)}</strong>${item.description ? `<p>${escape(item.description)}</p>` : ''}</td><td></td></tr>`).join('')}</tbody></table></section>`;
    }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Maintenance checklist</title><style>
    ${REPORT_THEME_CSS}
    @page { size: A4 portrait; margin: 14mm 13mm 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: white; color: #173c32; font: 10pt Arial, sans-serif; }
    header { border-bottom: 2px solid #173c32; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-size: 10pt; letter-spacing: 1px; font-weight: bold; }
    h1 { font-size: 23pt; margin: 8px 0 12px; }
    .asset { font-size: 14pt; overflow-wrap: anywhere; }
    .meta { margin-top: 6px; color: #53675e; }
    .fields { display: flex; gap: 22px; margin: 16px 0; }
    .fields span { flex: 1; border-bottom: 1px solid #777; padding: 6px 0 18px; }
    .instructions { line-height: 1.5; margin-bottom: 18px; }
    h2 { font-size: 13pt; margin: 20px 0 8px; break-after: avoid; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th { background: #f1f7f4; text-align: left; font-size: 9pt; }
    td, th { border: 1px solid #aebeb5; padding: 9px; vertical-align: top; overflow-wrap: anywhere; }
    td { height: 36px; line-height: 1.4; }
    td p { font-size: 9pt; color: #53675e; margin: 4px 0 0; white-space: pre-wrap; }
    .boxCol { width: 58px; white-space: nowrap; } .notesCol { width: 28%; }
    .checkbox { display: block; width: 14px; height: 14px; border: 1.3px solid #222; background: white; margin: 2px auto; }
    .notes, .signoff { break-inside: avoid; }
    .notes div { height: 26px; border-bottom: 1px solid #aebeb5; }
    .signoff { margin-top: 20px; }
    .small { font-size: 8pt; color: #53675e; line-height: 1.4; }
  </style></head><body><header><div class="brand">AIM4PRICE</div><h1>Maintenance checklist</h1><strong class="asset">${escape(asset.title)}</strong><div class="meta">Serial number: ${escape(asset.serialNumber || 'Not provided')} · ${escape(checklist.label)}</div></header>
  <div class="fields"><span>Date:</span><span>Hours / km:</span><span>Worker / manager:</span></div>
  <p class="instructions">Tick each box when completed. Record faults or mark N/A for items that do not apply. Follow the manufacturer's service instructions and safe isolation procedures.</p>
  ${sections}<section class="notes"><h2>Additional work / faults / follow-up</h2><div></div><div></div><div></div></section>
  <section class="signoff"><div class="fields"><span>Completed by / signature:</span><span>Checked by / signature:</span></div><p class="small">This is a blank working checklist. Downloading or ticking the printed sheet does not update maintenance records in Aim4price.</p></section></body></html>`;
}
