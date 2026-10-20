/** Layout for the printable history report; colours come from REPORT_THEME_CSS. */
export const LOCATION_HISTORY_REPORT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: Montserrat, 'Segoe UI', Arial, sans-serif; font-size: 10px; line-height: 1.45; }
.screenBar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border-bottom: 1px solid var(--line); }
.screenBar > span { color: var(--muted); font-size: 12.5px; }
.screenActions { display: flex; gap: 8px; }
.screenBar button { min-height: 42px; padding: 0 16px; border: 1px solid var(--line-strong); border-radius: 999px; background: white; color: var(--ink); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.screenBar #print { background: var(--brand); color: white; min-width: 150px; box-shadow: 0 12px 22px #103f352e; }
.screenBar button:focus-visible { outline: 3px solid #197454; outline-offset: 3px; }
.assetMapReportPage { width: min(100%, 297mm); margin: 18px auto; padding: 9mm 10mm 8mm; background: white; }
.topbar { display: grid; grid-template-columns: 26mm minmax(0, 1fr) 74mm; gap: 12px; align-items: center; padding-bottom: 9px; border-bottom: 1px solid var(--line-strong); }
.logoWrap { min-height: 17mm; display: flex; align-items: center; }
.logo { width: 22mm; max-height: 20mm; object-fit: contain; }
.brand { font-size: 16px; font-weight: 800; }
.documentTitle strong { display: block; color: var(--brand); font-size: 16px; font-weight: 700; line-height: 1.15; letter-spacing: -.025em; }
.documentTitle > span { display: block; margin-top: 5px; color: var(--muted); font-size: 9px; font-weight: 600; }
.headerMeta { display: grid; gap: 4px; font-size: 8.3px; }
.headerMeta > div { display: grid; grid-template-columns: 23mm minmax(0,1fr); gap: 7px; }
.headerMeta span { color: var(--muted); }
.headerMeta strong { text-align: right; overflow-wrap: anywhere; }
.hero { display: grid; grid-template-columns: minmax(0,1fr) 92mm; border: 1px solid var(--line-strong); border-radius: 8px; overflow: hidden; margin: 8px 0; break-inside: avoid; }
.identity { padding: 10px 13px 11px; background: linear-gradient(135deg,#fff,var(--brand-wash)); min-width: 0; }
.kicker { text-transform: uppercase; color: var(--brand-secondary); letter-spacing: .08em; font-size: 8.1px; font-weight: 700; margin: 0 0 6px; }
.identity h1 { margin: 0; font-size: 21px; line-height: 1.12; letter-spacing: -.035em; overflow-wrap: anywhere; }
.identity p:not(.kicker) { margin: 6px 0 0; font-size: 9px; }
.summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; padding: 9px 10px; border-left: 1px solid var(--line-strong); background: var(--brand-soft); }
.summary > div { padding: 6px 7px; border: 1px solid #cfe2d8; border-radius: 6px; background: #ffffffeb; min-width: 0; }
.summary span { display: block; font-size: 7.5px; color: var(--muted); }
.summary strong { display: block; font-size: 10px; line-height: 1.3; margin-top: 2px; }
.mapGrid { display: grid; grid-template-columns: minmax(0, 2.35fr) minmax(0,1fr); gap: 9px; align-items: start; break-inside: avoid; }
.mapPanel, .sideCard { border: 1px solid var(--line-strong); border-radius: 8px; overflow: hidden; }
.sectionHead { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 10px; background: var(--paper-soft); break-after: avoid; }
h2 { margin: 0; color: var(--brand); font-size: 11px; line-height: 1.3; }
.sectionHead > span { font-size: 8px; color: var(--muted); }
.mapSide { display: grid; gap: 7px; }
.sideCard { padding: 8px; }
.sideCard h2 { margin-bottom: 7px; }
.map { position: relative; width: 100%; background: #e8f0eb; overflow: hidden; isolation: isolate; break-inside: avoid; }
.sideCard .map { border: 1px solid var(--line); border-radius: 6px; }
.tile { position: absolute; max-width: none; }
.pin { position: absolute; transform: translate(-50%,-100%); min-width: 26px; height: 26px; padding: 3px 5px; border: 2px solid white; border-radius: 50% 50% 50% 4px; background: #367b9c; color: white; text-align: center; text-decoration: none; font-size: 10px; font-weight: 800; box-shadow: 0 2px 5px #456; }
.pin.latest { background: #103f35; }
.attribution { position: absolute; bottom: 0; right: 0; z-index: 3000; background: #fffffff0; padding: 1px 3px; font-size: 6px; color: #456; }
.mapHint { margin: 5px 0 0; color: var(--muted); font-size: 8px; }
dl { margin: 0; font-size: 8px; }
dl > div { display: grid; grid-template-columns: 1fr 1.4fr; gap: 6px; padding: 4px 0; border-top: 1px solid var(--line); }
dt { color: var(--muted); } dd { margin: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
a { color: var(--brand); text-underline-offset: 2px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 0; color: var(--muted); font-size: 8px; }
.legend b { color: #0f5840; }
.history { border: 1px solid var(--line-strong); border-radius: 8px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
th { background: var(--brand-soft); text-align: left; font-size: 8px; padding: 7px 9px; border-bottom: 1px solid var(--line-strong); }
td { padding: 8px 9px; vertical-align: top; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; font-size: 8.5px; }
tr { break-inside: avoid; } tbody tr:nth-child(even) { background: var(--paper-soft); }
td small { display: block; margin-top: 3px; color: var(--muted); }
.number { display: inline-block; min-width: 22px; text-align: center; background: var(--brand-soft); border-radius: 5px; padding: 3px; }
.footer { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 30px; border-top: 1px solid var(--line-strong); margin-top: 12px; padding-top: 9px; font-size: 8px; break-inside: avoid; }
.footer p { margin: 4px 0 0; color: var(--muted); font-size: 7.5px; max-width: 700px; }
.footer > div:last-child { text-align: right; max-width: 240px; overflow-wrap: anywhere; }
#map-warning { color: #72511b; padding: 8px; border: 1px solid #d7c49f; background: #fffaec; }
.photoSection { margin-top:14px; border:1px solid var(--line-strong); border-radius:8px; }
.referenceNote { break-after:avoid; padding:0 10px; color:var(--muted); font-size:8.5px; }
.photoGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; padding:0 10px 10px; }
.photoGrid figure { margin:0; break-inside:avoid; min-width:0; }
.photoFrame { height:32mm; display:flex; align-items:center; justify-content:center; background:#f4f7f5; border:1px solid var(--line); border-radius:6px; overflow:hidden; }
.assetPhoto { display:block; width:100%; height:100%; object-fit:contain; }
[hidden] { display:none!important; }
.photoGrid figcaption { font-size:8px; padding-top:5px; color:var(--muted); overflow-wrap:anywhere; }
.photoWarning { margin:10px; padding:8px; background:#fff7e8; color:#78571e; }
.evidenceGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:10px 0; break-inside:avoid; }
.evidenceCard { border:1px solid var(--line-strong); border-radius:8px; padding:10px; min-width:0; }
.evidenceCard h2 { margin-bottom:6px; }
.evidenceCard p { margin:4px 0; font-size:9px; overflow-wrap:anywhere; }
.coverageNote { margin:10px 0; border-left:3px solid #b57c25; padding:8px 10px; background:#fff7e8; font-size:9px; }
.auditSummary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:10px 0; break-inside:avoid; }
.auditSummary > div { background:var(--brand-wash); border:1px solid var(--line); border-radius:6px; padding:8px; }
.auditSummary span { display:block; color:var(--muted); font-size:8px; }
.auditSummary strong { display:block; margin-top:3px; font-size:10px; }
.history + .history { margin-top:12px; }
.recordId { font-size:7px; color:var(--muted); overflow-wrap:anywhere; }
@page { size: A4 landscape; margin: 9mm 10mm; }
@media print { body { background: white; } .screenBar { display: none; } .assetMapReportPage { width: 100%; margin: 0; padding: 0; border-radius: 0; box-shadow: none!important; } }
`;
