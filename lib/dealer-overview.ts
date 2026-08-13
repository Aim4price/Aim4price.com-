import type { DealerStaffRole } from './dealer-app';
import { listDealerStaff } from './dealer-app';
import { dealerStaffRoleLabel } from './dealer-app-access';
import {
  listDealerTrackedAssets,
  type DealerMaintenanceRecordSummary,
  type DealerMaintenanceTrackedAsset,
} from './dealer-maintenance-tracker';
import { getDb } from './db';

export type DealerProblemPriority = 'low' | 'normal' | 'high' | 'urgent';
export type DealerProblemWorkflowStatus = 'new' | 'assigned' | 'in_progress' | 'waiting' | 'resolved';
export type DealerOverviewSection = 'needs_attention' | 'coming_up';

export type DealerOverviewStaff = {
  id: string;
  displayName: string;
  role: DealerStaffRole;
  roleLabel: string;
};

export type DealerOverviewItem = {
  id: string;
  sourceId: string;
  sourceKind: 'problem' | 'maintenance';
  type: 'problem' | 'service' | 'checkup';
  section: DealerOverviewSection;
  status: 'problem' | 'overdue' | 'due' | 'due_soon' | 'upcoming' | 'usage_needed';
  statusLabel: string;
  assetId: string;
  accessId: string;
  assetTitle: string;
  headline: string;
  detail: string;
  notes: string;
  href: string;
  createdAtIso: string;
  assignedStaffId: string | null;
  assignedStaffName: string;
  assignedStaffRole: DealerStaffRole | null;
  priority: DealerProblemPriority;
  workflowStatus: DealerProblemWorkflowStatus;
  dueDate: string | null;
};

export type DealerOverviewData = {
  role: DealerStaffRole;
  roleLabel: string;
  currentStaffId: string | null;
  canManageAssignments: boolean;
  staff: DealerOverviewStaff[];
  items: DealerOverviewItem[];
};

type AssignmentRow = {
  issue_note_status_id: string;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  assigned_staff_role: DealerStaffRole | null;
  priority: DealerProblemPriority;
  workflow_status: DealerProblemWorkflowStatus;
  due_date: string | Date | null;
};

const ATTENTION_STATUSES = new Set(['overdue', 'due', 'due_soon', 'usage_needed']);
const PRIORITY_RANK: Record<DealerProblemPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
let assignmentStoragePromise: Promise<void> | null = null;
let overviewDismissalStoragePromise: Promise<void> | null = null;

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function dateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function priorityLabel(priority: DealerProblemPriority): string {
  return priority === 'normal' ? 'Normal priority' : `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`;
}

function workflowLabel(status: DealerProblemWorkflowStatus, assignedName: string): string {
  if (status === 'in_progress') return 'In progress';
  if (status === 'waiting') return 'Waiting';
  if (status === 'resolved') return 'Resolved';
  if (assignedName || status === 'assigned') return 'Assigned';
  return 'Unassigned';
}

function maintenanceDetail(record: DealerMaintenanceRecordSummary, asset: DealerMaintenanceTrackedAsset): string {
  if (record.triggerType === 'date' && record.dueDate) {
    return `Due ${formatDate(record.dueDate)}`;
  }
  if (record.dueUsage !== null) {
    const metric = record.usageMetric || asset.usageMetric;
    return `Due at ${record.dueUsage.toLocaleString('en-ZA')} ${metric === 'km' ? 'km' : metric === 'percentage' ? '%' : 'hours'}`;
  }
  return 'Review the saved maintenance schedule.';
}

async function ensureAssignmentStorage(): Promise<void> {
  if (!assignmentStoragePromise) {
    assignmentStoragePromise = (async () => {
      await getDb().query(`
        create table if not exists public.dealer_problem_assignments (
          id uuid primary key default gen_random_uuid(),
          dealer_user_id text not null,
          issue_note_status_id text not null,
          asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
          assigned_staff_id uuid references public.dealer_app_staff(id) on delete set null,
          assigned_by_staff_id uuid references public.dealer_app_staff(id) on delete set null,
          priority text not null default 'normal'
            check (priority in ('low', 'normal', 'high', 'urgent')),
          workflow_status text not null default 'new'
            check (workflow_status in ('new', 'assigned', 'in_progress', 'waiting', 'resolved')),
          due_date date,
          assigned_at timestamptz,
          resolved_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (dealer_user_id, issue_note_status_id)
        )
      `);
    })().catch((error) => {
      assignmentStoragePromise = null;
      throw error;
    });
  }
  await assignmentStoragePromise;
}

async function ensureOverviewDismissalStorage(): Promise<void> {
  if (!overviewDismissalStoragePromise) {
    overviewDismissalStoragePromise = (async () => {
      await getDb().query(`
        create table if not exists public.dealer_overview_dismissals (
          dealer_user_id text not null,
          source_kind text not null check (source_kind in ('maintenance', 'problem')),
          source_id text not null,
          overview_item_id text not null,
          asset_register_item_id uuid not null,
          dismissed_at timestamptz not null default now(),
          primary key (dealer_user_id, source_kind, source_id)
        )
      `);
      await getDb().query(`
        create index if not exists dealer_overview_dismissals_asset_idx
          on public.dealer_overview_dismissals (asset_register_item_id)
      `);
    })().catch((error) => {
      overviewDismissalStoragePromise = null;
      throw error;
    });
  }
  await overviewDismissalStoragePromise;
}

function dismissalKey(sourceKind: DealerOverviewItem['sourceKind'], sourceId: string): string {
  return `${sourceKind}\u0000${sourceId}`;
}

async function listDealerOverviewDismissalKeys(dealerUserId: string): Promise<Set<string>> {
  await ensureOverviewDismissalStorage();
  const result = await getDb().query<{ source_kind: DealerOverviewItem['sourceKind']; source_id: string }>(
    `
      select source_kind, source_id
      from public.dealer_overview_dismissals
      where dealer_user_id = $1
    `,
    [dealerUserId],
  );
  return new Set(result.rows.map((row) => dismissalKey(row.source_kind, row.source_id)));
}

async function listAssignments(dealerUserId: string, problemIds: string[]): Promise<Map<string, AssignmentRow>> {
  if (!problemIds.length) return new Map();
  await ensureAssignmentStorage();
  const result = await getDb().query<AssignmentRow>(
    `
      select
        assignment.issue_note_status_id,
        assignment.assigned_staff_id::text,
        staff.display_name as assigned_staff_name,
        staff.staff_role as assigned_staff_role,
        assignment.priority,
        assignment.workflow_status,
        assignment.due_date
      from public.dealer_problem_assignments assignment
      left join public.dealer_app_staff staff on staff.id = assignment.assigned_staff_id
      where assignment.dealer_user_id = $1
        and assignment.issue_note_status_id = any($2::text[])
    `,
    [dealerUserId, problemIds],
  );
  return new Map(result.rows.map((row) => [row.issue_note_status_id, row]));
}

function problemItems(
  assets: DealerMaintenanceTrackedAsset[],
  assignments: Map<string, AssignmentRow>,
): DealerOverviewItem[] {
  return assets.flatMap((asset) => asset.loggedProblems.flatMap((problem) => {
    if (problem.notedAtIso) return [];
    const assignment = assignments.get(problem.id);
    const workflowStatus = assignment?.workflow_status ?? 'new';
    if (workflowStatus === 'resolved') return [];
    const assignedStaffName = text(assignment?.assigned_staff_name);
    const priority = assignment?.priority ?? 'normal';
    const dueDate = dateOnly(assignment?.due_date);
    const noteDetails = [
      assignedStaffName ? `Assigned to ${assignedStaffName}` : 'Unassigned',
      priorityLabel(priority),
      dueDate ? `Due ${formatDate(dueDate)}` : '',
      problem.operatorName ? `Reported by ${problem.operatorName}` : '',
    ].filter(Boolean).join(' • ');

    return [{
      id: `problem:${problem.id}`,
      sourceId: problem.id,
      sourceKind: 'problem' as const,
      type: 'problem' as const,
      section: 'needs_attention' as const,
      status: 'problem' as const,
      statusLabel: workflowLabel(workflowStatus, assignedStaffName),
      assetId: asset.assetId,
      accessId: asset.accessId,
      assetTitle: asset.assetTitle,
      headline: problem.summary || 'Problem reported',
      detail: problem.note,
      notes: noteDetails,
      href: `/dealer/maintenance?open=${encodeURIComponent(asset.accessId)}`,
      createdAtIso: problem.createdAtIso,
      assignedStaffId: assignment?.assigned_staff_id ?? null,
      assignedStaffName,
      assignedStaffRole: assignment?.assigned_staff_role ?? null,
      priority,
      workflowStatus,
      dueDate,
    }];
  }));
}

function maintenanceItems(assets: DealerMaintenanceTrackedAsset[]): DealerOverviewItem[] {
  return assets.flatMap((asset) => asset.openMaintenanceRecords.map((record) => {
    const status = record.computedStatus === 'done' || record.computedStatus === 'cancelled'
      ? 'upcoming'
      : record.computedStatus;
    const section: DealerOverviewSection = ATTENTION_STATUSES.has(status)
      ? 'needs_attention'
      : 'coming_up';
    return {
      id: `maintenance:${record.id}`,
      sourceId: record.id,
      sourceKind: 'maintenance' as const,
      type: record.maintenanceType,
      section,
      status,
      statusLabel: record.computedStatusLabel,
      assetId: asset.assetId,
      accessId: asset.accessId,
      assetTitle: asset.assetTitle,
      headline: record.title,
      detail: maintenanceDetail(record, asset),
      notes: [record.assignedName ? `Assigned to ${record.assignedName}` : '', record.notes].filter(Boolean).join(' • '),
      href: `/dealer/maintenance?open=${encodeURIComponent(asset.accessId)}`,
      createdAtIso: record.createdAtIso,
      assignedStaffId: null,
      assignedStaffName: record.assignedName,
      assignedStaffRole: null,
      priority: 'normal' as const,
      workflowStatus: 'new' as const,
      dueDate: record.dueDate,
    };
  }));
}

function sortItems(items: DealerOverviewItem[]): DealerOverviewItem[] {
  const statusRank = (item: DealerOverviewItem) => {
    if (item.sourceKind === 'problem') return PRIORITY_RANK[item.priority];
    return ({ overdue: 0, due: 1, due_soon: 2, usage_needed: 3, upcoming: 4 } as Record<string, number>)[item.status] ?? 9;
  };
  return [...items].sort((left, right) => {
    if (left.section !== right.section) return left.section === 'needs_attention' ? -1 : 1;
    if (left.sourceKind !== right.sourceKind) return left.sourceKind === 'problem' ? -1 : 1;
    const rank = statusRank(left) - statusRank(right);
    if (rank) return rank;
    return Date.parse(right.createdAtIso) - Date.parse(left.createdAtIso);
  });
}

export async function listDealerOverview(input: {
  dealerUserId: string;
  currentStaffId: string | null;
  role: DealerStaffRole;
}): Promise<DealerOverviewData> {
  const [assets, staffRecords, dismissalKeys] = await Promise.all([
    listDealerTrackedAssets(input.dealerUserId),
    listDealerStaff(input.dealerUserId),
    listDealerOverviewDismissalKeys(input.dealerUserId),
  ]);
  const problemIds = assets.flatMap((asset) => asset.loggedProblems.map((problem) => problem.id));
  const assignments = await listAssignments(input.dealerUserId, problemIds);
  const staff = staffRecords
    .filter((record) => record.isActive)
    .map((record) => ({
      id: record.id,
      displayName: record.displayName,
      role: record.role,
      roleLabel: dealerStaffRoleLabel(record.role),
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return {
    role: input.role,
    roleLabel: dealerStaffRoleLabel(input.role),
    currentStaffId: input.currentStaffId,
    canManageAssignments: input.role === 'owner',
    staff,
    items: sortItems([
      ...problemItems(assets, assignments),
      ...maintenanceItems(assets),
    ]).filter((item) => !dismissalKeys.has(dismissalKey(item.sourceKind, item.sourceId))),
  };
}

export async function dismissDealerOverviewItem(input: {
  dealerUserId: string;
  item: DealerOverviewItem;
}): Promise<void> {
  await ensureOverviewDismissalStorage();
  await getDb().query(
    `
      insert into public.dealer_overview_dismissals (
        dealer_user_id,
        source_kind,
        source_id,
        overview_item_id,
        asset_register_item_id,
        dismissed_at
      ) values ($1, $2, $3, $4, $5::uuid, now())
      on conflict (dealer_user_id, source_kind, source_id) do update set
        overview_item_id = excluded.overview_item_id,
        asset_register_item_id = excluded.asset_register_item_id,
        dismissed_at = now()
    `,
    [
      input.dealerUserId,
      input.item.sourceKind,
      input.item.sourceId,
      input.item.id,
      input.item.assetId,
    ],
  );
}

export async function resolveDealerOverviewProblemAssignment(
  dealerUserId: string,
  issueNoteStatusId: string,
): Promise<void> {
  await ensureAssignmentStorage();
  await getDb().query(
    `
      update public.dealer_problem_assignments
      set workflow_status = 'resolved', resolved_at = coalesce(resolved_at, now()), updated_at = now()
      where dealer_user_id = $1 and issue_note_status_id = $2
    `,
    [dealerUserId, issueNoteStatusId],
  );
}

export async function updateDealerProblemAssignment(input: {
  dealerUserId: string;
  actorStaffId: string | null;
  issueNoteStatusId: string;
  assignedStaffId: string | null;
  priority: DealerProblemPriority;
  workflowStatus: DealerProblemWorkflowStatus;
  dueDate: string | null;
}): Promise<void> {
  const priorities = new Set<DealerProblemPriority>(['low', 'normal', 'high', 'urgent']);
  const statuses = new Set<DealerProblemWorkflowStatus>(['new', 'assigned', 'in_progress', 'waiting', 'resolved']);
  if (!priorities.has(input.priority) || !statuses.has(input.workflowStatus)) {
    throw new Error('Choose valid problem assignment details.');
  }

  const assets = await listDealerTrackedAssets(input.dealerUserId);
  const asset = assets.find((candidate) => candidate.loggedProblems.some(
    (problem) => problem.id === input.issueNoteStatusId && !problem.notedAtIso,
  ));
  if (!asset) throw new Error('This problem is no longer available.');

  if (input.assignedStaffId) {
    const staff = await listDealerStaff(input.dealerUserId);
    const assignee = staff.find((candidate) => candidate.id === input.assignedStaffId && candidate.isActive);
    if (!assignee) throw new Error('Choose an active Dealer App staff member.');
  }

  const dueDate = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
  const workflowStatus = input.assignedStaffId && input.workflowStatus === 'new'
    ? 'assigned'
    : !input.assignedStaffId && input.workflowStatus === 'assigned'
      ? 'new'
      : input.workflowStatus;

  await ensureAssignmentStorage();
  await getDb().query(
    `
      insert into public.dealer_problem_assignments (
        dealer_user_id,
        issue_note_status_id,
        asset_register_item_id,
        assigned_staff_id,
        assigned_by_staff_id,
        priority,
        workflow_status,
        due_date,
        assigned_at,
        resolved_at,
        updated_at
      )
      values (
        $1, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8::date,
        case when $4::uuid is null then null else now() end,
        case when $7 = 'resolved' then now() else null end,
        now()
      )
      on conflict (dealer_user_id, issue_note_status_id)
      do update set
        asset_register_item_id = excluded.asset_register_item_id,
        assigned_staff_id = excluded.assigned_staff_id,
        assigned_by_staff_id = excluded.assigned_by_staff_id,
        priority = excluded.priority,
        workflow_status = excluded.workflow_status,
        due_date = excluded.due_date,
        assigned_at = case
          when excluded.assigned_staff_id is distinct from dealer_problem_assignments.assigned_staff_id
            then excluded.assigned_at
          else dealer_problem_assignments.assigned_at
        end,
        resolved_at = case when excluded.workflow_status = 'resolved' then now() else null end,
        updated_at = now()
    `,
    [
      input.dealerUserId,
      input.issueNoteStatusId,
      asset.assetId,
      input.assignedStaffId,
      input.actorStaffId,
      input.priority,
      workflowStatus,
      dueDate,
    ],
  );
}
