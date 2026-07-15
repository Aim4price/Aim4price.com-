import { getDb } from './db';
import type { InsuranceReportType, InsuranceWorkspaceData } from './insurance-workspace-types';
import { getInsuranceWorkspace } from './insurance-workspaces';

type BrokerDetails = {
  displayName: string;
  businessName: string;
  email: string;
  phone: string;
  logoUrl: string;
};

type InsuranceReportPayload = {
  workspace: InsuranceWorkspaceData;
  broker: BrokerDetails;
  type: InsuranceReportType;
  reference: string;
  generatedAtIso: string;
};

const DISCLAIMER = 'This report reflects insurance information and recommendations recorded by the broker. Aim4price does not provide financial advice or independently confirm insurance cover.';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' }).format(date);
}

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'insurance-report';
}

export async function createInsuranceReportSnapshot(input: {
  brokerUserId: string;
  workspaceId: string;
  type: InsuranceReportType;
  broker: BrokerDetails;
}) {
  const workspace = await getInsuranceWorkspace(input.brokerUserId, input.workspaceId);
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`insurance-report:${input.workspaceId}:${input.type}`]);
    const revisionResult = await client.query<{ revision: number }>(
      `select coalesce(max(revision), 0)::int + 1 as revision
       from insurance_report_snapshots where workspace_id = $1::uuid and report_type = $2`,
      [input.workspaceId, input.type],
    );
    const revision = revisionResult.rows[0]?.revision ?? 1;
    const generatedAtIso = new Date().toISOString();
    const typeCode = input.type === 'summary' ? 'SUM' : 'DET';
    const reference = `${workspace.snapshotReference}-${typeCode}-${String(revision).padStart(2, '0')}`;
    const filename = `${slug(`${workspace.clientName}-${input.type}-insurance-review-${revision}`)}.html`;
    const payload: InsuranceReportPayload = {
      workspace,
      broker: input.broker,
      type: input.type,
      reference,
      generatedAtIso,
    };
    const result = await client.query<{ id: string }>(
      `insert into insurance_report_snapshots
        (workspace_id, report_type, revision, report_reference, filename, payload_json, generated_by_user_id, generated_at)
       values ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz)
       returning id`,
      [input.workspaceId, input.type, revision, reference, filename, JSON.stringify(payload), input.brokerUserId, generatedAtIso],
    );
    await client.query(
      `insert into insurance_review_events
        (workspace_id, actor_user_id, entity_type, entity_id, action, after_json)
       values ($1::uuid, $2, 'report_snapshot', $3, 'generated', $4::jsonb)`,
      [input.workspaceId, input.brokerUserId, result.rows[0].id, JSON.stringify({ type: input.type, revision, reference })],
    );
    await client.query('commit');
    return { id: result.rows[0].id, type: input.type, revision, reference, filename, generatedAtIso };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function getInsuranceReportSnapshot(brokerUserId: string, reportId: string) {
  const result = await getDb().query<{ filename: string; payload_json: unknown }>(
    `select r.filename, r.payload_json
     from insurance_report_snapshots r
     join insurance_workspaces w on w.id = r.workspace_id
     where r.id = $1::uuid and w.broker_user_id = $2
     limit 1`,
    [reportId, brokerUserId],
  );
  if (!result.rows[0]) throw new Error('INSURANCE_REPORT_NOT_FOUND');
  return {
    filename: result.rows[0].filename,
    payload: result.rows[0].payload_json as InsuranceReportPayload,
  };
}

function baseStyles(type: InsuranceReportType): string {
  return `
    @page { size: ${type === 'summary' ? 'A4 landscape' : 'A4 portrait'}; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17332d; font: 11px/1.4 Arial, sans-serif; background: #fff; }
    .page { max-width: 1180px; margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 14px; border-bottom: 3px solid #153f35; }
    header img { max-width: 180px; max-height: 58px; object-fit: contain; }
    h1 { margin: 0; font-size: 25px; letter-spacing: -.5px; }
    h2 { margin: 22px 0 8px; font-size: 16px; }
    h3 { margin: 18px 0 7px; font-size: 13px; }
    p { margin: 3px 0; }
    .muted { color: #63736f; }
    .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
    .meta div { padding: 9px; border: 1px solid #d8e1de; }
    .meta small { display: block; color: #62716d; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 7px 6px; border: 1px solid #d6dfdc; vertical-align: top; word-break: break-word; }
    th { color: #fff; background: #1d5144; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; }
    tr:nth-child(even) td { background: #f5f8f7; }
    .right { text-align: right; }
    .section { break-inside: avoid; }
    .disclaimer { margin-top: 22px; padding: 10px 12px; border: 1px solid #d6dfdc; background: #f7f9f8; color: #56635f; font-size: 9px; }
    .print { position: fixed; right: 18px; bottom: 18px; padding: 10px 14px; border: 0; color: #fff; background: #153f35; cursor: pointer; }
    @media print { .print { display: none; } .page { max-width: none; } }
  `;
}

function reportHeader(payload: InsuranceReportPayload): string {
  const { workspace, broker } = payload;
  return `
    <header>
      <div>
        <h1>${escapeHtml(payload.type === 'summary' ? 'Insurance Review Summary' : 'Detailed Insurance Review')}</h1>
        <p class="muted">${escapeHtml(workspace.clientName)}</p>
      </div>
      ${broker.logoUrl ? `<img src="${escapeHtml(broker.logoUrl)}" alt="${escapeHtml(broker.businessName || broker.displayName)} logo" />` : `<strong>${escapeHtml(broker.businessName || broker.displayName || 'Insurance broker')}</strong>`}
    </header>
    <div class="meta">
      <div><small>Client</small><strong>${escapeHtml(workspace.clientName)}</strong></div>
      <div><small>Client profile</small><strong>${escapeHtml(label(workspace.clientProfile))}</strong></div>
      <div><small>Generated</small><strong>${escapeHtml(dateLabel(payload.generatedAtIso))}</strong></div>
      <div><small>Assets</small><strong>${workspace.assetCount}</strong></div>
      <div><small>Register value</small><strong>${escapeHtml(money(workspace.totalRegisterValue))}</strong></div>
      <div><small>Replacement value</small><strong>${escapeHtml(money(workspace.totalReplacementValue))}</strong></div>
      <div><small>Prepared by</small><strong>${escapeHtml(broker.businessName || broker.displayName)}</strong></div>
    </div>`;
}

function summaryBody(payload: InsuranceReportPayload): string {
  const rows = payload.workspace.assets.map((asset) => `
    <tr>
      <td>${escapeHtml(asset.title)}</td>
      <td>${escapeHtml(asset.kind)}</td>
      <td>${escapeHtml(asset.location || '—')}</td>
      <td>${escapeHtml(label(asset.review.currentInsuranceStatus))}</td>
      <td>${escapeHtml(asset.review.policySectionLabel || '—')}</td>
      <td>${escapeHtml(label(asset.review.recommendationStatus))}</td>
      <td class="right">${escapeHtml(money(asset.review.sumInsured ?? asset.replacementValue))}</td>
      <td>${escapeHtml(asset.review.recommendationNote || asset.review.informationRequiredNote || '—')}</td>
    </tr>`).join('');
  const covers = payload.workspace.generalCovers.map((cover) => `
    <tr><td>${escapeHtml(cover.label)}</td><td>${escapeHtml(label(cover.status))}</td><td>${escapeHtml(cover.policySectionLabel || '—')}</td><td>${escapeHtml(label(cover.recommendationStatus))}</td><td class="right">${escapeHtml(money(cover.limitAmount))}</td><td>${escapeHtml(cover.recommendationNote || cover.notes || '—')}</td></tr>`).join('');
  return `
    <h2>Asset review</h2>
    <table><thead><tr><th>Asset</th><th>Type</th><th>Location</th><th>Current status</th><th>Policy section</th><th>Broker recommendation</th><th>Sum insured</th><th>Recorded rationale / information</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No assets recorded.</td></tr>'}</tbody></table>
    <h2>General covers</h2>
    <table><thead><tr><th>Cover</th><th>Current status</th><th>Policy section</th><th>Broker recommendation</th><th>Limit</th><th>Notes</th></tr></thead><tbody>${covers || '<tr><td colspan="6">No general covers recorded.</td></tr>'}</tbody></table>`;
}

function detailedBody(payload: InsuranceReportPayload): string {
  const assets = payload.workspace.assets.map((asset, index) => {
    const optionRows = asset.review.options.map((option) => `<tr><td>${escapeHtml(option.label)}</td><td>${escapeHtml(label(option.status))}</td><td>${escapeHtml(label(option.exclusionReasonKey) || '—')}</td><td>${escapeHtml(option.note || option.textValue || '—')}</td></tr>`).join('');
    return `<section class="section">
      <h2>${index + 1}. ${escapeHtml(asset.title)}</h2>
      <table><tbody>
        <tr><th>Asset type</th><td>${escapeHtml(asset.kind)}</td><th>Category</th><td>${escapeHtml(label(asset.review.categoryKey))}</td></tr>
        <tr><th>Location</th><td>${escapeHtml(asset.location || '—')}</td><th>Serial / registration</th><td>${escapeHtml([asset.serialNumber, asset.registrationNumber].filter(Boolean).join(' / ') || '—')}</td></tr>
        <tr><th>Current insurance</th><td>${escapeHtml(label(asset.review.currentInsuranceStatus))}</td><th>Insurer / policy</th><td>${escapeHtml([asset.review.insurerName, asset.review.policyNumber].filter(Boolean).join(' / ') || '—')}</td></tr>
        <tr><th>Policy section</th><td>${escapeHtml(asset.review.policySectionLabel || '—')}</td><th>Schedule description</th><td>${escapeHtml(asset.review.scheduleDescription || '—')}</td></tr>
        <tr><th>Cover basis</th><td>${escapeHtml(asset.review.coverBasis || '—')}</td><th>Sum insured / VAT</th><td>${escapeHtml(money(asset.review.sumInsured))} / ${escapeHtml(label(asset.review.vatBasis) || '—')}</td></tr>
        <tr><th>Excess</th><td>${escapeHtml(asset.review.excessText || '—')}</td><th>Scheduling</th><td>${escapeHtml(label(asset.review.schedulingTreatment) || '—')}</td></tr>
        <tr><th>Broker recommendation</th><td>${escapeHtml(label(asset.review.recommendationStatus))}</td><th>Renewal</th><td>${escapeHtml(dateLabel(asset.review.renewalDate))}</td></tr>
        <tr><th>Recommendation rationale</th><td colspan="3">${escapeHtml(asset.review.recommendationNote || '—')}</td></tr>
        <tr><th>Information required</th><td colspan="3">${escapeHtml(asset.review.informationRequiredNote || '—')}</td></tr>
        <tr><th>Special conditions</th><td colspan="3">${escapeHtml(asset.review.specialConditions || '—')}</td></tr>
      </tbody></table>
      <h3>Cover options</h3>
      <table><thead><tr><th>Option</th><th>Status</th><th>Exclusion reason</th><th>Notes</th></tr></thead><tbody>${optionRows || '<tr><td colspan="4">No options recorded.</td></tr>'}</tbody></table>
    </section>`;
  }).join('');
  return `${assets}<h2>General covers</h2>${summaryBody({ ...payload, workspace: { ...payload.workspace, assets: [] } }).split('<h2>General covers</h2>')[1] ?? ''}`;
}

export function buildInsuranceReportHtml(payload: InsuranceReportPayload): string {
  const body = payload.type === 'summary' ? summaryBody(payload) : detailedBody(payload);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(`${workspaceTitle(payload)} insurance report`)}</title><style>${baseStyles(payload.type)}</style></head><body><main class="page">${reportHeader(payload)}${body}<p class="disclaimer">${escapeHtml(DISCLAIMER)}</p></main><button class="print" onclick="window.print()">Print / Save PDF</button></body></html>`;
}

function workspaceTitle(payload: InsuranceReportPayload): string {
  return payload.workspace.clientName || 'Client';
}

export function safeReportFilename(value: string): string {
  return text(value).replace(/[\r\n"]/g, ' ').slice(0, 180) || 'insurance-report.html';
}
