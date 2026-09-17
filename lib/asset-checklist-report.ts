import { checklistOptions, type MaintenanceChecklist } from './maintenance-catalogue';
import { REPORT_THEME_CSS } from './report-theme';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildAssetChecklistReportHtml(asset: { title: string; serialNumber?: string }, checklist: MaintenanceChecklist, selectedKeys?: readonly string[], branding: { logoUrl?: string; generatedDate?: string } = {}) {
  const selected = selectedKeys ? new Set(selectedKeys) : null;
  const sections = ([['checked', 'Inspection checks'], ['serviced', 'Service items'], ['repaired', 'Maintenance & repairs']] as const)
    .map(([mode, title]) => {
      // The repair section contains the owner's specific tasks; standard service work is already listed above.
      const items = checklistOptions(checklist, mode).filter(item => (mode !== 'repaired' || item.id.startsWith('asset_custom_')) && (!selected || selected.has(`${mode}:${item.id}`)));
      if (!items.length) return '';
      return `<section><h2>${title}</h2><table><thead><tr><th class="boxCol">Done</th><th>Task / instructions</th><th class="notesCol">Faults / notes / N/A</th></tr></thead><tbody>${items.map(item => `<tr><td><span class="checkbox"></span></td><td><strong>${escape(item.label)}</strong>${item.description ? `<p>${escape(item.description)}</p>` : ''}</td><td class="taskNotes"><div></div><div></div></td></tr>`).join('')}</tbody></table></section>`;
    }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Maintenance checklist</title><style>
    ${REPORT_THEME_CSS}
    @page { size: A4 portrait; margin: 14mm 13mm 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: white; color: #173c32; font: 10pt Arial, sans-serif; }
    header { display: flex; align-items: center; gap: 5mm; border-bottom: 2px solid #197454; padding-bottom: 5mm; margin-bottom: 6mm; break-inside: avoid; }
    .logo { width: 23mm; height: 23mm; object-fit: contain; }
    .documentTitle { flex: 1; }
    .brand { font-size: 9pt; letter-spacing: 1px; font-weight: bold; color: #197454; }
    h1 { font-size: 23pt; line-height: 1.15; margin: 2mm 0; }
    .generated { font-size: 8pt; color: #60756d; }
    .identity { border: 1px solid #b9d0c5; border-radius: 8px; background: #f1f7f4; padding: 5mm; break-inside: avoid; }
    .asset { font-size: 16pt; line-height: 1.3; overflow-wrap: anywhere; }
    .meta { margin-top: 2mm; color: #53675e; line-height: 1.4; overflow-wrap: anywhere; }
    .fields { display: flex; gap: 7mm; margin: 5mm 0; break-inside: avoid; }
    .fields span { flex: 1; border-bottom: 1px solid #81928c; padding: 2mm 0 10mm; font-size: 10pt; }
    .instructions { line-height: 1.5; margin: 4mm 0 5mm; color: #53675e; font-size: 9pt; }
    h2 { font-size: 14pt; margin: 6mm 0 3mm; break-after: avoid; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th { background: #eaf5ef; text-align: left; font-size: 10pt; }
    td, th { border: 1px solid #b9d0c5; padding: 3mm; vertical-align: top; overflow-wrap: anywhere; }
    td { height: 24mm; line-height: 1.5; font-size: 11pt; }
    td p { font-size: 9.5pt; color: #53675e; margin: 2mm 0 0; white-space: pre-wrap; }
    .boxCol { width: 16mm; white-space: nowrap; } .notesCol { width: 43%; }
    .checkbox { display: block; width: 5mm; height: 5mm; border: 1.3px solid #173c32; background: white; margin: 1mm auto; }
    .taskNotes div { height: 8mm; border-bottom: 1px solid #d6e4dd; }
    .notes, .signoff { break-inside: avoid; }
    .notes div { height: 10mm; border-bottom: 1px solid #b9d0c5; }
    .signoff { margin-top: 6mm; }
    .small { font-size: 8pt; color: #53675e; line-height: 1.4; }
  </style></head><body><header>${branding.logoUrl ? `<img class="logo" src="${escape(branding.logoUrl)}" alt="Report logo" />` : ''}<div class="documentTitle"><div class="brand">AIM4PRICE</div><h1>Maintenance checklist</h1>${branding.generatedDate ? `<div class="generated">Generated ${escape(branding.generatedDate)}</div>` : ''}</div></header>
  <section class="identity"><strong class="asset">${escape(asset.title)}</strong><div class="meta">Serial number: ${escape(asset.serialNumber || 'Not provided')} · ${escape(checklist.label)}</div></section>
  <div class="fields"><span>Date:</span><span>Usage reading:</span><span>Worker / manager:</span></div>
  <p class="instructions">Tick each box when completed. Record faults or mark N/A for items that do not apply. Follow the manufacturer's service instructions and safe isolation procedures.</p>
  ${sections}<section class="notes"><h2>Additional work / faults / follow-up</h2><div></div><div></div><div></div><div></div><div></div></section>
  <section class="signoff"><div class="fields"><span>Completed by / signature:</span><span>Checked by / signature:</span></div><p class="small">This is a blank working checklist. Downloading or ticking the printed sheet does not update maintenance records in Aim4price.</p></section></body></html>`;
}
