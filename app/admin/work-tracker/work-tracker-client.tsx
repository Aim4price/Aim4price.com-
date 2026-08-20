"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ADMIN_WORK_NOTE_MAX_LENGTH,
  formatAdminWorkDuration,
  getJohannesburgDateKey,
  shiftAdminWorkAnchor,
  type AdminWorkHistory,
  type AdminWorkPeriod,
  type AdminWorkSessionView,
} from "../../../lib/admin-work-tracker-shared";
import styles from "./page.module.css";

type WorkClient = {
  userId: string;
  name: string;
  email: string;
  accountType: string;
};

type TrackerResponse = {
  ok?: boolean;
  activeSession?: AdminWorkSessionView | null;
  stoppedSession?: AdminWorkSessionView | null;
  workSession?: AdminWorkSessionView;
  history?: AdminWorkHistory;
  message?: string;
  error?: string;
};

type Notice = { tone: "success" | "error"; message: string } | null;

const TRACKER_CHANGED_EVENT = "aim4price:admin-work-session-changed";
const TRACKER_TICK_EVENT = "aim4price:admin-work-session-tick";
const REPORT_TIME_ZONE = "Africa/Johannesburg";

function formatAccountType(value: string): string {
  const clean = value.trim().toLowerCase();
  if (clean === "finance") return "Finance / Accounting";
  if (clean === "insurance") return "Insurance";
  if (clean === "licensing") return "Licensing";
  if (clean === "dealer") return "Dealer";
  return "Owner";
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

function formatDateTime(value: string | null): string {
  if (!value) return "In progress";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function periodRangeLabel(history: AdminWorkHistory | null): string {
  if (!history) return "Loading period…";
  return `${formatDate(history.startIso)} – ${formatDate(
    new Date(new Date(history.endIso).getTime() - 1_000).toISOString(),
  )}`;
}

function sortClients(clients: WorkClient[]): WorkClient[] {
  return [...clients].sort((left, right) =>
    left.name.localeCompare(right.name, "en-ZA", { sensitivity: "base" }),
  );
}

export default function WorkTrackerClient({ initialClients }: { initialClients: WorkClient[] }) {
  const clients = useMemo(() => sortClients(initialClients), [initialClients]);
  const [period, setPeriod] = useState<AdminWorkPeriod>("week");
  const [anchor, setAnchor] = useState(() => getJohannesburgDateKey());
  const [clientUserId, setClientUserId] = useState("");
  const [startClientUserId, setStartClientUserId] = useState("");
  const [activeSession, setActiveSession] = useState<AdminWorkSessionView | null>(null);
  const [history, setHistory] = useState<AdminWorkHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const draftNotesRef = useRef(draftNotes);
  const loadGenerationRef = useRef(0);
  const saveInFlightRef = useRef(false);

  draftNotesRef.current = draftNotes;

  const loadTracker = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        view: "history",
        period,
        anchor,
      });
      if (clientUserId) params.set("clientUserId", clientUserId);
      const response = await fetch(`/api/admin/work-tracker?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json()) as TrackerResponse;
      if (!response.ok || !data.ok || !data.history) {
        throw new Error(data.error || "Failed to load work history.");
      }
      if (generation !== loadGenerationRef.current) return;
      setHistory({
        ...data.history,
        sessions: data.history.sessions.map((session) => {
          const draft = draftNotesRef.current[session.id];
          return draft === undefined ? session : { ...session, note: draft };
        }),
      });
      setActiveSession((current) => {
        const incoming = data.activeSession ?? null;
        if (!incoming) return null;
        const draft = draftNotesRef.current[incoming.id];
        if (current?.id !== incoming.id) {
          return draft === undefined ? incoming : { ...incoming, note: draft };
        }
        return { ...incoming, note: draft === undefined ? incoming.note : draft };
      });
      setStartClientUserId((current) => current || data.activeSession?.clientUserId || "");
    } catch (error) {
      if (generation !== loadGenerationRef.current) return;
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load work history.",
      });
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    }
  }, [anchor, clientUserId, period]);

  useEffect(() => {
    void loadTracker();
  }, [loadTracker]);

  useEffect(() => {
    const handleChanged = () => void loadTracker();
    const handleTick = (event: Event) => {
      const detail = (event as CustomEvent<{ activeSession?: AdminWorkSessionView | null }>).detail;
      const incoming = detail?.activeSession ?? null;
      setActiveSession((current) => {
        if (!incoming) return null;
        const draft = draftNotesRef.current[incoming.id];
        if (current?.id !== incoming.id) {
          return draft === undefined ? incoming : { ...incoming, note: draft };
        }
        return { ...incoming, note: draft === undefined ? incoming.note : draft };
      });
    };
    window.addEventListener(TRACKER_CHANGED_EVENT, handleChanged);
    window.addEventListener(TRACKER_TICK_EVENT, handleTick);
    return () => {
      window.removeEventListener(TRACKER_CHANGED_EVENT, handleChanged);
      window.removeEventListener(TRACKER_TICK_EVENT, handleTick);
    };
  }, [loadTracker]);

  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id]);

  const activeLiveSeconds = useMemo(() => {
    if (!activeSession) return 0;
    if (!activeSession.trackingActive) return activeSession.durationSeconds;
    const lastHeartbeatMs = new Date(activeSession.lastHeartbeatAtIso).getTime();
    const extra = Number.isFinite(lastHeartbeatMs)
      ? Math.max(0, Math.min(90, Math.floor((nowMs - lastHeartbeatMs) / 1_000)))
      : 0;
    return activeSession.durationSeconds + extra;
  }, [activeSession, nowMs]);

  async function startWork() {
    if (!startClientUserId || isStarting) {
      setNotice({ tone: "error", message: "Choose an account before starting work." });
      return;
    }

    setIsStarting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/work-tracker", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          clientUserId: startClientUserId,
          pathname: "/admin/work-tracker",
        }),
      });
      const data = (await response.json()) as TrackerResponse;
      if (!response.ok || !data.ok || !data.activeSession) {
        throw new Error(data.error || "Failed to start work.");
      }
      setActiveSession(data.activeSession);
      setClientUserId(data.activeSession.clientUserId);
      setNotice({ tone: "success", message: data.message || "Work timer started." });
      window.dispatchEvent(new Event(TRACKER_CHANGED_EVENT));
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to start work.",
      });
    } finally {
      setIsStarting(false);
    }
  }

  async function patchSession(
    sessionId: string,
    changes: Partial<Pick<AdminWorkSessionView, "note" | "includeInReport" | "showTimesInReport" | "showNoteInReport">>,
    showSuccess = false,
  ): Promise<AdminWorkSessionView | null> {
    if (saveInFlightRef.current) return null;
    saveInFlightRef.current = true;
    setSavingSessionId(sessionId);
    try {
      const response = await fetch("/api/admin/work-tracker", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...changes }),
      });
      const data = (await response.json()) as TrackerResponse;
      if (!response.ok || !data.ok || !data.workSession) {
        throw new Error(data.error || "Failed to update the work session.");
      }
      const updated = data.workSession;
      const latestDraft = draftNotesRef.current[updated.id];
      const preserveDraft =
        latestDraft !== undefined &&
        (typeof changes.note !== "string" || latestDraft !== changes.note);
      setActiveSession((current) => {
        if (current?.id !== updated.id) return current;
        return { ...updated, note: preserveDraft ? latestDraft : updated.note };
      });
      setHistory((current) =>
        current
          ? {
              ...current,
              sessions: current.sessions.map((session) => {
                if (session.id !== updated.id) return session;
                return { ...updated, note: preserveDraft ? latestDraft : updated.note };
              }),
            }
          : current,
      );
      if (typeof changes.note === "string" && latestDraft === changes.note) {
        setDraftNotes((current) => {
          if (current[sessionId] !== changes.note) return current;
          const next = { ...current };
          delete next[sessionId];
          return next;
        });
      }
      if (showSuccess) setNotice({ tone: "success", message: "Work note saved." });
      return updated;
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to update the work session.",
      });
      return null;
    } finally {
      saveInFlightRef.current = false;
      setSavingSessionId(null);
    }
  }

  async function stopWork() {
    if (!activeSession || isStopping) return;
    setIsStopping(true);
    setNotice(null);

    try {
      const saved = await patchSession(activeSession.id, { note: activeSession.note });
      if (!saved) return;
      const response = await fetch("/api/admin/work-tracker", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", sessionId: activeSession.id }),
      });
      const data = (await response.json()) as TrackerResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to stop work.");
      }
      setActiveSession(null);
      setNotice({ tone: "success", message: data.message || "Work timer stopped." });
      window.dispatchEvent(new Event(TRACKER_CHANGED_EVENT));
      await loadTracker();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to stop work.",
      });
    } finally {
      setIsStopping(false);
    }
  }

  function updateSessionLocal(sessionId: string, changes: Partial<AdminWorkSessionView>) {
    setActiveSession((current) => (current?.id === sessionId ? { ...current, ...changes } : current));
    setHistory((current) =>
      current
        ? {
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === sessionId ? { ...session, ...changes } : session,
            ),
          }
        : current,
    );
  }

  function updateSessionNote(sessionId: string, note: string) {
    updateSessionLocal(sessionId, { note });
    setDraftNotes((current) => ({ ...current, [sessionId]: note }));
  }

  function openReport() {
    if (!clientUserId) {
      setNotice({ tone: "error", message: "Choose one account before opening a report." });
      return;
    }
    if (savingSessionId) {
      setNotice({ tone: "error", message: "Wait for the report settings to finish saving." });
      return;
    }
    if (hasDirtyReportNotes) {
      setNotice({ tone: "error", message: "Save the edited work notes before opening this report." });
      return;
    }
    const params = new URLSearchParams({ clientUserId, period, anchor });
    window.open(`/api/admin/work-tracker/report?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  const selectedClient = clients.find((client) => client.userId === clientUserId) ?? null;
  const hasDirtyReportNotes = Boolean(
    clientUserId &&
      history?.sessions.some(
        (session) =>
          session.clientUserId === clientUserId &&
          Object.prototype.hasOwnProperty.call(draftNotes, session.id),
      ),
  );
  const displaySummary = useMemo(() => {
    const sessions = history?.sessions ?? [];
    const included = sessions.filter((session) => session.includeInReport);
    const pageKeys = new Set(included.flatMap((session) => session.pages.map((page) => page.pageKey)));
    return {
      trackedSeconds: sessions.reduce((total, session) => total + session.durationSeconds, 0),
      reportableSeconds: included.reduce((total, session) => total + session.durationSeconds, 0),
      sessionCount: sessions.length,
      includedSessionCount: included.length,
      pageCount: pageKeys.size,
    };
  }, [history]);

  return (
    <section className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Aim4price admin</p>
          <h1>Work tracker</h1>
          <span>Start and stop work, then prepare a simple owner report.</span>
        </div>
        <nav className={styles.adminNav} aria-label="Admin work tracker navigation">
          <Link href="/admin" className={styles.adminNavLink}>Users</Link>
          <Link href="/admin/dashboard" className={styles.adminNavLink}>Dashboard</Link>
          <Link href="/admin/work-tracker" className={`${styles.adminNavLink} ${styles.adminNavActive}`} aria-current="page">Work tracker</Link>
        </nav>
      </header>

      <section className={styles.privacyBanner}>
        <div>
          <strong>Admin-only by design</strong>
          <span>Owners never see the live timer or access history. They receive only the report Admin chooses to print or save.</span>
        </div>
      </section>

      {notice ? (
        <div
          className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </div>
      ) : null}

      <section className={`${styles.activeCard} ${activeSession ? styles.activeCardRunning : ""}`} aria-label="Active Admin work">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{activeSession ? "Work in progress" : "Start work"}</p>
            <h2>{activeSession ? activeSession.clientName : "Choose an account when work begins"}</h2>
          </div>
          {activeSession ? <strong className={styles.liveTime}>{formatAdminWorkDuration(activeLiveSeconds)}</strong> : null}
        </div>

        {activeSession ? (
          <div className={styles.activeLayout}>
            <div className={styles.activeDetails}>
              <div><span>Current page</span><strong>{activeSession.currentPageLabel}</strong></div>
              <div><span>Started</span><strong>{formatDateTime(activeSession.startedAtIso)}</strong></div>
              <div><span>Status</span><strong>{activeSession.trackingActive ? "Recording active time" : "Open, but paused"}</strong></div>
            </div>
            <label className={styles.noteField}>
              <span>Optional work note</span>
              <textarea
                value={activeSession.note}
                maxLength={ADMIN_WORK_NOTE_MAX_LENGTH}
                onChange={(event) => updateSessionNote(activeSession.id, event.target.value)}
                placeholder="Short summary for later, for example: Reviewed asset register and updated account settings."
              />
              <small>Private unless “Include note” is switched on after the session.</small>
            </label>
            <div className={styles.activeActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => void patchSession(activeSession.id, { note: activeSession.note }, true)} disabled={savingSessionId !== null || isStopping || !Object.prototype.hasOwnProperty.call(draftNotes, activeSession.id)}>
                {savingSessionId === activeSession.id ? "Saving…" : "Save note"}
              </button>
              <button type="button" className={styles.stopButton} onClick={() => void stopWork()} disabled={isStopping || savingSessionId !== null}>
                {isStopping ? "Stopping…" : "Stop work"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.startRow}>
            <label>
              <span>Account</span>
              <select value={startClientUserId} onChange={(event) => setStartClientUserId(event.target.value)}>
                <option value="">Choose an account</option>
                {clients.map((client) => (
                  <option key={client.userId} value={client.userId}>
                    {client.name} · {formatAccountType(client.accountType)}{client.email ? ` · ${client.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={styles.startButton} onClick={() => void startWork()} disabled={isStarting || !startClientUserId}>
              {isStarting ? "Starting…" : "Start work"}
            </button>
          </div>
        )}
      </section>

      <section className={styles.historyCard} aria-label="Weekly and monthly work history">
        <div className={styles.historyToolbar}>
          <div>
            <p className={styles.eyebrow}>History and reporting</p>
            <h2>{period === "week" ? "Weekly tracker" : "Monthly tracker"}</h2>
            <span>{periodRangeLabel(history)}</span>
          </div>
          <div className={styles.periodControls}>
            <div className={styles.periodToggle} role="group" aria-label="Tracker period">
              <button type="button" aria-pressed={period === "week"} className={period === "week" ? styles.periodActive : ""} onClick={() => setPeriod("week")}>Weekly</button>
              <button type="button" aria-pressed={period === "month"} className={period === "month" ? styles.periodActive : ""} onClick={() => setPeriod("month")}>Monthly</button>
            </div>
            <div className={styles.periodMove}>
              <button type="button" onClick={() => setAnchor((value) => shiftAdminWorkAnchor(period, value, -1))} aria-label={`Previous ${period}`}>←</button>
              <button type="button" onClick={() => setAnchor(getJohannesburgDateKey())}>Current</button>
              <button type="button" onClick={() => setAnchor((value) => shiftAdminWorkAnchor(period, value, 1))} aria-label={`Next ${period}`}>→</button>
            </div>
          </div>
        </div>

        <div className={styles.reportBar}>
          <label>
            <span>View account</span>
            <select value={clientUserId} onChange={(event) => setClientUserId(event.target.value)}>
              <option value="">All accounts</option>
              {clients.map((client) => (
                <option key={client.userId} value={client.userId}>
                  {client.name} · {formatAccountType(client.accountType)}{client.email ? ` · ${client.email}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.reportButton} onClick={openReport} disabled={!clientUserId || isLoading || savingSessionId !== null || hasDirtyReportNotes}>
            Preview / Print report
          </button>
          <small>
            {hasDirtyReportNotes
              ? "Save edited notes before previewing this report."
              : selectedClient
                ? `Report for ${selectedClient.name}`
                : "Choose one account to prepare its owner report."}
          </small>
        </div>

        <section className={styles.summaryGrid} aria-label="Work period summary">
          <article><span>Tracked time</span><strong>{formatAdminWorkDuration(displaySummary.trackedSeconds)}</strong><small>All completed sessions</small></article>
          <article className={styles.reportableSummary}><span>Reportable time</span><strong>{formatAdminWorkDuration(displaySummary.reportableSeconds)}</strong><small>Included by Admin</small></article>
          <article><span>Sessions</span><strong>{displaySummary.includedSessionCount} / {displaySummary.sessionCount}</strong><small>Included / completed</small></article>
          <article><span>Platform areas</span><strong>{displaySummary.pageCount}</strong><small>Friendly page groups</small></article>
        </section>

        <div className={styles.sessionList} aria-live="polite">
          {isLoading ? <p className={styles.emptyState}>Loading work sessions…</p> : null}
          {!isLoading && !history?.sessions.length ? <p className={styles.emptyState}>No completed work sessions were recorded in this period.</p> : null}
          {!isLoading ? history?.sessions.map((session) => (
            <article key={session.id} className={`${styles.sessionCard} ${!session.includeInReport ? styles.sessionExcluded : ""}`}>
              <header className={styles.sessionHeader}>
                <div>
                  <strong>{session.clientName}</strong>
                  <span>{formatAccountType(session.clientAccountType)} · {formatDateTime(session.startedAtIso)} – {formatDateTime(session.stoppedAtIso)}</span>
                </div>
                <b>{formatAdminWorkDuration(session.durationSeconds)}</b>
              </header>

              <div className={styles.pagePills}>
                {session.pages.length ? session.pages.map((page) => (
                  <span key={page.pageKey}>{page.pageLabel} · {formatAdminWorkDuration(page.durationSeconds)}</span>
                )) : <small>No page time captured.</small>}
              </div>

              <label className={styles.noteField}>
                <span>Work note</span>
                <textarea
                  value={session.note}
                  maxLength={ADMIN_WORK_NOTE_MAX_LENGTH}
                  onChange={(event) => updateSessionNote(session.id, event.target.value)}
                  placeholder="Optional short summary"
                />
              </label>

              <div className={styles.sessionControls}>
                <label><input type="checkbox" checked={session.includeInReport} disabled={savingSessionId !== null} onChange={(event) => void patchSession(session.id, { includeInReport: event.target.checked })} /> Include in report</label>
                <label><input type="checkbox" checked={session.showTimesInReport} disabled={savingSessionId !== null} onChange={(event) => void patchSession(session.id, { showTimesInReport: event.target.checked })} /> Show activity times</label>
                <label><input type="checkbox" checked={session.showNoteInReport} disabled={savingSessionId !== null} onChange={(event) => void patchSession(session.id, { showNoteInReport: event.target.checked })} /> Include note</label>
                <button type="button" onClick={() => void patchSession(session.id, { note: session.note }, true)} disabled={savingSessionId !== null || !Object.prototype.hasOwnProperty.call(draftNotes, session.id)}>{savingSessionId === session.id ? "Saving…" : "Save note"}</button>
              </div>
            </article>
          )) : null}
        </div>
      </section>
    </section>
  );
}
