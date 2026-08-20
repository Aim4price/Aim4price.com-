"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type CaptureRequestType = "invoice" | "fuel_slip";
type CaptureChannel =
  | "owner_upload"
  | "accountant_upload"
  | "dealer_upload"
  | "public_drop";
type CaptureStatus =
  | "submitted"
  | "needs_matching"
  | "in_progress"
  | "needs_information"
  | "awaiting_owner"
  | "completed"
  | "declined"
  | "rejected"
  | "cancelled";

type QueueCounts = {
  pending: number;
  dueToday: number;
  overdue: number;
  needsInformation: number;
  awaitingOwner: number;
  completedToday: number;
};

type CaptureRow = {
  id: string;
  publicReference: string;
  requestType: CaptureRequestType;
  submissionChannel: CaptureChannel;
  status: CaptureStatus;
  senderDisplayName: string;
  ownerDisplayName: string;
  assetDisplayName: string;
  fuelStorageDisplayName: string;
  assignedAdminDisplayName: string;
  submittedAtIso: string;
  dueAtIso: string;
  updatedAtIso: string;
  fileCount: number;
};

type CaptureFile = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  pageOrder: number;
  securityStatus: string;
  securityReason: string;
  downloadUrl: string;
};

type CaptureEvent = {
  id: string;
  eventType: string;
  actorDisplayName: string;
  note: string;
  createdAtIso: string;
};

type CaptureDetail = CaptureRow & {
  senderEmail: string;
  senderPhone: string;
  senderBusinessName: string;
  senderNote: string;
  ownerUserId: string;
  assetId: string;
  fuelStorageId: string;
  adminNote: string;
  needsInformationReason: string;
  candidatePayload: Record<string, unknown>;
  capturedPayload: Record<string, unknown>;
};

type CaptureDraft = {
  ownerUserId: string;
  assetId: string;
  fuelStorageId: string;
  ownerDisplayName: string;
  assetDisplayName: string;
  fuelStorageDisplayName: string;
  supplierName: string;
  invoiceNumber: string;
  slipNumber: string;
  documentDate: string;
  subtotalExVat: string;
  vatAmount: string;
  totalIncVat: string;
  totalAmount: string;
  pricePerLitre: string;
  usageMetric: string;
  litres: string;
  fuelType: string;
  usageReading: string;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  notes: string;
  operatorName: string;
  activityText: string;
  workAreaText: string;
  odometerReading: string;
  hourMeterReading: string;
  note: string;
  assetFuelPercentBefore: string;
  assetFuelPercentAfter: string;
  adminNote: string;
};

type CaptureTarget = {
  targetType: "asset" | "fuel_storage";
  ownerUserId: string;
  ownerDisplayName: string;
  targetId: string;
  targetDisplayName: string;
  reference: string;
  meta: string;
};

type QueueResponse = {
  ok: boolean;
  requests?: CaptureRow[];
  counts?: Partial<QueueCounts>;
  error?: string;
};

type DetailResponse = {
  ok: boolean;
  request?: CaptureDetail;
  files?: CaptureFile[];
  events?: CaptureEvent[];
  error?: string;
};

type Notice = { tone: "success" | "error"; message: string } | null;
type BusyAction =
  | "claim"
  | "save_draft"
  | "request_information"
  | "mark_duplicate"
  | "complete"
  | "reject"
  | null;

const EMPTY_COUNTS: QueueCounts = {
  pending: 0,
  dueToday: 0,
  overdue: 0,
  needsInformation: 0,
  awaitingOwner: 0,
  completedToday: 0,
};

const EMPTY_DRAFT: CaptureDraft = {
  ownerUserId: "",
  assetId: "",
  fuelStorageId: "",
  ownerDisplayName: "",
  assetDisplayName: "",
  fuelStorageDisplayName: "",
  supplierName: "",
  invoiceNumber: "",
  slipNumber: "",
  documentDate: "",
  subtotalExVat: "",
  vatAmount: "",
  totalIncVat: "",
  totalAmount: "",
  pricePerLitre: "",
  usageMetric: "none",
  litres: "",
  fuelType: "",
  usageReading: "",
  maintenanceWorkDone: "",
  partsSupplied: "",
  repairWorkDone: "",
  notes: "",
  operatorName: "",
  activityText: "",
  workAreaText: "",
  odometerReading: "",
  hourMeterReading: "",
  note: "",
  assetFuelPercentBefore: "",
  assetFuelPercentAfter: "",
  adminNote: "",
};

const STATUS_LABELS: Record<CaptureStatus, string> = {
  submitted: "New",
  needs_matching: "Needs matching",
  in_progress: "In progress",
  needs_information: "Needs information",
  awaiting_owner: "Awaiting owner",
  completed: "Completed",
  declined: "Declined",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const CHANNEL_LABELS: Record<CaptureChannel, string> = {
  owner_upload: "Owner upload",
  accountant_upload: "Accountant upload",
  dealer_upload: "Dealer upload",
  public_drop: "Public Invoice Drop",
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "Size unavailable";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1_000))} KB`;
}

function dueState(row: CaptureRow): "overdue" | "today" | "future" {
  if (row.status === "awaiting_owner") return "future";
  const dueAt = new Date(row.dueAtIso).getTime();
  if (!Number.isFinite(dueAt)) return "future";
  const now = Date.now();
  if (dueAt < now && !["completed", "declined", "rejected", "cancelled"].includes(row.status)) {
    return "overdue";
  }
  if (dueAt - now <= 24 * 60 * 60 * 1000) return "today";
  return "future";
}

function sortOverdueFirst(rows: CaptureRow[]): CaptureRow[] {
  const priority = (row: CaptureRow) => {
    const state = dueState(row);
    if (state === "overdue") return 0;
    if (state === "today") return 1;
    return 2;
  };

  return [...rows].sort((left, right) => {
    const difference = priority(left) - priority(right);
    if (difference) return difference;
    return new Date(left.dueAtIso).getTime() - new Date(right.dueAtIso).getTime();
  });
}

function normaliseDraft(request: CaptureDetail): CaptureDraft {
  const payload = request.capturedPayload ?? EMPTY_DRAFT;
  const candidate = request.candidatePayload ?? {};
  return {
    ownerUserId: cleanText(payload.ownerUserId) || request.ownerUserId || "",
    assetId: cleanText(payload.assetId) || request.assetId || "",
    fuelStorageId: cleanText(payload.fuelStorageId) || request.fuelStorageId || "",
    ownerDisplayName: cleanText(payload.ownerDisplayName) || request.ownerDisplayName || "",
    assetDisplayName: cleanText(payload.assetDisplayName) || request.assetDisplayName || "",
    fuelStorageDisplayName:
      cleanText(payload.fuelStorageDisplayName) || request.fuelStorageDisplayName || "",
    supplierName: formValue(payload.supplierName, payload.supplier),
    invoiceNumber: formValue(payload.invoiceNumber, payload.documentNumber),
    slipNumber: formValue(payload.slipNumber, payload.invoiceNumber, payload.transactionNumber),
    documentDate: formValue(payload.documentDate, payload.invoiceDate),
    subtotalExVat: formValue(payload.subtotalExVat, payload.subtotal),
    vatAmount: formValue(payload.vatAmount, payload.vat),
    totalIncVat: formValue(payload.totalIncVat, payload.totalAmount, payload.total),
    totalAmount: formValue(payload.totalAmount, payload.totalIncVat, payload.total),
    pricePerLitre: formValue(payload.pricePerLitre),
    usageMetric: formValue(payload.usageMetric, candidate.usageMetric) || "none",
    litres: formValue(payload.litres),
    fuelType: formValue(payload.fuelType),
    usageReading: formValue(payload.usageReading, candidate.usageReading),
    maintenanceWorkDone: formValue(payload.maintenanceWorkDone, payload.maintenance),
    partsSupplied: formValue(payload.partsSupplied, payload.parts),
    repairWorkDone: formValue(payload.repairWorkDone, payload.repair),
    notes: formValue(payload.notes, payload.description, request.senderNote),
    operatorName: formValue(payload.operatorName, candidate.operatorName),
    activityText: formValue(payload.activityText, payload.activity, candidate.activityText),
    workAreaText: formValue(payload.workAreaText, candidate.workAreaText),
    odometerReading: formValue(payload.odometerReading, candidate.odometerReading),
    hourMeterReading: formValue(payload.hourMeterReading, candidate.hourMeterReading),
    note: formValue(payload.note, candidate.note, request.senderNote),
    assetFuelPercentBefore: formValue(payload.assetFuelPercentBefore, candidate.assetFuelPercentBefore),
    assetFuelPercentAfter: formValue(payload.assetFuelPercentAfter, candidate.assetFuelPercentAfter),
    adminNote: cleanText(payload.adminNote) || request.adminNote || "",
  };
}

export default function CaptureQueueClient() {
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const [counts, setCounts] = useState<QueueCounts>(EMPTY_COUNTS);
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<CaptureDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [files, setFiles] = useState<CaptureFile[]>([]);
  const [events, setEvents] = useState<CaptureEvent[]>([]);
  const [activeFileId, setActiveFileId] = useState("");
  const [draft, setDraft] = useState<CaptureDraft>(EMPTY_DRAFT);
  const [loadedDraft, setLoadedDraft] = useState<CaptureDraft>(EMPTY_DRAFT);
  const [actionNote, setActionNote] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [busyFileSecurity, setBusyFileSecurity] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");
  const [matchTargets, setMatchTargets] = useState<CaptureTarget[]>([]);
  const [isSearchingTargets, setIsSearchingTargets] = useState(false);
  const queueLoadGenerationRef = useRef(0);
  const detailLoadGenerationRef = useRef(0);
  const workbenchRef = useRef<HTMLElement>(null);
  const isDraftDirty = useMemo(
    () => Boolean(detail) && JSON.stringify(draft) !== JSON.stringify(loadedDraft),
    [detail, draft, loadedDraft],
  );
  const isDraftDirtyRef = useRef(isDraftDirty);

  isDraftDirtyRef.current = isDraftDirty;

  const loadQueue = useCallback(async () => {
    const generation = ++queueLoadGenerationRef.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("requestType", typeFilter);
      if (channelFilter !== "all") params.set("submissionChannel", channelFilter);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/admin/capture-requests?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as QueueResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to load capture requests.");
      if (generation !== queueLoadGenerationRef.current) return;
      const nextRows = sortOverdueFirst(data.requests ?? []);
      setRows(nextRows);
      setCounts({ ...EMPTY_COUNTS, ...(data.counts ?? {}) });
      setSelectedId((current) =>
        current && (nextRows.some((row) => row.id === current) || isDraftDirtyRef.current)
          ? current
          : "",
      );
    } catch (error) {
      if (generation !== queueLoadGenerationRef.current) return;
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load capture requests.",
      });
    } finally {
      if (generation === queueLoadGenerationRef.current) setIsLoading(false);
    }
  }, [channelFilter, search, statusFilter, typeFilter]);

  const loadDetail = useCallback(async (requestId: string) => {
    const generation = ++detailLoadGenerationRef.current;
    if (!requestId) {
      setDetail(null);
      setIsDetailLoading(false);
      setFiles([]);
      setEvents([]);
      setDraft(EMPTY_DRAFT);
      setLoadedDraft(EMPTY_DRAFT);
      return;
    }
    setIsDetailLoading(true);
    setDetail(null);
    setFiles([]);
    setEvents([]);
    try {
      const response = await fetch(`/api/admin/capture-requests/${encodeURIComponent(requestId)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as DetailResponse;
      if (!response.ok || !data.ok || !data.request) {
        throw new Error(data.error || "Failed to open this capture request.");
      }
      if (generation !== detailLoadGenerationRef.current) return;
      const nextFiles = [...(data.files ?? [])].sort((left, right) => left.pageOrder - right.pageOrder);
      const nextDraft = normaliseDraft(data.request);
      setDetail(data.request);
      setFiles(nextFiles);
      setEvents(data.events ?? []);
      setDraft(nextDraft);
      setLoadedDraft(nextDraft);
      setMatchSearch("");
      setMatchTargets([]);
      setActiveFileId((current) => nextFiles.some((file) => file.id === current) ? current : nextFiles[0]?.id ?? "");
      setActionNote("");
      window.requestAnimationFrame(() => {
        workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      if (generation !== detailLoadGenerationRef.current) return;
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to open this capture request.",
      });
    } finally {
      if (generation === detailLoadGenerationRef.current) setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadQueue(), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadQueue, search]);

  useEffect(() => {
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!isDraftDirty) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!isDraftDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const protectLinkNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }
      const link = event.target.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (window.confirm("Discard the unsaved changes in this capture request?")) {
        isDraftDirtyRef.current = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", protectDraft);
    document.addEventListener("click", protectLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", protectDraft);
      document.removeEventListener("click", protectLinkNavigation, true);
    };
  }, [isDraftDirty]);

  useEffect(() => {
    const query = matchSearch.trim();
    if (!detail || query.length < 2) {
      setMatchTargets([]);
      setIsSearchingTargets(false);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsSearchingTargets(true);
      try {
        const params = new URLSearchParams({ query, requestType: detail.requestType });
        const response = await fetch(`/api/admin/capture-requests/targets?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json() as { ok?: boolean; targets?: CaptureTarget[]; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error || "Target search failed.");
        if (!cancelled) setMatchTargets(data.targets ?? []);
      } catch (error) {
        if (!cancelled) {
          setMatchTargets([]);
          setNotice({
            tone: "error",
            message: error instanceof Error ? error.message : "Target search failed.",
          });
        }
      } finally {
        if (!cancelled) setIsSearchingTargets(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [detail, matchSearch]);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeFileId) ?? files[0] ?? null,
    [activeFileId, files],
  );

  function updateDraft<K extends keyof CaptureDraft>(key: K, value: CaptureDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function confirmDiscardDraft(): boolean {
    return !isDraftDirty || window.confirm(
      "Discard the unsaved changes in this capture request?",
    );
  }

  function openRequest(requestId: string) {
    if (requestId === selectedId || busyAction || !confirmDiscardDraft()) return;
    setSelectedId(requestId);
  }

  function closeRequest() {
    if (busyAction || !confirmDiscardDraft()) return;
    setSelectedId("");
  }

  function selectMatchTarget(target: CaptureTarget) {
    setDraft((current) => ({
      ...current,
      ownerUserId: target.ownerUserId,
      assetId: target.targetType === "asset" ? target.targetId : "",
      fuelStorageId: target.targetType === "fuel_storage" ? target.targetId : "",
      ownerDisplayName: target.ownerDisplayName,
      assetDisplayName: target.targetType === "asset" ? target.targetDisplayName : "",
      fuelStorageDisplayName:
        target.targetType === "fuel_storage" ? target.targetDisplayName : "",
    }));
    setMatchSearch("");
    setMatchTargets([]);
  }

  async function runAction(action: Exclude<BusyAction, null>) {
    if (!selectedId || busyAction) return;
    if (["request_information", "mark_duplicate", "reject"].includes(action) && !actionNote.trim()) {
      setNotice({ tone: "error", message: "Add a short reason before using this action." });
      return;
    }
    if (action === "complete" && !window.confirm("Use these verified details to create the ledger record or send it to the owner for approval?")) {
      return;
    }
    if (action === "reject" && !window.confirm("Reject this document request? The source file will remain in the audit history.")) {
      return;
    }

    setBusyAction(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/capture-requests/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, draft, note: actionNote.trim() }),
      });
      const data = (await response.json()) as DetailResponse & { message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The capture action failed.");
      setNotice({ tone: "success", message: data.message || "Capture request updated." });
      await Promise.all([loadQueue(), loadDetail(selectedId)]);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The capture action failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function runFileSecurity(status: "clean" | "rejected") {
    if (!activeFile || busyFileSecurity) return;
    let reason = "";
    if (status === "clean") {
      const confirmed = window.confirm(
        "Only mark this file clean after its security check has passed. Continue?",
      );
      if (!confirmed) return;
    } else {
      reason = window.prompt("Why did this file fail its security check?")?.trim() || "";
      if (!reason) return;
    }

    setBusyFileSecurity(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/capture-requests/${encodeURIComponent(selectedId)}/files/${encodeURIComponent(activeFile.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reason }),
        },
      );
      const data = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The file security action failed.");
      setNotice({ tone: "success", message: data.message || "File security status updated." });
      await Promise.all([loadQueue(), loadDetail(selectedId)]);
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The file security action failed.",
      });
    } finally {
      setBusyFileSecurity(false);
    }
  }

  const kpis = [
    { key: "pending", label: "Pending", value: counts.pending, filter: "open" },
    { key: "dueToday", label: "Due in 24 hours", value: counts.dueToday, filter: "due_today" },
    { key: "overdue", label: "Overdue", value: counts.overdue, filter: "overdue" },
    { key: "needsInformation", label: "Needs information", value: counts.needsInformation, filter: "needs_information" },
    { key: "awaitingOwner", label: "Awaiting owner", value: counts.awaitingOwner, filter: "awaiting_owner" },
    { key: "completedToday", label: "Completed today", value: counts.completedToday, filter: "completed_today" },
  ] as const;
  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "open" ||
    typeFilter !== "all" ||
    channelFilter !== "all";

  return (
    <>
      <section className={styles.queueUtility}>
        <div>
          <strong>Oldest and overdue documents appear first</strong>
          <span>Nothing reaches a ledger until you complete its final action.</span>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void loadQueue()} disabled={isLoading}>
          {isLoading ? "Refreshing…" : "Refresh queue"}
        </button>
      </section>

      <section className={styles.kpiGrid} aria-label="Capture queue summary">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            type="button"
            className={`${styles.kpiCard} ${statusFilter === kpi.filter ? styles.kpiSelected : ""} ${kpi.key === "overdue" && kpi.value ? styles.kpiOverdue : ""}`}
            onClick={() => setStatusFilter(kpi.filter)}
            aria-pressed={statusFilter === kpi.filter}
          >
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
          </button>
        ))}
      </section>

      {notice ? (
        <div className={notice.tone === "success" ? styles.successNotice : styles.errorNotice} role={notice.tone === "error" ? "alert" : "status"}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button>
        </div>
      ) : null}

      <section className={styles.queueCard}>
        <div className={styles.queueHeading}>
          <div>
            <p className={styles.eyebrow}>Work list</p>
            <h2>Documents to capture</h2>
          </div>
          <span>{rows.length} shown</span>
        </div>

        <div className={styles.filters} aria-label="Capture queue filters">
          <label className={styles.searchField}>
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Reference, sender, customer or asset"
            />
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="open">All open</option>
              <option value="all">All requests</option>
              <option value="submitted">New</option>
              <option value="needs_matching">Needs matching</option>
              <option value="in_progress">In progress</option>
              <option value="needs_information">Needs information</option>
              <option value="awaiting_owner">Awaiting owner</option>
              <option value="overdue">Overdue</option>
              <option value="due_today">Due in 24 hours</option>
              <option value="completed_today">Completed today</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label>
            <span>Document</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Invoices and fuel slips</option>
              <option value="invoice">Invoices</option>
              <option value="fuel_slip">Fuel slips</option>
            </select>
          </label>
          <label>
            <span>Source</span>
            <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
              <option value="all">All sources</option>
              <option value="owner_upload">Owner uploads</option>
              <option value="accountant_upload">Accountant uploads</option>
              <option value="dealer_upload">Dealer uploads</option>
              <option value="public_drop">Public Invoice Drop</option>
            </select>
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => {
                setSearch("");
                setStatusFilter("open");
                setTypeFilter("all");
                setChannelFilter("all");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className={styles.queueTableWrap}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                <th>Request</th>
                <th>Customer / asset</th>
                <th>Sender</th>
                <th>Status</th>
                <th>Due</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !rows.length ? (
                <tr><td colSpan={6} className={styles.emptyCell}>Loading capture requests…</td></tr>
              ) : rows.length ? rows.map((row) => {
                const timing = dueState(row);
                return (
                  <tr key={row.id} className={selectedId === row.id ? styles.selectedRow : ""}>
                    <td>
                      <button
                        type="button"
                        className={styles.requestButton}
                        onClick={() => openRequest(row.id)}
                        disabled={Boolean(busyAction) || (isDetailLoading && selectedId === row.id)}
                      >
                        <strong>{row.publicReference || row.id}</strong>
                        <span>{row.requestType === "fuel_slip" ? "Fuel slip" : "Invoice"} · {row.fileCount} {row.fileCount === 1 ? "file" : "files"}</span>
                      </button>
                    </td>
                    <td><strong>{row.ownerDisplayName || "Unmatched customer"}</strong><span>{row.assetDisplayName || row.fuelStorageDisplayName || "Needs matching"}</span></td>
                    <td><strong>{row.senderDisplayName || "Not provided"}</strong><span>{CHANNEL_LABELS[row.submissionChannel] ?? row.submissionChannel}</span></td>
                    <td><span className={`${styles.statusPill} ${styles[`status_${row.status}`]}`}>{STATUS_LABELS[row.status] ?? row.status}</span></td>
                    <td><strong className={timing === "overdue" ? styles.overdueText : ""}>{row.status === "awaiting_owner" ? "Owner review" : timing === "overdue" ? "Overdue" : formatDateTime(row.dueAtIso)}</strong><span>Received {formatDateTime(row.submittedAtIso)}</span></td>
                    <td><strong>{row.assignedAdminDisplayName || "Unclaimed"}</strong></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className={styles.emptyCell}>{hasActiveFilters ? "No capture requests match these filters." : "All caught up — there are no documents waiting for capture."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId && isDetailLoading ? (
        <section
          ref={workbenchRef}
          className={`${styles.workbench} ${styles.workbenchLoading}`}
          aria-live="polite"
          aria-busy="true"
        >
          Opening capture request…
        </section>
      ) : null}

      {detail ? (
        <section ref={workbenchRef} className={styles.workbench} aria-labelledby="capture-workbench-title">
          <div className={styles.workbenchHeader}>
            <div>
              <p className={styles.eyebrow}>Capture workbench</p>
              <h2 id="capture-workbench-title">{detail.publicReference || detail.id}</h2>
              <span>{CHANNEL_LABELS[detail.submissionChannel]} · {detail.senderDisplayName || "Sender not provided"}</span>
            </div>
            <div className={styles.workbenchHeaderActions}>
              <span className={`${styles.statusPill} ${styles[`status_${detail.status}`]}`}>{STATUS_LABELS[detail.status]}</span>
              <button type="button" className={styles.closeButton} onClick={closeRequest} disabled={Boolean(busyAction)}>Close</button>
            </div>
          </div>

          <div className={styles.workbenchGrid}>
            <section className={styles.documentPanel} aria-label="Source document">
              <div className={styles.panelHeading}>
                <div><strong>Source document</strong><span>Private admin preview</span></div>
                {activeFile?.downloadUrl && activeFile.securityStatus === "clean" ? (
                  <a href={activeFile.downloadUrl} target="_blank" rel="noreferrer">Open original</a>
                ) : null}
              </div>
              {files.length > 1 ? (
                <div className={styles.fileTabs}>
                  {files.map((file, index) => (
                    <button key={file.id} type="button" className={activeFileId === file.id ? styles.fileTabActive : ""} onClick={() => setActiveFileId(file.id)}>
                      Page {index + 1}
                    </button>
                  ))}
                </div>
              ) : null}
              {activeFile?.securityStatus === "pending" ? (
                <div className={styles.securityLock}>
                  <span aria-hidden="true">◈</span>
                  <strong>Security decision required</strong>
                  <p>Inspect this source only in the private preview, then record whether it is safe to use.</p>
                  <div className={styles.securityActions}>
                    <button type="button" disabled={busyFileSecurity} onClick={() => void runFileSecurity("clean")}>
                      {busyFileSecurity ? "Updating…" : "Mark check passed"}
                    </button>
                    <button type="button" disabled={busyFileSecurity} onClick={() => void runFileSecurity("rejected")}>Reject file</button>
                  </div>
                </div>
              ) : null}
              <div className={styles.documentViewer}>
                {!activeFile ? (
                  <div className={styles.viewerEmpty}><strong>No file is attached</strong><span>Keep the request open until the source document is available.</span></div>
                ) : activeFile.securityStatus === "rejected" ? (
                  <div className={styles.securityLock}>
                    <span aria-hidden="true">×</span>
                    <strong>File rejected</strong>
                    <p>{activeFile.securityReason || "This file failed its security check and cannot be opened."}</p>
                  </div>
                ) : activeFile.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeFile.downloadUrl} alt={activeFile.originalFileName || "Uploaded invoice"} />
                ) : activeFile.mimeType === "application/pdf" ? (
                  <iframe sandbox="" referrerPolicy="no-referrer" src={activeFile.downloadUrl} title={activeFile.originalFileName || "Uploaded PDF"} />
                ) : activeFile.securityStatus === "clean" ? (
                  <div className={styles.viewerEmpty}><strong>Preview unavailable</strong><a href={activeFile.downloadUrl}>Download {activeFile.originalFileName}</a></div>
                ) : (
                  <div className={styles.viewerEmpty}><strong>Preview unavailable</strong><span>Record the security decision before opening the original file.</span></div>
                )}
              </div>
              {activeFile ? (
                <div className={styles.fileMeta}>
                  <strong>{activeFile.originalFileName}</strong>
                  <span>{formatFileSize(activeFile.sizeBytes)} · {activeFile.securityStatus || "Security pending"}</span>
                </div>
              ) : null}
              <div className={styles.senderCard}>
                <div><span>Sender</span><strong>{detail.senderBusinessName || detail.senderDisplayName || "Not provided"}</strong></div>
                <div><span>Contact</span><strong>{detail.senderEmail || detail.senderPhone || "Not provided"}</strong></div>
                {detail.senderNote ? <p>{detail.senderNote}</p> : null}
              </div>
            </section>

            <section className={styles.capturePanel} aria-label="Verified capture form">
              <div className={styles.panelHeading}>
                <div><strong>Verified details</strong><span>Save a draft at any point</span></div>
                {!detail.assignedAdminDisplayName ? (
                  <button type="button" className={styles.claimButton} disabled={Boolean(busyAction)} onClick={() => void runAction("claim")}>
                    {busyAction === "claim" ? "Claiming…" : "Claim request"}
                  </button>
                ) : <span className={styles.assignment}>Assigned to {detail.assignedAdminDisplayName}</span>}
              </div>

              <div className={styles.matchCard}>
                <div><p className={styles.eyebrow}>Match</p><strong>Customer and record destination</strong></div>
                {draft.ownerUserId && (draft.assetId || draft.fuelStorageId) ? (
                  <div className={styles.selectedMatch}>
                    <div>
                      <span>Matched destination</span>
                      <strong>{draft.assetDisplayName || draft.fuelStorageDisplayName || "Saved record"}</strong>
                      <small>{draft.ownerDisplayName || "Asset owner"}</small>
                    </div>
                    <button type="button" onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        ownerUserId: "",
                        assetId: "",
                        fuelStorageId: "",
                        ownerDisplayName: "",
                        assetDisplayName: "",
                        fuelStorageDisplayName: "",
                      }));
                      setMatchSearch("");
                    }}>Change match</button>
                  </div>
                ) : null}
                <label className={styles.targetSearch}>
                  <span>{draft.ownerUserId ? "Find a different match" : "Find customer and destination"}</span>
                  <input
                    type="search"
                    value={matchSearch}
                    onChange={(event) => setMatchSearch(event.target.value)}
                    placeholder={detail.requestType === "fuel_slip"
                      ? "Search customer, asset, tank, serial or code"
                      : "Search customer, asset, serial or Invoice Drop code"}
                    autoComplete="off"
                  />
                </label>
                {matchSearch.trim().length >= 2 ? (
                  <div className={styles.targetResults} role="listbox" aria-label="Customer and asset matches">
                    {isSearchingTargets ? <span className={styles.targetEmpty}>Searching…</span> : matchTargets.length ? matchTargets.map((target) => (
                      <button key={`${target.targetType}-${target.targetId}`} type="button" role="option" aria-selected="false" onClick={() => selectMatchTarget(target)}>
                        <strong>{target.targetDisplayName}</strong>
                        <span>{target.ownerDisplayName}</span>
                        <small>{[target.targetType === "fuel_storage" ? "Fuel storage" : "Asset", target.reference, target.meta].filter(Boolean).join(" · ")}</small>
                      </button>
                    )) : <span className={styles.targetEmpty}>No matching customer, asset or tank found.</span>}
                  </div>
                ) : null}
              </div>

              <div className={styles.formGrid}>
                <label><span>Supplier</span><input value={draft.supplierName} onChange={(event) => updateDraft("supplierName", event.target.value)} autoComplete="off" /></label>
                {detail.requestType === "fuel_slip" ? (
                  <label><span>Slip / transaction number</span><input value={draft.slipNumber} onChange={(event) => updateDraft("slipNumber", event.target.value)} autoComplete="off" /></label>
                ) : (
                  <label><span>Invoice number</span><input value={draft.invoiceNumber} onChange={(event) => updateDraft("invoiceNumber", event.target.value)} autoComplete="off" /></label>
                )}
                <label><span>Document date</span><input type="date" value={draft.documentDate} onChange={(event) => updateDraft("documentDate", event.target.value)} /></label>
                {detail.requestType === "fuel_slip" ? (
                  <>
                    <label><span>Litres</span><input inputMode="decimal" value={draft.litres} onChange={(event) => updateDraft("litres", event.target.value)} /></label>
                    <label><span>Fuel type</span><select value={draft.fuelType} onChange={(event) => updateDraft("fuelType", event.target.value)}><option value="">Select fuel type</option><option>Diesel</option><option>Petrol</option><option>Other</option></select></label>
                    <label><span>Price per litre</span><input inputMode="decimal" value={draft.pricePerLitre} onChange={(event) => updateDraft("pricePerLitre", event.target.value)} placeholder="R 0.00" /></label>
                    <label><span>VAT</span><input inputMode="decimal" value={draft.vatAmount} onChange={(event) => updateDraft("vatAmount", event.target.value)} placeholder="R 0.00" /></label>
                    <label><span>Total</span><input inputMode="decimal" value={draft.totalAmount} onChange={(event) => updateDraft("totalAmount", event.target.value)} placeholder="R 0.00" /></label>
                    <label><span>Odometer reading</span><input inputMode="decimal" value={draft.odometerReading} onChange={(event) => updateDraft("odometerReading", event.target.value)} /></label>
                    <label><span>Hour-meter reading</span><input inputMode="decimal" value={draft.hourMeterReading} onChange={(event) => updateDraft("hourMeterReading", event.target.value)} /></label>
                    <label><span>Operator</span><input value={draft.operatorName} onChange={(event) => updateDraft("operatorName", event.target.value)} autoComplete="off" /></label>
                    <label className={styles.fullField}><span>Activity / reason</span><input value={draft.activityText} onChange={(event) => updateDraft("activityText", event.target.value)} /></label>
                    <label className={styles.fullField}><span>Work area</span><input value={draft.workAreaText} onChange={(event) => updateDraft("workAreaText", event.target.value)} /></label>
                    <label><span>Fuel level before (%)</span><input type="number" min="0" max="100" step="1" value={draft.assetFuelPercentBefore} onChange={(event) => updateDraft("assetFuelPercentBefore", event.target.value)} /></label>
                    <label><span>Fuel level after (%)</span><input type="number" min="0" max="100" step="1" value={draft.assetFuelPercentAfter} onChange={(event) => updateDraft("assetFuelPercentAfter", event.target.value)} /></label>
                    <label className={styles.fullField}><span>Fuel slip note</span><textarea value={draft.note} onChange={(event) => updateDraft("note", event.target.value)} rows={3} /></label>
                  </>
                ) : (
                  <>
                    <label><span>Subtotal excl. VAT</span><input inputMode="decimal" value={draft.subtotalExVat} onChange={(event) => updateDraft("subtotalExVat", event.target.value)} placeholder="R 0.00" /></label>
                    <label><span>VAT</span><input inputMode="decimal" value={draft.vatAmount} onChange={(event) => updateDraft("vatAmount", event.target.value)} placeholder="R 0.00" /></label>
                    <label><span>Total incl. VAT</span><input inputMode="decimal" value={draft.totalIncVat} onChange={(event) => updateDraft("totalIncVat", event.target.value)} placeholder="R 0.00" /></label>
                    <label>
                      <span>Usage metric</span>
                      <select value={draft.usageMetric} onChange={(event) => updateDraft("usageMetric", event.target.value)}>
                        <option value="none">Not applicable</option>
                        <option value="hours">Hours</option>
                        <option value="km">Kilometres</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </label>
                    <label><span>Usage reading</span><input inputMode="decimal" value={draft.usageReading} onChange={(event) => updateDraft("usageReading", event.target.value)} disabled={draft.usageMetric === "none"} /></label>
                    <label className={styles.fullField}><span>Maintenance work done</span><textarea value={draft.maintenanceWorkDone} onChange={(event) => updateDraft("maintenanceWorkDone", event.target.value)} rows={3} /></label>
                    <label className={styles.fullField}><span>Parts supplied</span><textarea value={draft.partsSupplied} onChange={(event) => updateDraft("partsSupplied", event.target.value)} rows={3} /></label>
                    <label className={styles.fullField}><span>Repair work done</span><textarea value={draft.repairWorkDone} onChange={(event) => updateDraft("repairWorkDone", event.target.value)} rows={3} /></label>
                    <label className={styles.fullField}><span>Cost Ledger notes</span><textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={3} /></label>
                  </>
                )}
                <label className={styles.fullField}><span>Internal admin note</span><textarea value={draft.adminNote} onChange={(event) => updateDraft("adminNote", event.target.value)} rows={3} placeholder="Only Aim4price admins can see this note." /></label>
              </div>

              <div className={styles.primaryActions}>
                <button type="button" className={styles.secondaryButton} disabled={Boolean(busyAction)} onClick={() => void runAction("save_draft")}>
                  {busyAction === "save_draft" ? "Saving…" : "Save draft"}
                </button>
                <button type="button" className={styles.completeButton} disabled={Boolean(busyAction)} onClick={() => void runAction("complete")}>
                  {busyAction === "complete"
                    ? "Completing…"
                    : detail.submissionChannel === "owner_upload" || detail.submissionChannel === "accountant_upload"
                      ? "Create verified ledger record"
                      : "Verify & send to owner"}
                </button>
              </div>

              <details className={styles.exceptionPanel}>
                <summary>Needs attention or cannot be completed</summary>
                <label><span>Reason or message</span><textarea rows={3} value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder="Required for information requests, duplicates and rejections." /></label>
                <div className={styles.exceptionActions}>
                  <button type="button" disabled={Boolean(busyAction)} onClick={() => void runAction("request_information")}>Request information</button>
                  <button type="button" disabled={Boolean(busyAction)} onClick={() => void runAction("mark_duplicate")}>Mark duplicate</button>
                  <button type="button" className={styles.rejectButton} disabled={Boolean(busyAction)} onClick={() => void runAction("reject")}>Reject</button>
                </div>
              </details>

              <details className={styles.historyPanel}>
                <summary>Audit history <span>{events.length}</span></summary>
                <ol>
                  {events.length ? events.map((event) => (
                    <li key={event.id}><span>{formatDateTime(event.createdAtIso)}</span><strong>{event.eventType.replace(/_/g, " ")}</strong><small>{event.actorDisplayName || "System"}{event.note ? ` · ${event.note}` : ""}</small></li>
                  )) : <li><small>No activity has been recorded yet.</small></li>}
                </ol>
              </details>
            </section>
          </div>
        </section>
      ) : null}
    </>
  );
}
