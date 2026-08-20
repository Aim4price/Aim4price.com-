import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { isAim4priceAdminEmail } from "./account-constants";
import { ensureAccountProfileColumns } from "./account-profile";
import {
  ADMIN_WORK_NOTE_MAX_LENGTH,
  calculateAdminWorkHeartbeatSeconds,
  getAdminWorkPeriodRange,
  getJohannesburgDateKey,
  resolveAdminWorkPage,
  type AdminWorkHistory,
  type AdminWorkPage,
  type AdminWorkPageTotal,
  type AdminWorkPeriod,
  type AdminWorkSessionView,
} from "./admin-work-tracker-shared";
import { getDb } from "./db";

type Queryable = Pool | PoolClient;

export type AdminWorkClient = {
  userId: string;
  name: string;
  email: string;
  accountType: string;
};

type DbAdminWorkClient = {
  user_id: string;
  auth_name: string | null;
  email: string | null;
  display_name: string | null;
  account_type: string | null;
};

type DbAdminWorkSession = {
  id: string;
  admin_user_id: string;
  client_user_id: string;
  client_name: string;
  client_email: string;
  client_account_type: string;
  started_at: string | Date;
  stopped_at: string | Date | null;
  last_heartbeat_at: string | Date;
  duration_seconds: number | string;
  current_page_key: string;
  current_page_label: string;
  tracking_active: boolean;
  note: string;
  include_in_report: boolean;
  show_times_in_report: boolean;
  show_note_in_report: boolean;
};

type DbAdminWorkPageTotal = {
  session_id: string;
  page_key: string;
  page_label: string;
  duration_seconds: number | string;
  first_seen_at: string | Date | null;
  last_seen_at: string | Date | null;
};

type AdminWorkPageSelection = {
  pages: AdminWorkPageTotal[];
  firstSeenAtIso: string | null;
  lastSeenAtIso: string | null;
};

export class AdminWorkTrackerError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminWorkTrackerError";
    this.status = status;
  }
}

let schemaPromise: Promise<void> | null = null;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function toSafeSeconds(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function toIso(value: string | Date | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapClient(row: DbAdminWorkClient): AdminWorkClient {
  const email = cleanText(row.email, 320);
  return {
    userId: cleanText(row.user_id, 200),
    name:
      cleanText(row.display_name, 240) ||
      cleanText(row.auth_name, 240) ||
      email ||
      "Unnamed account",
    email,
    accountType: cleanText(row.account_type, 80) || "owner",
  };
}

function mapPageTotal(row: DbAdminWorkPageTotal): AdminWorkPageTotal {
  return {
    pageKey: cleanText(row.page_key, 100),
    pageLabel: cleanText(row.page_label, 160) || "Other account page",
    durationSeconds: toSafeSeconds(row.duration_seconds),
  };
}

function mapSession(
  row: DbAdminWorkSession,
  pages: AdminWorkPageTotal[] = [],
  durationSecondsOverride?: number,
  startedAtIsoOverride?: string | null,
  stoppedAtIsoOverride?: string | null,
): AdminWorkSessionView {
  return {
    id: row.id,
    clientUserId: row.client_user_id,
    clientName: row.client_name || row.client_email || "Unnamed account",
    clientEmail: row.client_email,
    clientAccountType: row.client_account_type || "owner",
    startedAtIso:
      startedAtIsoOverride || toIso(row.started_at) || new Date().toISOString(),
    stoppedAtIso:
      stoppedAtIsoOverride === undefined
        ? toIso(row.stopped_at)
        : stoppedAtIsoOverride,
    lastHeartbeatAtIso: toIso(row.last_heartbeat_at) || new Date().toISOString(),
    durationSeconds:
      typeof durationSecondsOverride === "number"
        ? toSafeSeconds(durationSecondsOverride)
        : toSafeSeconds(row.duration_seconds),
    currentPageKey: row.current_page_key,
    currentPageLabel: row.current_page_label,
    trackingActive: Boolean(row.tracking_active),
    note: row.note || "",
    includeInReport: Boolean(row.include_in_report),
    showTimesInReport: Boolean(row.show_times_in_report),
    showNoteInReport: Boolean(row.show_note_in_report),
    pages,
  };
}

async function createSchema(): Promise<void> {
  const db = getDb();

  await db.query(`
    create table if not exists public.admin_work_sessions (
      id text primary key,
      admin_user_id text not null,
      client_user_id text not null,
      client_name text not null default '',
      client_email text not null default '',
      client_account_type text not null default '',
      started_at timestamptz not null default now(),
      stopped_at timestamptz,
      last_heartbeat_at timestamptz not null default now(),
      duration_seconds integer not null default 0,
      current_page_key text not null default 'admin-users',
      current_page_label text not null default 'Admin - User Accounts',
      tracking_active boolean not null default true,
      note text not null default '',
      include_in_report boolean not null default true,
      show_times_in_report boolean not null default false,
      show_note_in_report boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table public.admin_work_sessions
      add column if not exists admin_user_id text,
      add column if not exists client_user_id text,
      add column if not exists client_name text not null default '',
      add column if not exists client_email text not null default '',
      add column if not exists client_account_type text not null default '',
      add column if not exists started_at timestamptz not null default now(),
      add column if not exists stopped_at timestamptz,
      add column if not exists last_heartbeat_at timestamptz not null default now(),
      add column if not exists duration_seconds integer not null default 0,
      add column if not exists current_page_key text not null default 'admin-users',
      add column if not exists current_page_label text not null default 'Admin - User Accounts',
      add column if not exists tracking_active boolean not null default true,
      add column if not exists note text not null default '',
      add column if not exists include_in_report boolean not null default true,
      add column if not exists show_times_in_report boolean not null default false,
      add column if not exists show_note_in_report boolean not null default false,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    create unique index if not exists idx_admin_work_sessions_one_active_per_admin
      on public.admin_work_sessions(admin_user_id)
      where stopped_at is null
  `);
  await db.query(`
    create index if not exists idx_admin_work_sessions_admin_started
      on public.admin_work_sessions(admin_user_id, started_at desc)
  `);
  await db.query(`
    create index if not exists idx_admin_work_sessions_client_started
      on public.admin_work_sessions(client_user_id, started_at desc)
  `);

  await db.query(`
    create table if not exists public.admin_work_page_totals (
      session_id text not null references public.admin_work_sessions(id) on delete cascade,
      work_date date not null,
      page_key text not null,
      page_label text not null,
      duration_seconds integer not null default 0,
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      primary key (session_id, work_date, page_key)
    )
  `);
  await db.query(`
    create index if not exists idx_admin_work_page_totals_work_date
      on public.admin_work_page_totals(work_date, session_id)
  `);
}

export async function ensureAdminWorkTrackerSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;
}

async function queryClient(userId: string): Promise<AdminWorkClient> {
  await ensureAccountProfileColumns();
  const db = getDb();
  const result = await db.query<DbAdminWorkClient>(
    `
      select
        u.id as user_id,
        u.name as auth_name,
        u.email,
        ap.display_name,
        ap.account_type
      from "user" u
      left join public.account_profiles ap on ap.user_id = u.id
      where u.id = $1
      limit 1
    `,
    [userId],
  );
  const row = result.rows[0];

  if (!row) throw new AdminWorkTrackerError("Account not found.", 404);
  if (isAim4priceAdminEmail(row.email)) {
    throw new AdminWorkTrackerError("The Aim4price admin account cannot be tracked as a client.");
  }

  return mapClient(row);
}

export async function getAdminWorkClient(userIdInput: unknown): Promise<AdminWorkClient> {
  const userId = cleanText(userIdInput, 200);
  if (!userId) throw new AdminWorkTrackerError("Choose an account.");
  return queryClient(userId);
}

export async function listAdminWorkClients(): Promise<AdminWorkClient[]> {
  await ensureAccountProfileColumns();
  const db = getDb();
  const result = await db.query<DbAdminWorkClient>(`
    select
      u.id as user_id,
      u.name as auth_name,
      u.email,
      ap.display_name,
      ap.account_type
    from "user" u
    left join public.account_profiles ap on ap.user_id = u.id
    order by lower(coalesce(ap.display_name, u.name, u.email, '')) asc
  `);

  return result.rows
    .filter((row) => !isAim4priceAdminEmail(row.email))
    .map(mapClient)
    .filter((client) => Boolean(client.userId));
}

async function readPageTotals(
  queryable: Queryable,
  sessionIds: string[],
  dateRange?: { startDate: string; endDateExclusive: string },
): Promise<Map<string, AdminWorkPageSelection>> {
  const bySession = new Map<string, AdminWorkPageSelection>();
  if (!sessionIds.length) return bySession;

  const result = await queryable.query<DbAdminWorkPageTotal>(
    `
      select
        session_id,
        page_key,
        max(page_label) as page_label,
        sum(duration_seconds)::bigint as duration_seconds,
        min(first_seen_at) as first_seen_at,
        max(last_seen_at) as last_seen_at
      from public.admin_work_page_totals
      where session_id = any($1::text[])
        and (nullif($2::text, '') is null or work_date >= nullif($2::text, '')::date)
        and (nullif($3::text, '') is null or work_date < nullif($3::text, '')::date)
      group by session_id, page_key
      order by sum(duration_seconds) desc, max(page_label) asc
    `,
    [sessionIds, dateRange?.startDate ?? "", dateRange?.endDateExclusive ?? ""],
  );

  for (const row of result.rows) {
    const existing = bySession.get(row.session_id) ?? {
      pages: [],
      firstSeenAtIso: null,
      lastSeenAtIso: null,
    };
    const firstSeenAtIso = toIso(row.first_seen_at);
    const lastSeenAtIso = toIso(row.last_seen_at);
    existing.pages.push(mapPageTotal(row));
    if (
      firstSeenAtIso &&
      (!existing.firstSeenAtIso || firstSeenAtIso < existing.firstSeenAtIso)
    ) {
      existing.firstSeenAtIso = firstSeenAtIso;
    }
    if (
      lastSeenAtIso &&
      (!existing.lastSeenAtIso || lastSeenAtIso > existing.lastSeenAtIso)
    ) {
      existing.lastSeenAtIso = lastSeenAtIso;
    }
    bySession.set(row.session_id, existing);
  }

  return bySession;
}

async function readActiveRow(
  queryable: Queryable,
  adminUserId: string,
  lock = false,
): Promise<DbAdminWorkSession | null> {
  const result = await queryable.query<DbAdminWorkSession>(
    `
      select *
      from public.admin_work_sessions
      where admin_user_id = $1
        and stopped_at is null
      order by started_at desc
      limit 1
      ${lock ? "for update" : ""}
    `,
    [adminUserId],
  );
  return result.rows[0] ?? null;
}

async function readDatabaseNow(queryable: Queryable): Promise<Date> {
  const result = await queryable.query<{ current_time: string | Date }>(
    "select clock_timestamp() as current_time",
  );
  const value = result.rows[0]?.current_time;
  const currentTime = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(currentTime.getTime())) {
    throw new AdminWorkTrackerError("The work timer clock could not be read.", 500);
  }
  return currentTime;
}

export async function getActiveAdminWorkSession(
  adminUserIdInput: unknown,
): Promise<AdminWorkSessionView | null> {
  const adminUserId = cleanText(adminUserIdInput, 200);
  if (!adminUserId) return null;
  await ensureAdminWorkTrackerSchema();

  const db = getDb();
  const row = await readActiveRow(db, adminUserId);
  if (!row) return null;
  const pageSelection = (await readPageTotals(db, [row.id])).get(row.id);
  return mapSession(row, pageSelection?.pages ?? []);
}

function canTrackPage(
  page: AdminWorkPage,
  clientUserId: string,
  supportTargetUserId: string | null,
): boolean {
  return page.isAdminArea || supportTargetUserId === clientUserId;
}

export async function startAdminWorkSession(input: {
  adminUserId: string;
  clientUserId: unknown;
  pathname: unknown;
  supportTargetUserId: string | null;
}): Promise<AdminWorkSessionView> {
  const adminUserId = cleanText(input.adminUserId, 200);
  if (!adminUserId) throw new AdminWorkTrackerError("Admin access required.", 403);
  const client = await getAdminWorkClient(input.clientUserId);
  const page = resolveAdminWorkPage(input.pathname);
  await ensureAdminWorkTrackerSchema();

  const db = getDb();
  const connection = await db.connect();

  try {
    await connection.query("begin");
    const existing = await readActiveRow(connection, adminUserId, true);

    if (existing) {
      if (existing.client_user_id !== client.userId) {
        throw new AdminWorkTrackerError(
          `Work is already running for ${existing.client_name || existing.client_email || "another account"}. Stop it before starting a new account.`,
          409,
        );
      }

      await connection.query("commit");
      const pageSelection = (await readPageTotals(connection, [existing.id])).get(existing.id);
      return mapSession(existing, pageSelection?.pages ?? []);
    }

    await connection.query(
      `
        insert into public.admin_work_sessions (
          id,
          admin_user_id,
          client_user_id,
          client_name,
          client_email,
          client_account_type,
          started_at,
          last_heartbeat_at,
          duration_seconds,
          current_page_key,
          current_page_label,
          tracking_active,
          note,
          include_in_report,
          show_times_in_report,
          show_note_in_report,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, now(), now(), 0, $7, $8, $9, '', true, false, false, now(), now())
      `,
      [
        randomUUID(),
        adminUserId,
        client.userId,
        client.name,
        client.email,
        client.accountType,
        page.key,
        page.label,
        canTrackPage(page, client.userId, input.supportTargetUserId),
      ],
    );
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback").catch(() => undefined);
    if ((error as { code?: string })?.code === "23505") {
      throw new AdminWorkTrackerError("A work timer is already running. Stop it before starting another.", 409);
    }
    throw error;
  } finally {
    connection.release();
  }

  const active = await getActiveAdminWorkSession(adminUserId);
  if (!active) throw new AdminWorkTrackerError("The work timer could not be started.", 500);
  return active;
}

async function upsertElapsedPageTotal(
  connection: PoolClient,
  row: DbAdminWorkSession,
  workDate: string,
  elapsedSeconds: number,
  firstSeenAt: string,
  lastSeenAt: string,
): Promise<void> {
  if (!elapsedSeconds || !row.current_page_key) return;

  await connection.query(
    `
      insert into public.admin_work_page_totals (
        session_id,
        work_date,
        page_key,
        page_label,
        duration_seconds,
        first_seen_at,
        last_seen_at
      )
      values ($1, $2::date, $3, $4, $5, $6::timestamptz, $7::timestamptz)
      on conflict (session_id, work_date, page_key)
      do update set
        page_label = excluded.page_label,
        duration_seconds = public.admin_work_page_totals.duration_seconds + excluded.duration_seconds,
        first_seen_at = least(public.admin_work_page_totals.first_seen_at, excluded.first_seen_at),
        last_seen_at = greatest(public.admin_work_page_totals.last_seen_at, excluded.last_seen_at)
    `,
    [
      row.id,
      workDate,
      row.current_page_key,
      row.current_page_label,
      elapsedSeconds,
      firstSeenAt,
      lastSeenAt,
    ],
  );
}

function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

async function addElapsedPageTotal(
  connection: PoolClient,
  row: DbAdminWorkSession,
  elapsedSeconds: number,
  now: Date,
): Promise<void> {
  if (!elapsedSeconds || !row.current_page_key) return;
  const intervalStart = new Date(row.last_heartbeat_at);
  const firstSeenAt = toIso(row.last_heartbeat_at) || now.toISOString();
  const startDate = getJohannesburgDateKey(intervalStart);
  const endDate = getJohannesburgDateKey(now);

  if (startDate === endDate) {
    await upsertElapsedPageTotal(
      connection,
      row,
      startDate,
      elapsedSeconds,
      firstSeenAt,
      now.toISOString(),
    );
    return;
  }

  const followingDate = nextDateKey(startDate);
  const localMidnight = new Date(`${followingDate}T00:00:00+02:00`);
  const secondsBeforeMidnight = Math.min(
    elapsedSeconds,
    Math.max(0, Math.floor((localMidnight.getTime() - intervalStart.getTime()) / 1_000)),
  );
  const secondsAfterMidnight = Math.max(0, elapsedSeconds - secondsBeforeMidnight);

  await upsertElapsedPageTotal(
    connection,
    row,
    startDate,
    secondsBeforeMidnight,
    firstSeenAt,
    localMidnight.toISOString(),
  );
  await upsertElapsedPageTotal(
    connection,
    row,
    endDate,
    secondsAfterMidnight,
    localMidnight.toISOString(),
    now.toISOString(),
  );
}

export async function heartbeatAdminWorkSession(input: {
  adminUserId: string;
  sessionId: unknown;
  pathname: unknown;
  browserActive: boolean;
  supportTargetUserId: string | null;
}): Promise<AdminWorkSessionView | null> {
  const adminUserId = cleanText(input.adminUserId, 200);
  const expectedSessionId = cleanText(input.sessionId, 200);
  if (!adminUserId || !expectedSessionId) return null;
  await ensureAdminWorkTrackerSchema();

  const page = resolveAdminWorkPage(input.pathname);
  const db = getDb();
  const connection = await db.connect();
  let updatedRow: DbAdminWorkSession | null = null;

  try {
    await connection.query("begin");
    const row = await readActiveRow(connection, adminUserId, true);

    if (!row) {
      await connection.query("commit");
      return null;
    }
    if (expectedSessionId !== row.id) {
      await connection.query("commit");
      return null;
    }

    const now = await readDatabaseNow(connection);
    const elapsedSeconds = calculateAdminWorkHeartbeatSeconds(
      row.last_heartbeat_at,
      now,
      row.tracking_active,
    );
    await addElapsedPageTotal(connection, row, elapsedSeconds, now);

    const nextTrackingActive =
      Boolean(input.browserActive) &&
      canTrackPage(page, row.client_user_id, input.supportTargetUserId);
    const result = await connection.query<DbAdminWorkSession>(
      `
        update public.admin_work_sessions
        set
          duration_seconds = duration_seconds + $3,
          last_heartbeat_at = $4::timestamptz,
          current_page_key = $5,
          current_page_label = $6,
          tracking_active = $7,
          updated_at = now()
        where id = $1
          and admin_user_id = $2
          and stopped_at is null
        returning *
      `,
      [row.id, adminUserId, elapsedSeconds, now.toISOString(), page.key, page.label, nextTrackingActive],
    );
    updatedRow = result.rows[0] ?? null;
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }

  if (!updatedRow) return null;
  const pageSelection = (await readPageTotals(db, [updatedRow.id])).get(updatedRow.id);
  return mapSession(updatedRow, pageSelection?.pages ?? []);
}

export async function stopAdminWorkSession(input: {
  adminUserId: string;
  sessionId: unknown;
}): Promise<AdminWorkSessionView | null> {
  const adminUserId = cleanText(input.adminUserId, 200);
  const expectedSessionId = cleanText(input.sessionId, 200);
  if (!adminUserId) return null;
  if (!expectedSessionId) {
    throw new AdminWorkTrackerError("The active work session changed. Refresh and try again.", 409);
  }
  await ensureAdminWorkTrackerSchema();

  const db = getDb();
  const connection = await db.connect();
  let stoppedRow: DbAdminWorkSession | null = null;

  try {
    await connection.query("begin");
    const row = await readActiveRow(connection, adminUserId, true);

    if (!row) {
      await connection.query("commit");
      return null;
    }
    if (expectedSessionId !== row.id) {
      throw new AdminWorkTrackerError("The active work session changed. Refresh and try again.", 409);
    }

    const now = await readDatabaseNow(connection);
    const elapsedSeconds = calculateAdminWorkHeartbeatSeconds(
      row.last_heartbeat_at,
      now,
      row.tracking_active,
    );
    await addElapsedPageTotal(connection, row, elapsedSeconds, now);

    const result = await connection.query<DbAdminWorkSession>(
      `
        update public.admin_work_sessions
        set
          duration_seconds = duration_seconds + $3,
          stopped_at = $4::timestamptz,
          last_heartbeat_at = $4::timestamptz,
          tracking_active = false,
          updated_at = now()
        where id = $1
          and admin_user_id = $2
          and stopped_at is null
        returning *
      `,
      [row.id, adminUserId, elapsedSeconds, now.toISOString()],
    );
    stoppedRow = result.rows[0] ?? null;
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }

  if (!stoppedRow) return null;
  const pageSelection = (await readPageTotals(db, [stoppedRow.id])).get(stoppedRow.id);
  return mapSession(stoppedRow, pageSelection?.pages ?? []);
}

export async function updateAdminWorkSession(input: {
  adminUserId: string;
  sessionId: unknown;
  note?: unknown;
  includeInReport?: unknown;
  showTimesInReport?: unknown;
  showNoteInReport?: unknown;
}): Promise<AdminWorkSessionView> {
  const adminUserId = cleanText(input.adminUserId, 200);
  const sessionId = cleanText(input.sessionId, 200);
  if (!adminUserId || !sessionId) throw new AdminWorkTrackerError("Work session not found.", 404);
  await ensureAdminWorkTrackerSchema();

  const hasNote = typeof input.note === "string";
  const hasInclude = typeof input.includeInReport === "boolean";
  const hasShowTimes = typeof input.showTimesInReport === "boolean";
  const hasShowNote = typeof input.showNoteInReport === "boolean";

  if (!hasNote && !hasInclude && !hasShowTimes && !hasShowNote) {
    throw new AdminWorkTrackerError("No work session changes were supplied.");
  }

  const db = getDb();
  const result = await db.query<DbAdminWorkSession>(
    `
      update public.admin_work_sessions
      set
        note = case when $3 then $4 else note end,
        include_in_report = case when $5 then $6 else include_in_report end,
        show_times_in_report = case when $7 then $8 else show_times_in_report end,
        show_note_in_report = case when $9 then $10 else show_note_in_report end,
        updated_at = now()
      where id = $1
        and admin_user_id = $2
      returning *
    `,
    [
      sessionId,
      adminUserId,
      hasNote,
      cleanText(input.note, ADMIN_WORK_NOTE_MAX_LENGTH),
      hasInclude,
      input.includeInReport === true,
      hasShowTimes,
      input.showTimesInReport === true,
      hasShowNote,
      input.showNoteInReport === true,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new AdminWorkTrackerError("Work session not found.", 404);
  const pageSelection = (await readPageTotals(db, [row.id])).get(row.id);
  return mapSession(row, pageSelection?.pages ?? []);
}

export async function deleteAdminWorkSession(input: {
  adminUserId: string;
  sessionId: unknown;
}): Promise<string> {
  const adminUserId = cleanText(input.adminUserId, 200);
  const sessionId = cleanText(input.sessionId, 200);
  if (!adminUserId || !sessionId) {
    throw new AdminWorkTrackerError("Completed work session not found.", 404);
  }
  await ensureAdminWorkTrackerSchema();

  const result = await getDb().query<{ id: string }>(
    `
      delete from public.admin_work_sessions
      where id = $1
        and admin_user_id = $2
        and stopped_at is not null
      returning id
    `,
    [sessionId, adminUserId],
  );
  const deletedSessionId = result.rows[0]?.id;
  if (!deletedSessionId) {
    throw new AdminWorkTrackerError("Completed work session not found.", 404);
  }

  return deletedSessionId;
}

export async function getAdminWorkHistory(input: {
  adminUserId: string;
  period?: unknown;
  anchor?: unknown;
  clientUserId?: unknown;
}): Promise<AdminWorkHistory> {
  const adminUserId = cleanText(input.adminUserId, 200);
  if (!adminUserId) throw new AdminWorkTrackerError("Admin access required.", 403);
  await ensureAdminWorkTrackerSchema();

  const range = getAdminWorkPeriodRange(input.period, input.anchor);
  const endDateExclusive = getJohannesburgDateKey(new Date(range.endIso));
  const clientUserId = cleanText(input.clientUserId, 200);
  const db = getDb();
  const result = await db.query<DbAdminWorkSession>(
    `
      select *
      from public.admin_work_sessions
      where admin_user_id = $1
        and stopped_at is not null
        and started_at < $3::timestamptz
        and stopped_at >= $2::timestamptz
        and ($4 = '' or client_user_id = $4)
      order by admin_work_sessions.started_at desc
    `,
    [adminUserId, range.startIso, range.endIso, clientUserId],
  );
  const pageTotals = await readPageTotals(
    db,
    result.rows.map((row) => row.id),
    { startDate: range.startDate, endDateExclusive },
  );
  const sessions = result.rows
    .map((row) => {
      const selection = pageTotals.get(row.id);
      const pages = selection?.pages ?? [];
      const periodSeconds = pages.reduce((total, page) => total + page.durationSeconds, 0);
      const periodStartedAt = selection?.firstSeenAtIso
        ? selection.firstSeenAtIso < range.startIso
          ? range.startIso
          : selection.firstSeenAtIso
        : undefined;
      const periodStoppedAt = selection?.lastSeenAtIso
        ? selection.lastSeenAtIso > range.endIso
          ? range.endIso
          : selection.lastSeenAtIso
        : undefined;
      return mapSession(
        row,
        pages,
        periodSeconds,
        periodStartedAt,
        periodStoppedAt,
      );
    });
  const included = sessions.filter((session) => session.includeInReport);
  const reportPageKeys = new Set(
    included.flatMap((session) => session.pages.map((page) => page.pageKey)),
  );

  return {
    period: range.period as AdminWorkPeriod,
    anchorDate: range.anchorDate,
    startDate: range.startDate,
    endDate: range.endDate,
    startIso: range.startIso,
    endIso: range.endIso,
    sessions,
    summary: {
      trackedSeconds: sessions.reduce((total, session) => total + session.durationSeconds, 0),
      reportableSeconds: included.reduce((total, session) => total + session.durationSeconds, 0),
      sessionCount: sessions.length,
      includedSessionCount: included.length,
      pageCount: reportPageKeys.size,
    },
  };
}
