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
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:A4; margin:8mm 9mm; }
  html,body { margin:0; padding:0; background:#eef1f4; color:var(--ink); font-family:"Montserrat","Segoe UI",Arial,Helvetica,sans-serif; font-size:9.6px; line-height:1.35; }
  .reportPage { width:min(100%,210mm); min-height:297mm; margin:18px auto; padding:11mm 11mm 9mm; background:#fff; box-shadow:0 16px 44px rgba(17,24,39,.13); }
  .topbar { display:grid; grid-template-columns:22mm minmax(0,1fr) 62mm; gap:12px; align-items:center; min-height:18mm; padding:0 0 10px; border-bottom:1px solid var(--line-strong); }
  .logo { display:block; width:18mm; max-height:18mm; object-fit:contain; }
  .brand h1 { margin:0; font-size:16px; line-height:1.05; font-weight:800; letter-spacing:-.025em; }
  .brand p { margin:5px 0 0; color:var(--muted); font-size:8.9px; font-weight:600; }
  .meta { display:grid; grid-template-columns:21mm minmax(0,1fr); gap:4px 7px; min-width:0; font-size:8.3px; }
  .meta span { color:var(--muted); font-weight:700; }
  .meta strong { color:var(--strong); text-align:right; word-break:break-word; }
  .hero { display:grid; grid-template-columns:minmax(0,1fr) 62mm; margin-top:11px; border:1px solid var(--line-strong); }
  .heroMain { min-height:34mm; padding:11px 13px 12px; border-right:1px solid var(--line-strong); }
  .eyebrow { margin:0 0 6px; color:var(--muted); font-size:8.1px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
  .heroTitle { margin:0; color:var(--strong); font-size:21.5px; line-height:1.05; font-weight:800; letter-spacing:-.045em; }
  .heroMeta { margin:7px 0 0; color:#3f4652; font-size:9.2px; font-weight:600; }
  .heroStatus { display:flex; flex-direction:column; justify-content:center; padding:11px 12px; background:#fafbfc; }
  .heroStatus span { display:block; font-size:8.8px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
  .heroStatus strong { display:block; margin:6px 0 4px; font-size:17px; line-height:1.05; }
  .heroStatus p { margin:6px 0 0; padding-top:7px; border-top:1px solid var(--line); color:var(--muted); font-size:8.3px; font-weight:600; }
  .panel { break-inside:avoid; border:1px solid var(--line-strong); padding:10px 11px 11px; }
  .panel h2 { margin:0 0 8px; color:var(--strong); font-size:10.8px; }
    .panel { margin-top: 12px; }
    .logoFallback { font-weight: 800; }
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
    .footer { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line-strong); break-inside: avoid; }
    .footerHeading { display: flex; justify-content: space-between; gap: 10px; font-size: 8.2px; }
    .footer p { font-size: 7.35px; font-style: italic; color: var(--muted); margin: 4px 0 0; line-height: 1.35; }
    ${REPORT_THEME_CSS}
    @media print { html, body { background: white; } .reportPage { margin: 0; padding: 0; width: auto; min-height: 0; border-radius: 0; box-shadow: none; } }
  </style></head><body><main class="reportPage"><header class="topbar">${branding.logoUrl ? `<img class="logo" src="${escape(branding.logoUrl)}" alt="Report logo" />` : '<div class="logoFallback">AIM4PRICE</div>'}<div class="brand"><h1>Maintenance checklist</h1><p>Aim4price asset register</p></div><div class="meta"><span>Generated </span><strong>${escape(branding.generatedDate || '—')}</strong></div></header>
  <section class="hero"><div class="heroMain"><p class="eyebrow">Maintenance Management</p><h2 class="heroTitle">${escape(asset.title)}</h2><p class="heroMeta">Serial number: ${escape(asset.serialNumber || 'Not provided')} · ${escape(checklist.label)}</p></div><div class="heroStatus"><span>Working checklist</span><strong>${itemCount} ${itemCount === 1 ? 'item' : 'items'}</strong><p>Complete by hand</p></div></section>
  <section class="panel"><h2>Work details</h2><div class="fields"><span>Date:</span><span>Usage reading:</span><span>Worker / manager:</span></div></section>
  <p class="instructions">Tick each box when completed. Record faults or mark N/A for items that do not apply. Follow the manufacturer's service instructions and safe isolation procedures.</p>
  ${sections}<section class="notes"><h2>Additional work / faults / follow-up</h2><div></div><div></div><div></div></section>
  <section class="signoff"><div class="fields"><span>Completed by / signature:</span><span>Checked by / signature:</span></div></section><footer class="footer"><div class="footerHeading"><strong>Powered by Aim4price.com</strong><strong>Maintenance checklist</strong></div><p>This is a blank working checklist. Downloading or ticking the printed sheet does not update maintenance records in Aim4price.</p></footer></main></body></html>`;
}
