"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminNavigation from "../../../components/AdminNavigation";
import {
  ADMIN_WORK_NOTE_MAX_LENGTH,
  formatAdminWorkDuration,
  getAdminWorkPeriodRange,
  getJohannesburgDateKey,
  shiftAdminWorkAnchor,
  type AdminWorkHistory,
  type AdminWorkPeriod,
  type AdminWorkSessionView,
} from "../../../lib/admin-work-tracker-shared";
import AccountPicker, { type AdminAccountPickerOption } from "./account-picker";
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
  deletedSessionId?: string;
  history?: AdminWorkHistory;
  redirectUrl?: string;
  message?: string;
  error?: string;
};

type Notice = { tone: "success" | "error"; message: string } | null;

const TRACKER_CHANGED_EVENT = "aim4price:admin-work-session-changed";
const TRACKER_REMOTE_CHANGED_EVENT = "aim4price:admin-work-session-remote-changed";
const TRACKER_TICK_EVENT = "aim4price:admin-work-session-tick";
const REPORT_TIME_ZONE = "Africa/Johannesburg";
const ALL_ACCOUNTS_OPTION = {
  label: "All accounts",
  description: "View every completed session",
};

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
  const clientOptions = useMemo<AdminAccountPickerOption[]>(
    () => clients.map((client) => ({
      value: client.userId,
      label: client.name,
      description: `${formatAccountType(client.accountType)}${client.email ? ` · ${client.email}` : ""}`,
      searchText: `${client.name} ${client.email} ${client.accountType} ${formatAccountType(client.accountType)}`,
    })),
    [clients],
  );
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
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [recentClientIds, setRecentClientIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const draftNotesRef = useRef(draftNotes);
  const loadGenerationRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);

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
      const nextHistory = data.history;
      setHistory({
        ...nextHistory,
        sessions: nextHistory.sessions.map((session) => {
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
      setRecentClientIds((current) => {
        const incoming = [
          data.activeSession?.clientUserId,
          ...nextHistory.sessions.map((session) => session.clientUserId),
        ].filter((value): value is string => Boolean(value));
        const validIds = new Set(clients.map((client) => client.userId));
        return [...new Set([...incoming, ...current])]
          .filter((value) => validIds.has(value))
          .slice(0, 5);
      });
    } catch (error) {
      if (generation !== loadGenerationRef.current) return;
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load work history.",
      });
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    }
  }, [anchor, clientUserId, clients, period]);

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
    window.addEventListener(TRACKER_REMOTE_CHANGED_EVENT, handleChanged);
    window.addEventListener(TRACKER_TICK_EVENT, handleTick);
    return () => {
      window.removeEventListener(TRACKER_CHANGED_EVENT, handleChanged);
      window.removeEventListener(TRACKER_REMOTE_CHANGED_EVENT, handleChanged);
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
    if (!startClientUserId) {
      setNotice({ tone: "error", message: "Choose an account before starting work." });
      return;
    }
    if (isStarting || deleteInFlightRef.current) return;

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
      window.location.assign(data.redirectUrl || "/account");
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
    if (saveInFlightRef.current || deleteInFlightRef.current) return null;
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
    const currentSession = activeSession;
    if (!currentSession || isStopping || deleteInFlightRef.current) return;
    const confirmed = window.confirm(
      `Finish work for ${currentSession.clientName} and return to Admin?`,
    );
    if (!confirmed) return;
    setIsStopping(true);
    setNotice(null);

    try {
      const saved = await patchSession(currentSession.id, { note: currentSession.note });
      if (!saved) return;
      const response = await fetch("/api/admin/work-tracker", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", sessionId: currentSession.id }),
      });
      const data = (await response.json()) as TrackerResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to stop work.");
      }
      setActiveSession(null);
      window.dispatchEvent(new Event(TRACKER_CHANGED_EVENT));
      window.location.replace(data.redirectUrl || "/admin");
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to stop work.",
      });
    } finally {
      setIsStopping(false);
    }
  }

  async function deleteSession(session: AdminWorkSessionView) {
    if (deleteInFlightRef.current || saveInFlightRef.current || isStarting || isStopping) return;
    const confirmed = window.confirm(
      `Delete this entire tracked work session for ${session.clientName} on ${formatDate(session.startedAtIso)}? It will be removed from all weekly and monthly reports. This cannot be undone.`,
    );
    if (!confirmed) return;

    deleteInFlightRef.current = true;
    setDeletingSessionId(session.id);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/work-tracker", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = (await response.json()) as TrackerResponse;
      if (!response.ok || !data.ok || data.deletedSessionId !== session.id) {
        throw new Error(data.error || "Failed to delete the tracked work entry.");
      }

      setHistory((current) =>
        current
          ? {
              ...current,
              sessions: current.sessions.filter((item) => item.id !== session.id),
            }
          : current,
      );
      setDraftNotes((current) => {
        if (!Object.prototype.hasOwnProperty.call(current, session.id)) return current;
        const next = { ...current };
        delete next[session.id];
        return next;
      });
      setNotice({ tone: "success", message: data.message || "Tracked work entry deleted." });
      window.dispatchEvent(new Event(TRACKER_CHANGED_EVENT));
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to delete the tracked work entry.",
      });
    } finally {
      deleteInFlightRef.current = false;
      setDeletingSessionId(null);
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
    if (deletingSessionId) {
      setNotice({ tone: "error", message: "Wait for the tracked work entry to finish deleting." });
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
  const isCurrentPeriod = useMemo(() => {
    const currentRange = getAdminWorkPeriodRange(period, getJohannesburgDateKey());
    const visibleRange = getAdminWorkPeriodRange(period, anchor);
    return currentRange.startDate === visibleRange.startDate;
  }, [anchor, period]);

  return (
    <section className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Aim4price admin</p>
          <h1>Work tracker</h1>
          <span>Start and stop work, then prepare a simple owner report.</span>
          <p className={styles.privacyNote}>
            <span aria-hidden="true">🔒</span>
            Admin only. Owners see only reports you choose to print.
          </p>
        </div>
        <AdminNavigation active="work-tracker" />
      </header>

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
            <div className={styles.activeActions}>
              <details className={styles.activeNoteDetails}>
                <summary>
                  {Object.prototype.hasOwnProperty.call(draftNotes, activeSession.id)
                    ? "Work note · unsaved changes"
                    : activeSession.note
                      ? "View or edit work note"
                      : "Add an optional work note"}
                </summary>
                <div className={styles.activeNotePanel}>
                  <label className={styles.noteField}>
                    <span>Optional work note</span>
                    <textarea
                      rows={2}
                      value={activeSession.note}
                      maxLength={ADMIN_WORK_NOTE_MAX_LENGTH}
                      onChange={(event) => updateSessionNote(activeSession.id, event.target.value)}
                      placeholder="Short summary for later"
                    />
                    <small>Private unless you include it in the completed session report.</small>
                  </label>
                  {Object.prototype.hasOwnProperty.call(draftNotes, activeSession.id) ? (
                    <button type="button" className={styles.secondaryButton} onClick={() => void patchSession(activeSession.id, { note: activeSession.note }, true)} disabled={savingSessionId !== null || deletingSessionId !== null || isStopping}>
                      {savingSessionId === activeSession.id ? "Saving…" : "Save note"}
                    </button>
                  ) : null}
                </div>
              </details>
              <button type="button" className={styles.stopButton} onClick={() => void stopWork()} disabled={isStopping || savingSessionId !== null || deletingSessionId !== null}>
                {isStopping ? "Finishing…" : "Done & return to Admin"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.startRow}>
            <AccountPicker
              label="Account"
              value={startClientUserId}
              options={clientOptions}
              recentValues={recentClientIds}
              onChange={setStartClientUserId}
              placeholder="Choose an account"
            />
            <div className={styles.startAction}>
              <button type="button" className={styles.startButton} onClick={() => void startWork()} disabled={isStarting || deletingSessionId !== null || !startClientUserId}>
                {isStarting ? "Starting…" : "Start work & open account"}
              </button>
              <small>Starts the timer and opens the selected account.</small>
            </div>
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
              <button type="button" onClick={() => setAnchor((value) => shiftAdminWorkAnchor(period, value, -1))}>Previous {period}</button>
              <button type="button" onClick={() => setAnchor(getJohannesburgDateKey())} disabled={isCurrentPeriod}>This {period}</button>
              <button type="button" onClick={() => setAnchor((value) => shiftAdminWorkAnchor(period, value, 1))} disabled={isCurrentPeriod}>Next {period}</button>
            </div>
          </div>
        </div>

        <div className={styles.reportBar}>
          <AccountPicker
            label="View account"
            value={clientUserId}
            options={clientOptions}
            recentValues={recentClientIds}
            onChange={setClientUserId}
            placeholder="All accounts"
            emptyOption={ALL_ACCOUNTS_OPTION}
          />
          <button type="button" className={styles.reportButton} onClick={openReport} disabled={!clientUserId || isLoading || savingSessionId !== null || deletingSessionId !== null || hasDirtyReportNotes}>
            Preview & print report
          </button>
          <small>
            {hasDirtyReportNotes
              ? "Save edited notes before previewing this report."
              : selectedClient
                ? `Ready for ${selectedClient.name}.`
                : "Select one account to enable its owner report."}
          </small>
        </div>

        <section className={styles.summaryGrid} aria-label="Work period summary">
          <article><span>Tracked time</span><strong>{formatAdminWorkDuration(displaySummary.trackedSeconds)}</strong><small>All completed sessions</small></article>
          <article className={styles.reportableSummary}><span>Reportable time</span><strong>{formatAdminWorkDuration(displaySummary.reportableSeconds)}</strong><small>Included by Admin</small></article>
          <div className={styles.summaryFacts}>
            <span><strong>{displaySummary.includedSessionCount} / {displaySummary.sessionCount}</strong> sessions included</span>
            <span><strong>{displaySummary.pageCount}</strong> platform areas</span>
          </div>
        </section>

        <div className={styles.sessionList} aria-live="polite">
          {isLoading ? <p className={styles.emptyState}>Loading work sessions…</p> : null}
          {!isLoading && !history?.sessions.length ? <p className={styles.emptyState}>No completed work sessions were recorded in this period.</p> : null}
          {!isLoading ? history?.sessions.map((session) => (
            <article key={session.id} className={`${styles.sessionCard} ${!session.includeInReport ? styles.sessionExcluded : ""}`} aria-busy={deletingSessionId === session.id}>
              <header className={styles.sessionHeader}>
                <div>
                  <strong>{session.clientName}</strong>
                  <span>{formatAccountType(session.clientAccountType)} · {formatDateTime(session.startedAtIso)} – {formatDateTime(session.stoppedAtIso)}</span>
                </div>
                <div className={styles.sessionMeta}>
                  <span className={session.includeInReport ? styles.includedBadge : styles.excludedBadge}>
                    {session.includeInReport ? "Included" : "Not in report"}
                  </span>
                  <b>{formatAdminWorkDuration(session.durationSeconds)}</b>
                </div>
              </header>

              <details className={styles.pageDetails}>
                <summary>
                  <span>{session.pages.length} {session.pages.length === 1 ? "area" : "areas"} visited</span>
                  <small>View page breakdown</small>
                </summary>
                <div className={styles.pagePills}>
                  {session.pages.length ? session.pages.map((page) => (
                    <span key={page.pageKey}>{page.pageLabel} · {formatAdminWorkDuration(page.durationSeconds)}</span>
                  )) : <small>No page time captured.</small>}
                </div>
              </details>

              <label className={styles.noteField}>
                <span>
                  Work note
                  {Object.prototype.hasOwnProperty.call(draftNotes, session.id) ? <em>Unsaved</em> : null}
                </span>
                <textarea
                  rows={2}
                  value={session.note}
                  maxLength={ADMIN_WORK_NOTE_MAX_LENGTH}
                  onChange={(event) => updateSessionNote(session.id, event.target.value)}
                  placeholder="Optional short summary"
                  disabled={deletingSessionId === session.id}
                />
              </label>

              <div className={styles.sessionMainControls}>
                <label><input type="checkbox" checked={session.includeInReport} disabled={savingSessionId !== null || deletingSessionId !== null} onChange={(event) => void patchSession(session.id, { includeInReport: event.target.checked })} /> Include in report</label>
                {Object.prototype.hasOwnProperty.call(draftNotes, session.id) ? (
                  <button type="button" onClick={() => void patchSession(session.id, { note: session.note }, true)} disabled={savingSessionId !== null || deletingSessionId !== null}>{savingSessionId === session.id ? "Saving…" : "Save note"}</button>
                ) : null}
              </div>

              <details className={styles.reportOptions}>
                <summary>
                  <span>Report options</span>
                  <small>{session.showTimesInReport ? "Times shown" : "Times hidden"} · {session.showNoteInReport ? "Note included" : "Note private"}</small>
                </summary>
                <div className={styles.reportOptionControls}>
                  <label><input type="checkbox" checked={session.showTimesInReport} disabled={savingSessionId !== null || deletingSessionId !== null} onChange={(event) => void patchSession(session.id, { showTimesInReport: event.target.checked })} /> Show activity times</label>
                  <label><input type="checkbox" checked={session.showNoteInReport} disabled={savingSessionId !== null || deletingSessionId !== null} onChange={(event) => void patchSession(session.id, { showNoteInReport: event.target.checked })} /> Include note</label>
                </div>
              </details>

              <div className={styles.sessionDanger}>
                <button type="button" className={styles.deleteSessionButton} onClick={() => void deleteSession(session)} disabled={savingSessionId !== null || deletingSessionId !== null}>
                  {deletingSessionId === session.id ? "Deleting…" : "Delete entry"}
                </button>
              </div>
            </article>
          )) : null}
        </div>
      </section>
    </section>
  );
}
