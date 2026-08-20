import {
  formatAdminWorkDuration,
  type AdminWorkHistory,
  type AdminWorkPageTotal,
  type AdminWorkSessionView,
} from "./admin-work-tracker-shared";
import type { AdminWorkClient } from "./admin-work-tracker";

const REPORT_TIME_ZONE = "Africa/Johannesburg";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: REPORT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function displayAccountType(value: string): string {
  const clean = value.trim().toLowerCase();
  if (clean === "finance") return "Finance / Accounting";
  if (clean === "insurance") return "Insurance";
  if (clean === "licensing") return "Licensing";
  if (clean === "dealer") return "Dealer";
  return "Owner";
}

function aggregatePages(sessions: AdminWorkSessionView[]): AdminWorkPageTotal[] {
  const totals = new Map<string, AdminWorkPageTotal>();

  for (const session of sessions) {
    for (const page of session.pages) {
      const existing = totals.get(page.pageKey);
      totals.set(page.pageKey, {
        pageKey: page.pageKey,
        pageLabel: page.pageLabel,
        durationSeconds: (existing?.durationSeconds ?? 0) + page.durationSeconds,
      });
    }
  }

  return [...totals.values()].sort(
    (left, right) => right.durationSeconds - left.durationSeconds || left.pageLabel.localeCompare(right.pageLabel),
  );
}

function sessionPages(session: AdminWorkSessionView): string {
  if (!session.pages.length) {
    return '<span class="muted">No page time was captured.</span>';
  }

  return session.pages
    .map(
      (page) =>
        `<span class="pagePill">${escapeHtml(page.pageLabel)} · ${escapeHtml(formatAdminWorkDuration(page.durationSeconds))}</span>`,
    )
    .join("");
}

function sessionRow(session: AdminWorkSessionView): string {
  const timeText = session.showTimesInReport && session.stoppedAtIso
    ? `Tracked activity: ${formatTime(session.startedAtIso)}–${formatTime(session.stoppedAtIso)}`
    : "";
  const note = session.showNoteInReport && session.note.trim()
    ? `<p class="sessionNote"><strong>Work note:</strong> ${escapeHtml(session.note)}</p>`
    : "";

  return `
    <article class="session">
      <div class="sessionHeader">
        <div>
          <strong>${escapeHtml(formatDate(session.startedAtIso))}</strong>
          ${timeText ? `<span>${escapeHtml(timeText)}</span>` : ""}
        </div>
        <b>${escapeHtml(formatAdminWorkDuration(session.durationSeconds))}</b>
      </div>
      <div class="pageList">${sessionPages(session)}</div>
      ${note}
    </article>
  `;
}

export function buildAdminWorkReportHtml(input: {
  client: AdminWorkClient;
  history: AdminWorkHistory;
  generatedAt?: Date;
}): string {
  const generatedAt = input.generatedAt ?? new Date();
  const sessions = input.history.sessions.filter((session) => session.includeInReport);
  const pages = aggregatePages(sessions);
  const totalSeconds = sessions.reduce((total, session) => total + session.durationSeconds, 0);
  const periodLabel = input.history.period === "month" ? "Monthly" : "Weekly";
  const rangeLabel = `${formatDate(input.history.startIso)} – ${formatDate(
    new Date(new Date(input.history.endIso).getTime() - 1_000).toISOString(),
  )}`;
  const pageRows = pages.length
    ? pages
        .map(
          (page) => `
            <div class="areaRow">
              <span>${escapeHtml(page.pageLabel)}</span>
              <strong>${escapeHtml(formatAdminWorkDuration(page.durationSeconds))}</strong>
            </div>
          `,
        )
        .join("")
    : '<p class="empty">No reportable page time was recorded for this period.</p>';
  const sessionRows = sessions.length
    ? sessions.map(sessionRow).join("")
    : '<p class="empty">No completed work sessions are included in this report.</p>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(periodLabel)} Retainer Work Report</title>
  <style>
    :root { color-scheme: light; font-family: Inter, Arial, sans-serif; color: #17362c; background: #eef3f0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #eef3f0; }
    .actions { position: sticky; top: 12px; z-index: 3; max-width: 210mm; margin: 0 auto 14px; display: flex; justify-content: flex-end; }
    .actions button { min-height: 42px; padding: 0 18px; border: 0; border-radius: 999px; color: #fff; background: #176c50; font: inherit; font-weight: 800; cursor: pointer; box-shadow: 0 10px 24px rgba(23,108,80,.2); }
    .paper { width: 100%; max-width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 17mm; background: #fff; box-shadow: 0 18px 50px rgba(18,45,37,.12); }
    .header { display: flex; justify-content: space-between; gap: 28px; padding-bottom: 18px; border-bottom: 3px solid #176c50; }
    .brand { margin: 0 0 7px; color: #176c50; font-size: 13px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; color: #0e2e26; font-size: 30px; line-height: 1.05; letter-spacing: -.04em; }
    .header p:last-child { margin: 9px 0 0; color: #62746d; font-size: 13px; font-weight: 650; }
    .period { min-width: 160px; display: grid; align-content: start; gap: 4px; text-align: right; }
    .period span { color: #73827c; font-size: 10px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .period strong { color: #17362c; font-size: 15px; }
    .summary { margin: 20px 0; display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px; }
    .summary article { min-height: 84px; padding: 14px; border: 1px solid #dbe6e0; border-radius: 14px; background: #f8faf9; display: grid; gap: 5px; }
    .summary span { color: #71817b; font-size: 10px; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
    .summary strong { color: #17362c; font-size: 22px; line-height: 1.1; }
    .summary small { color: #667871; font-size: 11px; font-weight: 650; }
    section { margin-top: 24px; }
    h2 { margin: 0 0 10px; color: #17362c; font-size: 17px; }
    .sectionIntro { margin: -5px 0 12px; color: #708079; font-size: 11px; line-height: 1.45; }
    .areaRows { overflow: hidden; border: 1px solid #dfe8e3; border-radius: 13px; }
    .areaRow { min-height: 42px; padding: 9px 13px; display: flex; align-items: center; justify-content: space-between; gap: 18px; border-bottom: 1px solid #edf2ef; font-size: 12px; }
    .areaRow:last-child { border-bottom: 0; }
    .areaRow strong { white-space: nowrap; }
    .sessions { display: grid; gap: 10px; }
    .session { padding: 13px; border: 1px solid #dfe8e3; border-radius: 14px; break-inside: avoid; }
    .sessionHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .sessionHeader > div { display: grid; gap: 2px; }
    .sessionHeader strong { font-size: 13px; }
    .sessionHeader span { color: #72817b; font-size: 10px; font-weight: 700; }
    .sessionHeader b { color: #176c50; font-size: 14px; white-space: nowrap; }
    .pageList { margin-top: 9px; display: flex; flex-wrap: wrap; gap: 5px; }
    .pagePill { padding: 5px 8px; border-radius: 999px; color: #31574a; background: #edf7f2; font-size: 9px; font-weight: 760; }
    .sessionNote { margin: 10px 0 0; padding-top: 9px; border-top: 1px solid #edf2ef; color: #4d625a; font-size: 10px; line-height: 1.5; white-space: pre-wrap; }
    .muted, .empty { color: #7a8983; font-size: 11px; }
    .empty { margin: 0; padding: 16px; border: 1px dashed #d2ddd7; border-radius: 12px; text-align: center; }
    footer { margin-top: 28px; padding-top: 13px; border-top: 1px solid #dfe8e3; display: flex; justify-content: space-between; gap: 18px; color: #71817b; font-size: 9px; line-height: 1.45; }
    footer strong { color: #31574a; }
    @page { size: A4; margin: 0; }
    @media print {
      body { padding: 0; background: #fff; }
      .actions { display: none; }
      .paper { max-width: none; min-height: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="actions"><button type="button" onclick="window.print()">Print / Save PDF</button></div>
  <main class="paper">
    <header class="header">
      <div>
        <p class="brand">Aim4price</p>
        <h1>${escapeHtml(periodLabel)} Retainer Work Report</h1>
        <p>A clear summary of platform areas worked on during the selected period.</p>
      </div>
      <div class="period">
        <span>Report period</span>
        <strong>${escapeHtml(rangeLabel)}</strong>
      </div>
    </header>

    <div class="summary">
      <article><span>Account</span><strong>${escapeHtml(input.client.name)}</strong><small>${escapeHtml(displayAccountType(input.client.accountType))}</small></article>
      <article><span>Reportable time</span><strong>${escapeHtml(formatAdminWorkDuration(totalSeconds))}</strong><small>Shown to the nearest minute</small></article>
      <article><span>Work sessions</span><strong>${sessions.length}</strong><small>${pages.length} platform area${pages.length === 1 ? "" : "s"}</small></article>
    </div>

    <section>
      <h2>Platform areas worked on</h2>
      <p class="sectionIntro">Only friendly page areas and total time are shown. No clicks, record details or field values are included.</p>
      <div class="areaRows">${pageRows}</div>
    </section>

    <section>
      <h2>Work sessions</h2>
      <p class="sectionIntro">Each entry shows the date, time spent and platform areas. Optional activity times or work notes appear where useful.</p>
      <div class="sessions">${sessionRows}</div>
    </section>

    <footer>
      <div><strong>Prepared by Aim4price Admin</strong><br />This report is generated and supplied manually. It is not a live access log.</div>
      <div>Generated ${escapeHtml(formatDate(generatedAt.toISOString()))} · Africa/Johannesburg</div>
    </footer>
  </main>
</body>
</html>`;
}
