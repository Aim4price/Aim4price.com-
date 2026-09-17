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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Maintenance checklist</title><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"><style>
    @page { size: A4 portrait; margin: 12mm 12mm 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; font-size: 10pt; line-height: 1.4; }
    .reportPage { background: white; padding: 10mm; margin: 18px auto; max-width: 210mm; }
    .topbar { display: grid; grid-template-columns: 20mm minmax(0,1fr) 38mm; gap: 4mm; align-items: center; border-bottom: 1px solid var(--line-strong); padding-bottom: 5mm; margin-bottom: 4mm; }
    .logo { width: 16mm; height: 16mm; object-fit: contain; }
    .logoFallback { font-weight: 700; font-size: 9pt; }
    .brand h1 { font-size: 16pt; line-height: 1.15; margin: 0; }
    .brand p { font-size: 8pt; color: var(--muted); margin: 2mm 0 0; }
    .generated { font-size: 8pt; color: var(--muted); text-align: right; }
    .generated strong { display: block; color: var(--strong); margin-top: 1mm; }
    .hero { display: grid; grid-template-columns: minmax(0,1fr) 48mm; border: 1px solid var(--line-strong); break-inside: avoid; }
    .heroMain { padding: 4mm; border-right: 1px solid var(--line-strong); }
    .eyebrow { font-size: 8pt; text-transform: uppercase; margin: 0 0 2mm; }
    .heroTitle { font-size: 20pt; margin: 0; }
    .heroMeta { font-size: 9pt; margin: 2mm 0 0; overflow-wrap: anywhere; }
    .heroStatus { padding: 4mm; display: flex; flex-direction: column; justify-content: center; }
    .heroStatus span { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .heroStatus strong { font-size: 16pt; margin: 1mm 0; }
    .heroStatus p { font-size: 8pt; margin: 1mm 0 0; padding-top: 2mm; border-top: 1px solid var(--line); color: var(--muted); }
    .panel { border: 1px solid var(--line-strong); padding: 3mm 4mm; margin-top: 4mm; break-inside: avoid; }
    .panel h2 { margin: 0; font-size: 11pt; }
    .fields { display: flex; gap: 7mm; margin: 2mm 0; break-inside: avoid; }
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
    .footer { margin-top: 6mm; padding-top: 3mm; border-top: 1px solid var(--line-strong); break-inside: avoid; }
    .footerHeading { display: flex; justify-content: space-between; gap: 4mm; font-size: 8pt; }
    .footer p { font-size: 7.5pt; font-style: italic; color: var(--muted); margin: 2mm 0 0; }
    ${REPORT_THEME_CSS}
    @media print { html, body { background: white; } .reportPage { margin: 0; padding: 0; max-width: none; border-radius: 0; box-shadow: none; } }
  </style></head><body><main class="reportPage"><header class="topbar">${branding.logoUrl ? `<img class="logo" src="${escape(branding.logoUrl)}" alt="Report logo" />` : '<div class="logoFallback">AIM4PRICE</div>'}<div class="brand"><h1>Maintenance checklist</h1><p>Aim4price asset register</p></div><div class="generated">Generated <strong>${escape(branding.generatedDate || '—')}</strong></div></header>
  <section class="hero"><div class="heroMain"><p class="eyebrow">Maintenance Management</p><h2 class="heroTitle">${escape(asset.title)}</h2><p class="heroMeta">Serial number: ${escape(asset.serialNumber || 'Not provided')} · ${escape(checklist.label)}</p></div><div class="heroStatus"><span>Working checklist</span><strong>${itemCount} ${itemCount === 1 ? 'item' : 'items'}</strong><p>Complete by hand</p></div></section>
  <section class="panel"><h2>Work details</h2><div class="fields"><span>Date:</span><span>Usage reading:</span><span>Worker / manager:</span></div></section>
  <p class="instructions">Tick each box when completed. Record faults or mark N/A for items that do not apply. Follow the manufacturer's service instructions and safe isolation procedures.</p>
  ${sections}<section class="notes"><h2>Additional work / faults / follow-up</h2><div></div><div></div><div></div><div></div><div></div></section>
  <section class="signoff"><div class="fields"><span>Completed by / signature:</span><span>Checked by / signature:</span></div></section><footer class="footer"><div class="footerHeading"><strong>Powered by Aim4price.com</strong><strong>Maintenance checklist</strong></div><p>This is a blank working checklist. Downloading or ticking the printed sheet does not update maintenance records in Aim4price.</p></footer></main></body></html>`;
}
