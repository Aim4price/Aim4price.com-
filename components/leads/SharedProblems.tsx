"use client";
import AssetMessageReader from "../asset-register/AssetMessageReader";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "../WebsitePortal";
import AssetActionIcon from "../asset-register/AssetActionIcon";
import LeadActionDialog from "./LeadActionDialog";
import ui from "./SharedProblems.module.css";
import type { AssetIssueNoteStatus } from "../../lib/asset-issue-notes";
export default function SharedProblems({
  endpoint,
  assetTitle,
  onClose,
  notesOnly = false,
  detailsVisible = true,
  canWrite = true,
}: {
  endpoint: string;
  assetTitle: string;
  onClose?: () => void;
  notesOnly?: boolean;
  detailsVisible?: boolean;
  canWrite?: boolean;
}) {
  const [items, setItems] = useState<AssetIssueNoteStatus[]>([]),
    [step, setStep] = useState<"choices" | "log" | "list">("choices"),
    [problemView, setProblemView] = useState<"open" | "resolved">("open"),
    [note, setNote] = useState(""),
    [resolutionNote, setResolutionNote] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [resolve, setResolve] = useState<AssetIssueNoteStatus | null>(null),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Could not load problems.");
        setItems(data.items || []);
        setError("");
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : "Could not load problems.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint],
  );
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    const refresh = () => void load(c.signal);
    window.addEventListener("aim4price:problems-updated", refresh);
    return () => {
      c.abort();
      window.removeEventListener("aim4price:problems-updated", refresh);
    };
  }, [load]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          resolve
            ? {
                action: "resolve",
                problemId: resolve.id,
                confirmed: true,
                resolutionNote,
                requestId,
              }
            : { action: "log", note, requestId },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Could not save problem.");
      setItems(data.items || []);
      setProblemView(resolve ? "resolved" : "open");
      setResolve(null);
      setNote("");
      setRequestId(crypto.randomUUID());
      setStep("list");
      window.dispatchEvent(new Event("aim4price:problems-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save problem.");
    } finally {
      setBusy(false);
    }
  }
  const openProblems = items.filter((item) => !item.notedAtIso);
  const resolvedProblems = items.filter((item) => item.notedAtIso);
  const visibleProblems = problemView === "open" ? openProblems : resolvedProblems;
  const startResolve = (problem: AssetIssueNoteStatus) => {
    setRequestId(crypto.randomUUID());
    setResolutionNote("");
    setResolve(problem);
  };
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat("en-ZA", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Africa/Johannesburg",
        }).format(date);
  };
  const renderProblems = (problems: AssetIssueNoteStatus[]) => (
    <div className={ui.list}>
      {problems.map((problem) => (
        <article key={problem.id} className={`${ui.problem} ${ui.listProblem} ${problem.notedAtIso ? ui.resolvedProblem : ui.openProblem}`}>
          <header className={ui.problemHeader}>
            <span className={ui.statusIcon}>
              <AssetActionIcon action={problem.notedAtIso ? "maintenanceSchedules" : "loggedProblems"} />
            </span>
            <strong>{problem.notedAtIso ? "Resolved problem" : "Open problem"}</strong>
          </header>
          <p className={ui.note}>{problem.note}</p>
          {!!problem.photoUrls?.length && <div className={ui.photos}>{problem.photoUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={"Problem attachment " + (index + 1)} loading="lazy" /></a>)}</div>}
          {problem.notedAtIso && problem.resolutionNote && (
            <div className={ui.resolution}><strong>Resolution note</strong><p className={ui.note}>{problem.resolutionNote}</p></div>
          )}
          <div className={ui.problemFooter}>
            <div className={ui.meta}>
              <span>
                {[
                  problem.operatorName,
                  problem.createdAtIso
                    ? formatDate(problem.createdAtIso)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Logged problem"}
              </span>
              {problem.notedAtIso && (
                <span>Resolved {formatDate(problem.notedAtIso)}{problem.resolvedByName ? ` · ${problem.resolvedByName}` : ""}</span>
              )}
            </div>
            {canWrite && !problem.notedAtIso && (
              <button
                className={ui.secondary}
                type="button"
                onClick={() => startResolve(problem)}
              >
                Mark resolved
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
  const banners = openProblems.length > 0 && (
    <section className={ui.openProblems} aria-label="Open problems">
      <header className={ui.sectionHeader}>
        <span className={`${ui.icon} ${ui.problemIcon}`}><AssetActionIcon action="loggedProblems" /></span>
        <div><strong>Open problems · {openProblems.length}</strong></div>
      </header>
      {openProblems.map((problem) => (
        <article key={problem.id} className={ui.compactProblem} data-message-banner>
          <AssetMessageReader title="Reported problem" assetTitle={assetTitle} className={ui.problemText}
            actions={canWrite && <button className={ui.secondary} type="button" onClick={() => startResolve(problem)}>Mark resolved</button>}>
            <p className={ui.preview}>{problem.note}</p>
            <small className={ui.meta}>{[problem.operatorName ? `By ${problem.operatorName}` : "", formatDate(problem.createdAtIso), problem.photoUrls?.length ? `${problem.photoUrls.length} photo(s) attached` : ""].filter(Boolean).join(" · ")}</small>
            {!!problem.photoUrls?.length && <div className={ui.photos}>{problem.photoUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={"Problem attachment " + (index + 1)} loading="lazy" /></a>)}</div>}
          </AssetMessageReader>
        </article>
      ))}
    </section>
  );
  const confirmation =
    resolve &&
    createPortal(
      <LeadActionDialog
        className={`${ui.modal} ${ui.resolutionModal}`}
        title="Resolve problem"
        assetTitle={assetTitle}
        onClose={() => setResolve(null)}
        busy={busy}
        footer={
          <>
            <button
              type="button"
              className={ui.secondary}
              disabled={busy}
              onClick={() => setResolve(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={ui.primary}
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Mark resolved"}
            </button>
          </>
        }
      >
        <div className={ui.confirmation}>
          <span className={ui.icon}>
            <AssetActionIcon action="maintenanceSchedules" />
          </span>
          <div>
            <h3>Has this problem been fixed?</h3>
            <p className={ui.copy}>It will stay in the problem history.</p>
          </div>
        </div>
        <div className={ui.problem}>
          <p className={ui.note}>{resolve.note}</p>
        </div>
        <label className={ui.field}>
          <span>Resolution note (optional)</span>
          <textarea rows={3} maxLength={4000} value={resolutionNote} disabled={busy}
            placeholder="What was repaired or checked?"
            onChange={(event) => setResolutionNote(event.target.value)} />
        </label>
        <p className={ui.copy}>Shared with everyone who can view this problem.</p>
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
      </LeadActionDialog>,
      document.body,
    );
  if (notesOnly)
    return (
      <>
        {openProblems.length > 0 && <span hidden data-open-problems="true" />}
        {detailsVisible && (
          <>
            {error && <p role="alert">{error}</p>}
            {banners}
            {confirmation}
          </>
        )}
      </>
    );
  return (
    <>
      {!resolve && (
        <LeadActionDialog
          className={ui.modal}
          title={
            step === "log"
              ? "Log problem"
              : step === "list"
                ? "Logged problems"
                : "Log problems"
          }
          assetTitle={assetTitle}
          onClose={onClose || (() => setStep("choices"))}
          busy={busy}
          footer={
            step !== "choices" ? (
              <>
                <button
                  type="button"
                  className={ui.secondary}
                  disabled={busy}
                  onClick={() => setStep("choices")}
                >
                  Back
                </button>
                {step === "log" && (
                  <button
                    type="button"
                    className={ui.primary}
                    disabled={busy || !note.trim()}
                    onClick={() => void save()}
                  >
                    {busy ? "Saving…" : "Save problem"}
                  </button>
                )}
                {step === "list" && canWrite && (
                  <button
                    type="button"
                    className={ui.primary}
                    onClick={() => setStep("log")}
                  >
                    Log problem
                  </button>
                )}
              </>
            ) : undefined
          }
        >
          {error && (
            <p className={ui.error} role="alert">
              {error}
            </p>
          )}
          {step === "choices" ? (
            <div className={ui.choices}>
              {canWrite && (
                <button
                  type="button"
                  className={ui.choice}
                  onClick={() => setStep("log")}
                >
                  <span className={`${ui.icon} ${ui.warningIcon}`}>
                    <AssetActionIcon action="loggedProblems" />
                  </span>
                  <strong>Log problem</strong>
                  <span className={ui.copy}>
                    Record an issue with this asset.
                  </span>
                </button>
              )}
              <button
                type="button"
                className={ui.choice}
                onClick={() => setStep("list")}
              >
                <span className={ui.icon}>
                  <AssetActionIcon action="history" />
                </span>
                <strong>Logged problems</strong>
                <span className={ui.copy}>View open and resolved issues.</span>
                {!loading && !error && (
                  <span className={ui.count}>
                    {openProblems.length} open ·{" "}
                    {items.length - openProblems.length} resolved
                  </span>
                )}
              </button>
            </div>
          ) : step === "log" ? (
            <div className={ui.form}>
              <label className={ui.field}>
                <span>Describe the problem</span>
                <textarea
                  rows={5}
                  maxLength={4000}
                  value={note}
                  disabled={busy}
                  placeholder="What happened, and where on the asset?"
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <p className={ui.hint}>
                Include the symptoms and any useful details. This problem is visible to the owner and people with access to this asset’s logged problems.
                <span>{note.length.toLocaleString("en-ZA")} / 4 000</span>
              </p>
            </div>
          ) : loading ? (
            <div className={ui.empty} role="status">
              <span className={ui.icon}>
                <AssetActionIcon action="history" />
              </span>
              <p className={ui.copy}>Loading problems…</p>
            </div>
          ) : items.length ? (
            <div className={ui.problemBrowser}>
              <div className={ui.filters} role="group" aria-label="Problem status">
                <button type="button" aria-pressed={problemView === "open"} onClick={() => setProblemView("open")}>
                  Open <span>{openProblems.length}</span>
                </button>
                <button type="button" aria-pressed={problemView === "resolved"} onClick={() => setProblemView("resolved")}>
                  Resolved <span>{resolvedProblems.length}</span>
                </button>
              </div>
              {visibleProblems.length ? renderProblems(visibleProblems) : (
                <div className={ui.empty} role="status">
                  <span className={ui.icon}><AssetActionIcon action="maintenanceSchedules" /></span>
                  <h3>{problemView === "open" ? "No open problems" : "No resolved problems yet"}</h3>
                  <p className={ui.copy}>{problemView === "open" ? "All logged problems have been resolved." : "Problems you resolve will appear here."}</p>
                </div>
              )}
            </div>
          ) : !error ? (
            <div className={ui.empty}>
              <span className={ui.icon}>
                <AssetActionIcon action="maintenanceSchedules" />
              </span>
              <h3>No problems logged</h3>
              <p className={ui.copy}>
                {canWrite
                  ? "Log an issue to keep a record for this asset."
                  : "Reported issues will appear here."}
              </p>
            </div>
          ) : null}
        </LeadActionDialog>
      )}
      {confirmation}
    </>
  );
}

