import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function readTree(relativePath) {
  const files = [];
  const directories = [new URL(relativePath, root).pathname];

  while (directories.length) {
    const directory = directories.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) directories.push(entryPath);
      else if (entry.isFile()) files.push(readFileSync(entryPath, "utf8"));
    }
  }
  return files.join("\n");
}

const api = read("app/api/admin/work-tracker/route.ts");
const reportApi = read("app/api/admin/work-tracker/report/route.ts");
const library = read("lib/admin-work-tracker.ts");
const shared = read("lib/admin-work-tracker-shared.ts");
const migration = read("database/migrations/83-admin-work-tracker.sql");
const trackerPage = read("app/admin/work-tracker/page.tsx");
const trackerClient = read("app/admin/work-tracker/work-tracker-client.tsx");
const trackerBar = read("components/AdminWorkTrackerBar.tsx");
const adminClient = read("app/admin/admin-client.tsx");
const report = read("lib/admin-work-tracker-report.ts");
const ownerCode = readTree("app/owner-app");

test("every tracker surface independently requires the real Aim4price Admin session", () => {
  assert.match(api, /getAnyServerSession/);
  assert.match(api, /isAim4priceAdminEmail/);
  assert.match(reportApi, /getAnyServerSession/);
  assert.match(reportApi, /isAim4priceAdminEmail/);
  assert.match(trackerPage, /requireAdminPageAccess/);
  assert.doesNotMatch(api, /adminUserId:\s*body\./);
});

test("session mutations are scoped to Admin and serialize heartbeat accounting", () => {
  assert.match(library, /where admin_user_id = \$1/);
  assert.match(library, /sessionId: unknown/);
  assert.match(library, /if \(!adminUserId \|\| !expectedSessionId\) return null/);
  assert.match(library, /expectedSessionId !== row\.id/);
  assert.match(library, /for update/);
  assert.match(library, /connection\.query\("begin"\)/);
  assert.match(library, /calculateAdminWorkHeartbeatSeconds/);
  assert.match(shared, /ADMIN_WORK_HEARTBEAT_CAP_SECONDS/);
  assert.match(library, /work_date >= nullif\(\$2::text, ''\)::date/);
  assert.match(library, /started_at < \$3::timestamptz/);
  assert.match(library, /stopped_at >= \$2::timestamptz/);
  assert.match(library, /min\(first_seen_at\) as first_seen_at/);
  assert.match(library, /max\(last_seen_at\) as last_seen_at/);
  assert.match(migration, /where stopped_at is null/);
  assert.match(migration, /unique index[^\n]*idx_admin_work_sessions_one_active_per_admin/);
});

test("only friendly aggregate pages are persisted", () => {
  const pageTotalInsert = library.match(
    /async function upsertElapsedPageTotal[\s\S]*?insert into public\.admin_work_page_totals[\s\S]*?on conflict \(session_id, work_date, page_key\)[\s\S]*?last_seen_at = greatest\([\s\S]*?\n}/,
  )?.[0] || "";
  assert.match(library, /resolveAdminWorkPage/);
  assert.match(migration, /page_key text not null/);
  assert.match(migration, /page_label text not null/);
  assert.doesNotMatch(migration, /raw_path|query_string|click_data|field_value/i);
  assert.ok(pageTotalInsert);
  assert.doesNotMatch(pageTotalInsert, /pathname|query_string|stringify/i);
  assert.match(report, /No clicks, record details or field values are included/);
});

test("report visibility is controlled by Admin and never wired into Owner App", () => {
  assert.match(migration, /include_in_report boolean not null default true/);
  assert.match(migration, /show_times_in_report boolean not null default false/);
  assert.match(migration, /show_note_in_report boolean not null default false/);
  assert.match(report, /session\.showTimesInReport/);
  assert.match(report, /session\.showNoteInReport/);
  assert.match(reportApi, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(ownerCode, /admin-work-tracker|admin_work_sessions|AdminWorkTracker/);
});

test("Start opens the selected account and Done closes support access before returning to Admin", () => {
  const startBranch = api.slice(
    api.indexOf('if (action === "start")'),
    api.indexOf('if (action === "heartbeat")'),
  );
  const stopBranch = api.slice(
    api.indexOf('if (action === "stop")'),
    api.indexOf('return jsonError("Unsupported work tracker action.")'),
  );

  assert.match(startBranch, /withAdminSupportCookie/);
  assert.match(startBranch, /activeSession\.clientUserId/);
  assert.match(startBranch, /redirectUrl: "\/account"/);
  assert.match(stopBranch, /stopAdminWorkSession/);
  assert.match(stopBranch, /withClearedAdminSupportCookie/);
  assert.match(stopBranch, /redirectUrl: "\/admin"/);
  assert.match(api, /httpOnly: true/);
  assert.match(api, /sameSite: "lax"/);
  assert.match(adminClient, /window\.location\.assign\(data\.redirectUrl \|\| "\/account"\)/);
  assert.match(trackerClient, /window\.location\.assign\(data\.redirectUrl \|\| "\/account"\)/);
  assert.match(trackerClient, /window\.location\.replace\(data\.redirectUrl \|\| "\/admin"\)/);
  assert.match(trackerBar, /window\.location\.replace\(data\.redirectUrl \|\| "\/admin"\)/);
});

test("only completed Admin-owned work sessions can be permanently deleted", () => {
  const deleteQuery = library.match(
    /delete from public\.admin_work_sessions[\s\S]*?returning id/,
  )?.[0] || "";

  assert.match(api, /export async function DELETE\(request: Request\)/);
  assert.match(api, /deleteAdminWorkSession\(\{/);
  assert.ok(deleteQuery);
  assert.match(deleteQuery, /where id = \$1/);
  assert.match(deleteQuery, /admin_user_id = \$2/);
  assert.match(deleteQuery, /stopped_at is not null/);
  assert.match(migration, /references public\.admin_work_sessions\(id\) on delete cascade/);
  assert.match(trackerClient, /method: "DELETE"/);
  assert.match(trackerClient, /This cannot be undone/);
  assert.match(trackerClient, /"Delete entry"/);
  assert.match(trackerClient, /deletingSessionId !== null/);
});
