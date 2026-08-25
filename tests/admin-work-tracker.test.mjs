import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  calculateAdminWorkHeartbeatSeconds,
  formatAdminWorkDuration,
  getAdminWorkPeriodRange,
  resolveAdminWorkPage,
  shiftAdminWorkAnchor,
} from "../lib/admin-work-tracker-shared.ts";

async function loadReportBuilder() {
  const compilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  };
  const sharedSource = readFileSync(
    new URL("../lib/admin-work-tracker-shared.ts", import.meta.url),
    "utf8",
  );
  const sharedJavaScript = ts.transpileModule(sharedSource, { compilerOptions }).outputText;
  const sharedUrl = `data:text/javascript;base64,${Buffer.from(sharedJavaScript).toString("base64")}`;
  const reportSource = readFileSync(
    new URL("../lib/admin-work-tracker-report.ts", import.meta.url),
    "utf8",
  );
  const reportJavaScript = ts
    .transpileModule(reportSource, { compilerOptions })
    .outputText.replace('"./admin-work-tracker-shared"', JSON.stringify(sharedUrl));
  const reportUrl = `data:text/javascript;base64,${Buffer.from(reportJavaScript).toString("base64")}`;
  return import(reportUrl);
}

test("friendly page mapping removes query strings and dynamic record details", () => {
  assert.deepEqual(resolveAdminWorkPage("/asset-register/asset-123?tab=documents"), {
    key: "asset-register",
    label: "Asset Register",
    isAdminArea: false,
  });
  assert.deepEqual(resolveAdminWorkPage("/admin/work-tracker?clientUserId=secret"), {
    key: "admin-work-tracker",
    label: "Admin - Work tracker",
    isAdminArea: true,
  });
  assert.deepEqual(resolveAdminWorkPage("/admin/marketplace?status=live"), {
    key: "admin-marketplace",
    label: "Admin - Marketplace",
    isAdminArea: true,
  });
  assert.deepEqual(resolveAdminWorkPage("/admin/asset-map?assetId=private"), {
    key: "admin-asset-map",
    label: "Admin - Global Asset Map",
    isAdminArea: true,
  });
  assert.deepEqual(resolveAdminWorkPage("/admin/discovery?owner=private"), {
    key: "admin-discovery",
    label: "Admin - Discovery",
    isAdminArea: true,
  });
  assert.deepEqual(resolveAdminWorkPage("/some-private-record/abc-123"), {
    key: "account-other",
    label: "Other account page",
    isAdminArea: false,
  });
  assert.equal(resolveAdminWorkPage("/accountant/client-123").label, "Accountant Workspace");
  assert.equal(resolveAdminWorkPage("/valuations/run-123").label, "Get Estimate");
  assert.equal(resolveAdminWorkPage("/fuel-scan/private-code").label, "Fuel Ledger");
  assert.equal(resolveAdminWorkPage("/scan/private-code").label, "Asset Scan");
  assert.equal(resolveAdminWorkPage("/showroom/dealer-123").label, "Showroom");
});

test("weekly periods start on Monday in Johannesburg", () => {
  const range = getAdminWorkPeriodRange("week", "2026-08-20");
  assert.equal(range.startDate, "2026-08-17");
  assert.equal(range.endDate, "2026-08-23");
  assert.equal(range.startIso, "2026-08-16T22:00:00.000Z");
  assert.equal(range.endIso, "2026-08-23T22:00:00.000Z");
});

test("monthly periods and navigation handle leap years", () => {
  const range = getAdminWorkPeriodRange("month", "2028-02-14");
  assert.equal(range.startDate, "2028-02-01");
  assert.equal(range.endDate, "2028-02-29");
  assert.equal(shiftAdminWorkAnchor("month", "2028-02-14", 1), "2028-03-01");
  assert.equal(shiftAdminWorkAnchor("week", "2026-08-20", -1), "2026-08-13");
});

test("heartbeats cap short gaps and discard closed-browser gaps", () => {
  assert.equal(
    calculateAdminWorkHeartbeatSeconds("2026-08-20T10:00:00Z", "2026-08-20T10:00:30Z", true),
    30,
  );
  assert.equal(
    calculateAdminWorkHeartbeatSeconds("2026-08-20T10:00:00Z", "2026-08-20T10:02:00Z", true),
    90,
  );
  assert.equal(
    calculateAdminWorkHeartbeatSeconds("2026-08-20T10:00:00Z", "2026-08-20T11:00:00Z", true),
    0,
  );
  assert.equal(
    calculateAdminWorkHeartbeatSeconds("2026-08-20T10:00:00Z", "2026-08-20T10:00:30Z", false),
    0,
  );
});

test("work durations use concise owner-friendly labels", () => {
  assert.equal(formatAdminWorkDuration(0), "0 min");
  assert.equal(formatAdminWorkDuration(45), "1 min");
  assert.equal(formatAdminWorkDuration(3_600), "1 hr");
  assert.equal(formatAdminWorkDuration(5_100), "1 hr 25 min");
});

test("owner reports escape content and honour every Admin visibility control", async () => {
  const { buildAdminWorkReportHtml } = await loadReportBuilder();
  const baseSession = {
    id: "session-1",
    clientUserId: "client-1",
    clientName: "Example Owner",
    clientEmail: "owner@example.com",
    clientAccountType: "owner",
    startedAtIso: "2026-08-18T08:00:00.000Z",
    stoppedAtIso: "2026-08-18T09:00:00.000Z",
    lastHeartbeatAtIso: "2026-08-18T09:00:00.000Z",
    durationSeconds: 3_600,
    currentPageKey: "account",
    currentPageLabel: "Account",
    trackingActive: false,
    note: '<img src=x onerror="alert(1)"> Reviewed settings',
    includeInReport: true,
    showTimesInReport: true,
    showNoteInReport: true,
    pages: [{ pageKey: "account", pageLabel: "Account <private>", durationSeconds: 3_600 }],
  };
  const history = {
    period: "week",
    anchorDate: "2026-08-20",
    startDate: "2026-08-17",
    endDate: "2026-08-23",
    startIso: "2026-08-16T22:00:00.000Z",
    endIso: "2026-08-23T22:00:00.000Z",
    sessions: [
      baseSession,
      {
        ...baseSession,
        id: "session-hidden-note",
        note: "THIS NOTE MUST STAY HIDDEN",
        showTimesInReport: false,
        showNoteInReport: false,
      },
      {
        ...baseSession,
        id: "session-excluded",
        note: "THIS SESSION MUST STAY EXCLUDED",
        includeInReport: false,
      },
    ],
    summary: {
      trackedSeconds: 10_800,
      reportableSeconds: 7_200,
      sessionCount: 3,
      includedSessionCount: 2,
      pageCount: 1,
    },
  };

  const html = buildAdminWorkReportHtml({
    client: {
      userId: "client-1",
      name: "Owner <script>alert(1)</script>",
      email: "owner@example.com",
      accountType: "owner",
    },
    history,
    generatedAt: new Date("2026-08-20T10:00:00.000Z"),
  });

  assert.match(html, /Owner &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; Reviewed settings/);
  assert.match(html, /Account &lt;private&gt;/);
  assert.match(html, /Tracked activity:/);
  assert.doesNotMatch(html, /THIS NOTE MUST STAY HIDDEN/);
  assert.doesNotMatch(html, /THIS SESSION MUST STAY EXCLUDED/);
  assert.doesNotMatch(html, /<img src=x/);
});
