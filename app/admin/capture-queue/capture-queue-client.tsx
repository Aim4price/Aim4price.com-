"use client";

import DropdownOverlay from '../../../components/DropdownOverlay';
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
  assetReference: string;
  fuelStorageDisplayName: string;
  assignedAdminDisplayName: string;
  submittedAtIso: string;
  dueAtIso: string;
  updatedAtIso: string;
  version: number;
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
  metadata: Record<string, unknown>;
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
  usageNotApplicable: boolean;
  litres: string;
  fuelType: string;
  usageReading: string;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  notes: string;
  operatorName: string;
  operatorNotApplicable: boolean;
  activityText: string;
  activityNotApplicable: boolean;
  workAreaText: string;
  workAreaNotApplicable: boolean;
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
  assetUsageMetric: "hours" | "km" | "percentage" | "not_applicable" | null;
  assetUsageReading: number | null;
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
  matchedTarget?: CaptureTarget | null;
  files?: CaptureFile[];
  events?: CaptureEvent[];
  error?: string;
  errorCode?: string;
  message?: string;
};

type Notice = { tone: "success" | "error"; message: string } | null;
type BusyAction =
  | "claim"
  | "confirm_match"
  | "update_usage"
  | "save_draft"
  | "request_information"
  | "mark_duplicate"
  | "complete"
  | "complete_direct"
  | "reject"
  | "delete"
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
  usageNotApplicable: false,
  litres: "",
  fuelType: "",
  usageReading: "",
  maintenanceWorkDone: "",
  partsSupplied: "",
  repairWorkDone: "",
  notes: "",
  operatorName: "",
  operatorNotApplicable: false,
  activityText: "",
  activityNotApplicable: false,
  workAreaText: "",
  workAreaNotApplicable: false,
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
  cancelled: "Deleted",
};

const CHANNEL_LABELS: Record<CaptureChannel, string> = {
  owner_upload: "Owner upload",
  accountant_upload: "Accountant upload",
  dealer_upload: "Dealer upload",
  public_drop: "Public drop",
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

function booleanValue(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

function usageNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  let normalized = value.trim().replace(/\s+/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function usageUnit(metric: CaptureTarget["assetUsageMetric"]): string {
  if (metric === "hours") return "hours";
  if (metric === "km") return "km";
  return "";
}

function formatUsage(value: number | null, metric: CaptureTarget["assetUsageMetric"]): string {
  if (value === null) return "Not recorded";
  const formatted = new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}${metric === "hours" ? " h" : metric === "km" ? " km" : ""}`;
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
  const usageNotApplicable = booleanValue(
    payload.usageNotApplicable,
    candidate.usageNotApplicable,
  );
  const operatorNotApplicable = booleanValue(
    payload.operatorNotApplicable,
    candidate.operatorNotApplicable,
  );
  const activityNotApplicable = booleanValue(
    payload.activityNotApplicable,
    candidate.activityNotApplicable,
  );
  const workAreaNotApplicable = booleanValue(
    payload.workAreaNotApplicable,
    candidate.workAreaNotApplicable,
  );
  return {
    ownerUserId: request.ownerUserId || cleanText(payload.ownerUserId) || "",
    assetId: request.assetId || cleanText(payload.assetId) || "",
    fuelStorageId: request.fuelStorageId || cleanText(payload.fuelStorageId) || "",
    ownerDisplayName: request.ownerDisplayName || cleanText(payload.ownerDisplayName) || "",
    assetDisplayName: request.assetDisplayName || cleanText(payload.assetDisplayName) || "",
    fuelStorageDisplayName:
      request.fuelStorageDisplayName || cleanText(payload.fuelStorageDisplayName) || "",
    supplierName: formValue(payload.supplierName, payload.supplier),
    invoiceNumber: formValue(payload.invoiceNumber, payload.documentNumber),
    slipNumber: formValue(payload.slipNumber, payload.invoiceNumber, payload.transactionNumber),
    documentDate: formValue(payload.documentDate, payload.invoiceDate),
    subtotalExVat: formValue(payload.subtotalExVat, payload.subtotal),
    vatAmount: formValue(payload.vatAmount, payload.vat),
    totalIncVat: formValue(payload.totalIncVat, payload.totalAmount, payload.total),
    totalAmount: formValue(payload.totalAmount, payload.totalIncVat, payload.total),
    pricePerLitre: formValue(payload.pricePerLitre),
    usageMetric: usageNotApplicable
      ? "none"
      : formValue(payload.usageMetric, candidate.usageMetric) || "none",
    usageNotApplicable,
    litres: formValue(payload.litres),
    fuelType: formValue(payload.fuelType),
    usageReading: usageNotApplicable
      ? ""
      : formValue(payload.usageReading, candidate.usageReading),
    maintenanceWorkDone: formValue(payload.maintenanceWorkDone, payload.maintenance),
    partsSupplied: formValue(payload.partsSupplied, payload.parts),
    repairWorkDone: formValue(payload.repairWorkDone, payload.repair),
    notes: formValue(payload.notes, payload.description, request.senderNote),
    operatorName: operatorNotApplicable
      ? ""
      : formValue(payload.operatorName, candidate.operatorName),
    operatorNotApplicable,
    activityText: activityNotApplicable
      ? ""
      : formValue(payload.activityText, payload.activity, candidate.activityText),
    activityNotApplicable,
    workAreaText: workAreaNotApplicable
      ? ""
      : formValue(payload.workAreaText, candidate.workAreaText),
    workAreaNotApplicable,
    odometerReading: usageNotApplicable
      ? ""
      : formValue(payload.odometerReading, candidate.odometerReading),
    hourMeterReading: usageNotApplicable
      ? ""
      : formValue(payload.hourMeterReading, candidate.hourMeterReading),
    note: formValue(payload.note, candidate.note, request.senderNote),
    assetFuelPercentBefore: formValue(payload.assetFuelPercentBefore, candidate.assetFuelPercentBefore),
    assetFuelPercentAfter: formValue(payload.assetFuelPercentAfter, candidate.assetFuelPercentAfter),
    adminNote: cleanText(payload.adminNote) || request.adminNote || "",
  };
}

function targetKey(input: {
  ownerUserId?: unknown;
  assetId?: unknown;
  fuelStorageId?: unknown;
}): string {
  const ownerUserId = cleanText(input.ownerUserId);
  const assetId = cleanText(input.assetId);
  const fuelStorageId = cleanText(input.fuelStorageId);
  if (!ownerUserId || Boolean(assetId) === Boolean(fuelStorageId)) return "";
  return [ownerUserId, assetId, fuelStorageId].join(":");
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
  const [selectedTarget, setSelectedTarget] = useState<CaptureTarget | null>(null);
  const [isChangingMatch, setIsChangingMatch] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [reconfirmationRequestId, setReconfirmationRequestId] = useState("");
  const queueLoadGenerationRef = useRef(0);
  const detailLoadGenerationRef = useRef(0);
  const workbenchRef = useRef<HTMLElement>(null);
  const isDraftDirty = useMemo(
    () => Boolean(detail) && JSON.stringify(draft) !== JSON.stringify(loadedDraft),
    [detail, draft, loadedDraft],
  );
  const currentTargetKey = targetKey(draft);
  const selectedTargetKey = selectedTarget
    ? targetKey({
        ownerUserId: selectedTarget.ownerUserId,
        assetId: selectedTarget.targetType === "asset" ? selectedTarget.targetId : "",
        fuelStorageId: selectedTarget.targetType === "fuel_storage" ? selectedTarget.targetId : "",
      })
    : "";
  const hasMatchedTarget = Boolean(
    selectedTarget && currentTargetKey && selectedTargetKey === currentTargetKey,
  );
  const requiresTargetReconfirmation = reconfirmationRequestId === selectedId;
  const isMatchConfirmed = useMemo(() => {
    if (!currentTargetKey || requiresTargetReconfirmation) return false;
    const latestMatch = [...events]
      .reverse()
      .find((event) => event.eventType === "matched");
    return Boolean(latestMatch && targetKey(latestMatch.metadata) === currentTargetKey);
  }, [currentTargetKey, events, requiresTargetReconfirmation]);
  const isExternalSubmission = detail?.submissionChannel === "dealer_upload"
    || detail?.submissionChannel === "public_drop";
  const isTerminalRequest = Boolean(
    detail && ["completed", "declined", "rejected", "cancelled"].includes(detail.status),
  );
  const isRequestEditable = Boolean(detail && detail.status !== "awaiting_owner" && !isTerminalRequest);
  const persistedTargetKey = detail ? targetKey(detail) : "";
  const hasUnconfirmedTargetChange = Boolean(
    detail && currentTargetKey !== persistedTargetKey && !isMatchConfirmed,
  );
  const usageUpdate = useMemo(() => {
    const metric = selectedTarget?.targetType === "asset"
      ? selectedTarget.assetUsageMetric
      : null;
    const supported = metric === "hours" || metric === "km";
    const unit = usageUnit(metric);
    const currentReading = selectedTarget?.targetType === "asset"
      ? usageNumber(selectedTarget.assetUsageReading)
      : null;
    const invoiceMetricMatches = detail?.requestType !== "invoice" || draft.usageMetric === metric;
    const rawDocumentReading = metric === "hours"
      ? detail?.requestType === "fuel_slip" ? draft.hourMeterReading : draft.usageReading
      : metric === "km"
        ? detail?.requestType === "fuel_slip" ? draft.odometerReading : draft.usageReading
        : "";
    const documentReading = !draft.usageNotApplicable && invoiceMetricMatches && supported
      ? usageNumber(rawDocumentReading)
      : null;
    const isLower = documentReading !== null
      && currentReading !== null
      && documentReading < currentReading;
    const isEqual = documentReading !== null
      && currentReading !== null
      && Math.abs(documentReading - currentReading) < 0.0001;

    let message = "This asset does not track hours or kilometres.";
    let tone: "warning" | "ready" | "current" = "warning";
    let canUpdate = false;
    if (supported && !isMatchConfirmed) {
      message = "Confirm this exact asset before updating its usage.";
    } else if (supported && !isRequestEditable) {
      message = "This request can no longer change the asset's usage.";
    } else if (supported && draft.usageNotApplicable) {
      message = "Usage is marked N/A, so this asset will not be updated.";
    } else if (supported && !invoiceMetricMatches) {
      message = `This asset tracks ${unit}. Set the invoice usage metric to ${metric === "hours" ? "Hours" : "Kilometres"}, or choose N/A.`;
    } else if (supported && documentReading === null) {
      message = `Enter the document's ${unit} reading, or choose N/A.`;
    } else if (supported && isLower) {
      message = "The document reading is below the current asset reading. Usage can never be lowered.";
    } else if (supported && isEqual) {
      message = "The asset is already up to date. No usage change is needed.";
      tone = "current";
    } else if (supported) {
      message = "Ready to update. Recorded usage changes only when you click the button.";
      tone = "ready";
      canUpdate = true;
    }

    return {
      metric,
      supported,
      unit,
      currentReading,
      documentReading,
      documentLabel: draft.usageNotApplicable
        ? "N/A"
        : documentReading === null ? "Not entered" : formatUsage(documentReading, metric),
      message,
      tone,
      canUpdate,
    };
  }, [
    detail?.requestType,
    draft.hourMeterReading,
    draft.odometerReading,
    draft.usageMetric,
    draft.usageNotApplicable,
    isMatchConfirmed,
    isRequestEditable,
    selectedTarget,
  ]);
  const isDraftDirtyRef = useRef(isDraftDirty);

  isDraftDirtyRef.current = isDraftDirty;

  const applyDetailResponse = useCallback((
    data: DetailResponse,
    options: { scrollIntoView?: boolean } = {},
  ): boolean => {
    if (!data.request) return false;
    const nextFiles = [...(data.files ?? [])]
      .sort((left, right) => left.pageOrder - right.pageOrder);
    const nextDraft = normaliseDraft(data.request);
    isDraftDirtyRef.current = false;
    setDetail(data.request);
    setFiles(nextFiles);
    setEvents(data.events ?? []);
    setDraft(nextDraft);
    setLoadedDraft(nextDraft);
    setSelectedTarget(data.matchedTarget ?? null);
    setIsChangingMatch(!data.matchedTarget);
    setMatchSearch("");
    setMatchTargets([]);
    setActiveFileId((current) => (
      nextFiles.some((file) => file.id === current) ? current : nextFiles[0]?.id ?? ""
    ));
    setActionNote("");
    setDeleteReason("");
    if (options.scrollIntoView) {
      window.requestAnimationFrame(() => {
        workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    return true;
  }, []);

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
      setSelectedTarget(null);
      setIsChangingMatch(false);
      setDeleteReason("");
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
      applyDetailResponse(data, { scrollIntoView: true });
    } catch (error) {
      if (generation !== detailLoadGenerationRef.current) return;
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to open this capture request.",
      });
    } finally {
      if (generation === detailLoadGenerationRef.current) setIsDetailLoading(false);
    }
  }, [applyDetailResponse]);

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

  function updateNotApplicable(
    key:
      | "usageNotApplicable"
      | "operatorNotApplicable"
      | "activityNotApplicable"
      | "workAreaNotApplicable",
    checked: boolean,
  ) {
    setDraft((current) => {
      if (key === "usageNotApplicable") {
        return {
          ...current,
          usageNotApplicable: checked,
          ...(checked ? {
            usageMetric: "none",
            usageReading: "",
            odometerReading: "",
            hourMeterReading: "",
          } : {}),
        };
      }
      if (key === "operatorNotApplicable") {
        return {
          ...current,
          operatorNotApplicable: checked,
          ...(checked ? { operatorName: "" } : {}),
        };
      }
      if (key === "activityNotApplicable") {
        return {
          ...current,
          activityNotApplicable: checked,
          ...(checked ? { activityText: "" } : {}),
        };
      }
      return {
        ...current,
        workAreaNotApplicable: checked,
        ...(checked ? { workAreaText: "" } : {}),
      };
    });
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
    setSelectedTarget(target);
    setIsChangingMatch(false);
    setMatchSearch("");
    setMatchTargets([]);
  }

  function beginMatchChange() {
    setIsChangingMatch(true);
    setMatchSearch("");
    setMatchTargets([]);
  }

  function cancelMatchChange() {
    if (!hasMatchedTarget) return;
    setIsChangingMatch(false);
    setMatchSearch("");
    setMatchTargets([]);
  }

  async function runAction(action: Exclude<BusyAction, null>) {
    if (!selectedId || busyAction) return;
    let requestNote = actionNote.trim();
    if (["request_information", "mark_duplicate", "reject"].includes(action) && !actionNote.trim()) {
      setNotice({ tone: "error", message: "Add a short reason before using this action." });
      return;
    }
    if (action === "confirm_match" && !currentTargetKey) {
      setNotice({ tone: "error", message: "Choose the customer and exact destination first." });
      return;
    }
    if (["complete", "complete_direct"].includes(action) && !isMatchConfirmed) {
      setNotice({ tone: "error", message: "Confirm the exact customer and destination before completing this request." });
      return;
    }
    if (action === "update_usage") {
      if (!usageUpdate.canUpdate || !usageUpdate.supported) {
        setNotice({ tone: "error", message: usageUpdate.message });
        return;
      }
      const fromReading = usageUpdate.currentReading === null
        ? "no recorded usage"
        : formatUsage(usageUpdate.currentReading, usageUpdate.metric);
      const toReading = formatUsage(usageUpdate.documentReading, usageUpdate.metric);
      if (!window.confirm(
        `Update this asset from ${fromReading} to ${toReading}? This is a separate action from ledger completion, and recorded usage will never be lowered.`,
      )) return;
    }
    if (action === "complete" && !window.confirm("Use these verified details to create the ledger record or send it to the owner for approval?")) {
      return;
    }
    if (action === "complete_direct") {
      requestNote = window.prompt(
        "How was the owner's approval confirmed? This reason will be saved in the audit history.",
      )?.trim() || "";
      if (!requestNote) return;
      if (!window.confirm(
        "Save this verified document directly to the owner's ledger without asking them to approve it again?",
      )) return;
    }
    if (action === "reject" && !window.confirm(
      "Reject this document request? Its audit metadata will remain and its source file will be scheduled for secure removal.",
    )) {
      return;
    }
    if (action === "delete") {
      requestNote = deleteReason.trim();
      if (!requestNote) {
        setNotice({ tone: "error", message: "Add a reason before deleting this request from the queue." });
        return;
      }
      const typedReference = window.prompt(
        `Type ${detail?.publicReference ?? ""} to delete this request from the active queue.`,
      )?.trim();
      if (typedReference !== detail?.publicReference) {
        if (typedReference !== undefined && typedReference !== null) {
          setNotice({ tone: "error", message: "The capture reference did not match. Nothing was deleted." });
        }
        return;
      }
    }

    const submittedVersion = detail?.version;
    setBusyAction(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/capture-requests/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          draft,
          note: requestNote,
          requestVersion: detail?.version,
        }),
      });
      const data = (await response.json()) as DetailResponse;
      if (!response.ok || !data.ok) {
        if (data.request && data.request.version !== submittedVersion) {
          applyDetailResponse(data);
        }
        if (data.errorCode === "CAPTURE_REQUEST_CHANGED") {
          setReconfirmationRequestId(selectedId);
        }
        throw new Error(data.error || "The capture action failed.");
      }
      if (action === "delete") {
        isDraftDirtyRef.current = false;
        setSelectedId("");
        setDetail(null);
        setNotice({ tone: "success", message: data.message || "Capture request updated." });
        await loadQueue();
        return;
      }
      if (!applyDetailResponse(data)) {
        await loadDetail(selectedId);
      }
      if (action === "confirm_match") {
        setReconfirmationRequestId((current) => current === selectedId ? "" : current);
      }
      setNotice({ tone: "success", message: data.message || "Capture request updated." });
      await loadQueue();
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
          <h2>Documents · {rows.length}</h2>
        </div>

        <div className={styles.filters} aria-label="Capture queue filters">
          <label className={styles.searchField}>
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Reference or asset"
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
              <option value="cancelled">Deleted</option>
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
              <option value="public_drop">Public drops</option>
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
          {isLoading || rows.length || hasActiveFilters ? <table className={styles.queueTable}>
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
                        <span>· {row.requestType === "fuel_slip" ? "Fuel slip" : "Invoice"} · {row.fileCount} {row.fileCount === 1 ? "file" : "files"}</span>
                      </button>
                    </td>
                    <td><strong>{row.ownerDisplayName || "Unmatched customer"}</strong><span>· {row.assetDisplayName || row.fuelStorageDisplayName || "Needs matching"}</span></td>
                    <td><strong>{row.senderDisplayName || "Not provided"}</strong><span>· {CHANNEL_LABELS[row.submissionChannel] ?? row.submissionChannel}</span></td>
                    <td><span className={`${styles.statusText} ${styles[`status_${row.status}`]}`}>{STATUS_LABELS[row.status] ?? row.status}</span></td>
                    <td><strong className={timing === "overdue" ? styles.overdueText : ""}>{row.status === "awaiting_owner" ? "Owner review" : timing === "overdue" ? "Overdue" : formatDateTime(row.dueAtIso)}</strong><span>· Received {formatDateTime(row.submittedAtIso)}</span></td>
                    <td><strong>{row.assignedAdminDisplayName || "Unclaimed"}</strong></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className={styles.emptyCell}>{hasActiveFilters ? "No matches." : "No documents waiting."}</td></tr>
              )}
            </tbody>
          </table> : <div className={styles.emptyCell}>No documents to capture.</div>}
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
            <div className={styles.workbenchTitle}>
              <h2 id="capture-workbench-title">{detail.publicReference || detail.id}</h2>
            </div>
            <div className={styles.workbenchHeaderActions}>
              <span className={`${styles.statusText} ${styles[`status_${detail.status}`]}`}>{STATUS_LABELS[detail.status]}</span>
              <button type="button" className={styles.closeButton} onClick={closeRequest} disabled={Boolean(busyAction)}>Close</button>
            </div>
          </div>

          <div className={styles.workbenchGrid}>
            <section className={styles.documentPanel} aria-label="Source document">
              <div className={styles.panelHeading}>
                <strong>Document</strong>
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
                  <strong>Security decision required</strong>
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
                  <div className={styles.viewerEmpty}><strong>No file attached</strong></div>
                ) : activeFile.securityStatus === "rejected" ? (
                  <div className={styles.securityLock}>
                    <strong>File rejected</strong>
                    <p>{activeFile.securityReason || "This file failed its security check and cannot be opened."}</p>
                  </div>
                ) : activeFile.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeFile.downloadUrl} alt={activeFile.originalFileName || "Uploaded invoice"} />
                ) : activeFile.mimeType === "application/pdf" ? (
                  <iframe referrerPolicy="no-referrer" src={activeFile.downloadUrl} title={activeFile.originalFileName || "Uploaded PDF"} />
                ) : activeFile.securityStatus === "clean" ? (
                  <div className={styles.viewerEmpty}><strong>Preview unavailable</strong><a href={activeFile.downloadUrl}>Download {activeFile.originalFileName}</a></div>
                ) : (
                  <div className={styles.viewerEmpty}><strong>Security check required</strong></div>
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
                <strong>Details</strong>
                {!detail.assignedAdminDisplayName ? (
                  <button type="button" className={styles.claimButton} disabled={Boolean(busyAction)} onClick={() => void runAction("claim")}>
                    {busyAction === "claim" ? "Claiming…" : "Claim request"}
                  </button>
                ) : <span className={styles.assignment}>Assigned to {detail.assignedAdminDisplayName}</span>}
              </div>

              <div className={styles.matchCard}>
                <strong className={styles.matchHeading}>Destination</strong>
                {cleanText(detail.candidatePayload.submittedSerialOrVin) ? (
                  <div className={styles.submittedAssetReference}>
                    <div>
                      <span>Submitted serial or VIN</span>
                      <strong>{cleanText(detail.candidatePayload.submittedSerialOrVin)}</strong>
                      <small>{cleanText(detail.candidatePayload.submittedAssetDescription) || "No make or model supplied"}</small>
                    </div>
                    <em>{cleanText(detail.candidatePayload.matchMethod) === "exact_unique_serial_or_vin" ? "Matched" : "Review match"}</em>
                  </div>
                ) : null}
                {hasMatchedTarget && selectedTarget ? (
                  <div className={`${styles.selectedMatch} ${isMatchConfirmed ? styles.selectedMatchConfirmed : ""}`}>
                    <div className={styles.selectedMatchCopy}>
                      <span>{isMatchConfirmed ? "Confirmed" : "Confirm destination"}</span>
                      <strong>{selectedTarget.targetDisplayName}</strong>
                      <small>{selectedTarget.ownerDisplayName}</small>
                      <em>
                        {[
                          selectedTarget.targetType === "fuel_storage" ? "Fuel storage" : "Asset",
                          selectedTarget.reference,
                          selectedTarget.meta,
                        ].filter(Boolean).join(" · ")}
                      </em>
                    </div>
                    <div className={styles.selectedMatchActions}>
                      {isMatchConfirmed ? (
                        <span className={styles.matchConfirmedText}>✓ Confirmed</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.confirmMatchButton}
                          disabled={Boolean(busyAction) || !isRequestEditable}
                          onClick={() => void runAction("confirm_match")}
                        >
                          {busyAction === "confirm_match"
                            ? "Confirming…"
                            : selectedTarget.targetType === "fuel_storage"
                              ? "Confirm this fuel destination"
                              : "Confirm this exact asset"}
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.changeMatchButton}
                        disabled={Boolean(busyAction) || !isRequestEditable}
                        onClick={isChangingMatch ? cancelMatchChange : beginMatchChange}
                      >
                        {isChangingMatch ? "Cancel change" : "Change"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.matchRequired}>
                    <strong>Select the exact asset or fuel destination.</strong>
                  </div>
                )}
                {isRequestEditable && (!hasMatchedTarget || isChangingMatch) ? (
                  <div className={styles.matchSearchPanel}>
                    <label className={styles.targetSearch}>
                      <span>{hasMatchedTarget ? "Find a replacement destination" : "Find customer and destination"}</span>
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
                      <DropdownOverlay className={styles.targetResults} role="listbox" aria-label="Customer and asset matches">
                        {isSearchingTargets ? <span className={styles.targetEmpty}>Searching…</span> : matchTargets.length ? matchTargets.map((target) => (
                          <button key={`${target.targetType}-${target.targetId}`} type="button" role="option" aria-selected="false" onClick={() => selectMatchTarget(target)}>
                            <strong>{target.targetDisplayName}</strong>
                            <span>· {[target.ownerDisplayName, target.targetType === "fuel_storage" ? "Fuel storage" : "Asset", target.reference, target.meta].filter(Boolean).join(" · ")}</span>
                          </button>
                        )) : <span className={styles.targetEmpty}>No matching customer, asset or tank found.</span>}
                      </DropdownOverlay>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {hasMatchedTarget && selectedTarget?.targetType === "asset" ? (
                <div className={styles.usageUpdateCard} aria-label="Asset usage update">
                  <div className={styles.usageUpdateHeading}>
                    <strong>
                      {usageUpdate.metric === "hours"
                        ? "Update asset hours"
                        : usageUpdate.metric === "km"
                          ? "Update asset kilometres"
                          : "Update asset usage"}
                    </strong>
                  </div>
                  <div className={styles.usageComparison}>
                    <div>
                      <span>Current asset reading</span>
                      <strong>{formatUsage(usageUpdate.currentReading, usageUpdate.metric)}</strong>
                    </div>
                    <div>
                      <span>Reading on this {detail.requestType === "fuel_slip" ? "fuel slip" : "invoice"}</span>
                      <strong>{usageUpdate.documentLabel}</strong>
                    </div>
                  </div>
                  <p className={`${styles.usageStatus} ${styles[`usageStatus_${usageUpdate.tone}`]}`}>
                    {usageUpdate.message}
                  </p>
                  <div className={styles.usageUpdateFooter}>
                    <small>Usage only changes here.</small>
                    {usageUpdate.supported ? (
                      <button
                        type="button"
                        className={styles.updateUsageButton}
                        disabled={Boolean(busyAction) || !usageUpdate.canUpdate}
                        onClick={() => void runAction("update_usage")}
                      >
                        {busyAction === "update_usage"
                          ? `Updating ${usageUpdate.unit}…`
                          : usageUpdate.metric === "hours" ? "Update hours" : "Update kilometres"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <fieldset className={styles.formGrid} disabled={!isRequestEditable}>
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
                    <label><span>Odometer reading</span><input inputMode="decimal" value={draft.odometerReading} onChange={(event) => updateDraft("odometerReading", event.target.value)} disabled={draft.usageNotApplicable} /></label>
                    <label><span>Hour-meter reading</span><input inputMode="decimal" value={draft.hourMeterReading} onChange={(event) => updateDraft("hourMeterReading", event.target.value)} disabled={draft.usageNotApplicable} /></label>
                    <label className={`${styles.naControl} ${styles.fullField}`}>
                      <input
                        type="checkbox"
                        checked={draft.usageNotApplicable}
                        onChange={(event) => updateNotApplicable("usageNotApplicable", event.target.checked)}
                      />
                      <span>Usage reading N/A</span>
                    </label>
                    <div className={styles.fieldWithNa}>
                      <label><span>Operator</span><input value={draft.operatorName} onChange={(event) => updateDraft("operatorName", event.target.value)} autoComplete="off" disabled={draft.operatorNotApplicable} /></label>
                      <label className={styles.naControl}>
                        <input
                          type="checkbox"
                          checked={draft.operatorNotApplicable}
                          onChange={(event) => updateNotApplicable("operatorNotApplicable", event.target.checked)}
                        />
                        <span>Operator N/A</span>
                      </label>
                    </div>
                    <div className={`${styles.fieldWithNa} ${styles.fullField}`}>
                      <label><span>Activity / reason</span><input value={draft.activityText} onChange={(event) => updateDraft("activityText", event.target.value)} disabled={draft.activityNotApplicable} /></label>
                      <label className={styles.naControl}>
                        <input
                          type="checkbox"
                          checked={draft.activityNotApplicable}
                          onChange={(event) => updateNotApplicable("activityNotApplicable", event.target.checked)}
                        />
                        <span>Activity N/A</span>
                      </label>
                    </div>
                    <div className={`${styles.fieldWithNa} ${styles.fullField}`}>
                      <label><span>Work area</span><input value={draft.workAreaText} onChange={(event) => updateDraft("workAreaText", event.target.value)} disabled={draft.workAreaNotApplicable} /></label>
                      <label className={styles.naControl}>
                        <input
                          type="checkbox"
                          checked={draft.workAreaNotApplicable}
                          onChange={(event) => updateNotApplicable("workAreaNotApplicable", event.target.checked)}
                        />
                        <span>Work area N/A</span>
                      </label>
                    </div>
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
                      <select value={draft.usageMetric} onChange={(event) => updateDraft("usageMetric", event.target.value)} disabled={draft.usageNotApplicable}>
                        <option value="none">No usage metric</option>
                        <option value="hours">Hours</option>
                        <option value="km">Kilometres</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </label>
                    <label><span>Usage reading</span><input inputMode="decimal" value={draft.usageReading} onChange={(event) => updateDraft("usageReading", event.target.value)} disabled={draft.usageNotApplicable || draft.usageMetric === "none"} /></label>
                    <label className={`${styles.naControl} ${styles.fullField}`}>
                      <input
                        type="checkbox"
                        checked={draft.usageNotApplicable}
                        onChange={(event) => updateNotApplicable("usageNotApplicable", event.target.checked)}
                      />
                      <span>Usage N/A</span>
                    </label>
                    <label className={styles.fullField}><span>Maintenance work done</span><textarea value={draft.maintenanceWorkDone} onChange={(event) => updateDraft("maintenanceWorkDone", event.target.value)} rows={3} /></label>
                    <label className={styles.fullField}><span>Parts supplied</span><textarea value={draft.partsSupplied} onChange={(event) => updateDraft("partsSupplied", event.target.value)} rows={3} /></label>
                    <label className={styles.fullField}><span>Repair work done</span><textarea value={draft.repairWorkDone} onChange={(event) => updateDraft("repairWorkDone", event.target.value)} rows={3} /></label>
                    <label className={styles.fullField}><span>Cost Ledger notes</span><textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={3} /></label>
                  </>
                )}
                <label className={styles.fullField}><span>Internal admin note</span><textarea value={draft.adminNote} onChange={(event) => updateDraft("adminNote", event.target.value)} rows={3} placeholder="Only Aim4price admins can see this note." /></label>
              </fieldset>

              <div className={`${styles.primaryActions} ${isExternalSubmission ? styles.primaryActionsExternal : ""}`}>
                <button type="button" className={styles.secondaryButton} disabled={Boolean(busyAction) || !isRequestEditable || hasUnconfirmedTargetChange} onClick={() => void runAction("save_draft")}>
                  {busyAction === "save_draft" ? "Saving…" : "Save draft"}
                </button>
                <button type="button" className={styles.completeButton} disabled={Boolean(busyAction) || !isRequestEditable || !isMatchConfirmed} onClick={() => void runAction("complete")}>
                  {busyAction === "complete"
                    ? "Completing…"
                    : detail.submissionChannel === "owner_upload" || detail.submissionChannel === "accountant_upload"
                      ? "Create verified ledger record"
                      : "Verify & send to owner"}
                </button>
                {isExternalSubmission && !isTerminalRequest ? (
                  <button
                    type="button"
                    className={styles.directSaveButton}
                    disabled={Boolean(busyAction) || !isMatchConfirmed}
                    onClick={() => void runAction("complete_direct")}
                  >
                    {busyAction === "complete_direct" ? "Saving…" : "Save directly — owner approved"}
                  </button>
                ) : null}
              </div>

              <details className={styles.exceptionPanel}>
                <summary>Other actions</summary>
                <label><span>Reason or message</span><textarea rows={3} value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder="Required for information requests, duplicates and rejections." /></label>
                <div className={styles.exceptionActions}>
                  <button type="button" disabled={Boolean(busyAction) || !isRequestEditable || hasUnconfirmedTargetChange} onClick={() => void runAction("request_information")}>Request information</button>
                  <button type="button" disabled={Boolean(busyAction) || !isRequestEditable} onClick={() => void runAction("mark_duplicate")}>Mark duplicate</button>
                  <button type="button" className={styles.rejectButton} disabled={Boolean(busyAction) || !isRequestEditable} onClick={() => void runAction("reject")}>Reject</button>
                </div>
              </details>

              {!["completed", "declined", "rejected", "cancelled"].includes(detail.status) ? (
                <details className={styles.deletePanel}>
                  <summary>Delete capture request</summary>
                  <div className={styles.deletePanelBody}>
                    <p>The audit record is kept and uploaded files are removed.</p>
                    <label>
                      <span>Reason for deletion</span>
                      <textarea
                        rows={3}
                        value={deleteReason}
                        onChange={(event) => setDeleteReason(event.target.value)}
                        placeholder="Explain why this request should be removed."
                      />
                    </label>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => void runAction("delete")}
                    >
                      {busyAction === "delete" ? "Deleting…" : "Delete from queue"}
                    </button>
                  </div>
                </details>
              ) : null}

              <details className={styles.historyPanel}>
                <summary>Audit history ({events.length})</summary>
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
