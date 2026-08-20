"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ADMIN_WORK_HEARTBEAT_CAP_SECONDS,
  ADMIN_WORK_HEARTBEAT_INTERVAL_MS,
  ADMIN_WORK_IDLE_TIMEOUT_MS,
  type AdminWorkSessionView,
} from "../lib/admin-work-tracker-shared";
import styles from "./AdminWorkTrackerBar.module.css";

type TrackerResponse = {
  ok?: boolean;
  activeSession?: AdminWorkSessionView | null;
  pauseReason?: string | null;
  error?: string;
};

const TRACKER_CHANGED_EVENT = "aim4price:admin-work-session-changed";
const TRACKER_TICK_EVENT = "aim4price:admin-work-session-tick";

function formatLiveDuration(secondsInput: number): string {
  const seconds = Math.max(0, Math.floor(secondsInput));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export default function AdminWorkTrackerBar() {
  const pathname = usePathname() || "/";
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [activeSession, setActiveSession] = useState<AdminWorkSessionView | null>(null);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isStopping, setIsStopping] = useState(false);
  const activeSessionRef = useRef<AdminWorkSessionView | null>(null);
  const pathnameRef = useRef(pathname);
  const lastActivityAtRef = useRef(Date.now());
  const heartbeatPendingRef = useRef(false);

  activeSessionRef.current = activeSession;
  pathnameRef.current = pathname;

  const loadActiveSession = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/work-tracker?view=active", {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        setAccess("denied");
        setActiveSession(null);
        return;
      }

      const data = (await response.json()) as TrackerResponse;
      if (!response.ok || !data.ok) return;
      setAccess("allowed");
      setActiveSession(data.activeSession ?? null);
      setPauseReason(data.pauseReason ?? null);
      setNowMs(Date.now());
      window.dispatchEvent(
        new CustomEvent(TRACKER_TICK_EVENT, {
          detail: { activeSession: data.activeSession ?? null },
        }),
      );
    } catch {
      // The timer remains visible with its last confirmed server value.
    }
  }, []);

  const sendHeartbeat = useCallback(async (browserActive: boolean) => {
    const expectedSession = activeSessionRef.current;
    if (!expectedSession || heartbeatPendingRef.current) return;
    heartbeatPendingRef.current = true;

    try {
      const response = await fetch("/api/admin/work-tracker", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "heartbeat",
          sessionId: expectedSession.id,
          pathname: pathnameRef.current,
          browserActive,
        }),
      });
      const data = (await response.json().catch(() => null)) as TrackerResponse | null;

      if (response.status === 401 || response.status === 403) {
        setAccess("denied");
        setActiveSession(null);
        return;
      }
      if (!response.ok || !data?.ok) return;
      setAccess("allowed");
      setActiveSession(data.activeSession ?? null);
      setPauseReason(data.pauseReason ?? null);
      setNowMs(Date.now());
      window.dispatchEvent(
        new CustomEvent(TRACKER_TICK_EVENT, {
          detail: { activeSession: data.activeSession ?? null },
        }),
      );
    } catch {
      // A later heartbeat safely resumes from the server-confirmed time.
    } finally {
      heartbeatPendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadActiveSession();
    const channel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("aim4price-admin-work-tracker");
    const handleTrackerChanged = () => {
      channel?.postMessage({ type: "session-changed" });
      void loadActiveSession();
    };
    if (channel) {
      channel.onmessage = () => void loadActiveSession();
    }
    window.addEventListener(TRACKER_CHANGED_EVENT, handleTrackerChanged);
    return () => {
      window.removeEventListener(TRACKER_CHANGED_EVENT, handleTrackerChanged);
      channel?.close();
    };
  }, [loadActiveSession]);

  useEffect(() => {
    if (access === "denied") return;
    const retryMs = activeSession ? 60_000 : 15_000;
    const poll = window.setInterval(() => void loadActiveSession(), retryMs);
    return () => window.clearInterval(poll);
  }, [access, activeSession?.id, loadActiveSession]);

  useEffect(() => {
    if (access !== "allowed" || !activeSession) return;
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    void sendHeartbeat(
      Date.now() - lastActivityAtRef.current < ADMIN_WORK_IDLE_TIMEOUT_MS,
    );
  }, [access, activeSession?.id, pathname, sendHeartbeat]);

  useEffect(() => {
    if (access !== "allowed" || !activeSession) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      const browserActive =
        Date.now() - lastActivityAtRef.current < ADMIN_WORK_IDLE_TIMEOUT_MS;
      void sendHeartbeat(browserActive);
    }, ADMIN_WORK_HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [access, activeSession?.id, sendHeartbeat]);

  useEffect(() => {
    if (access !== "allowed" || !activeSession) return;
    const tick = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, [access, activeSession?.id]);

  useEffect(() => {
    function noteActivity() {
      const wasIdle = Date.now() - lastActivityAtRef.current >= ADMIN_WORK_IDLE_TIMEOUT_MS;
      lastActivityAtRef.current = Date.now();
      if (wasIdle && document.visibilityState === "visible" && document.hasFocus()) {
        void sendHeartbeat(true);
      }
    }

    function handleVisibilityChange() {
      if (
        activeSessionRef.current &&
        document.visibilityState === "visible" &&
        document.hasFocus()
      ) {
        lastActivityAtRef.current = Date.now();
        void sendHeartbeat(true);
      }
    }

    function handleFocus() {
      lastActivityAtRef.current = Date.now();
      if (activeSessionRef.current) void sendHeartbeat(true);
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, noteActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, noteActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [sendHeartbeat]);

  const liveSeconds = useMemo(() => {
    if (!activeSession) return 0;
    if (!activeSession.trackingActive || pauseReason) return activeSession.durationSeconds;
    const heartbeatMs = new Date(activeSession.lastHeartbeatAtIso).getTime();
    const unconfirmedSeconds = Number.isFinite(heartbeatMs)
      ? Math.min(
          ADMIN_WORK_HEARTBEAT_CAP_SECONDS,
          Math.max(0, Math.floor((nowMs - heartbeatMs) / 1_000)),
        )
      : 0;
    return activeSession.durationSeconds + unconfirmedSeconds;
  }, [activeSession, nowMs, pauseReason]);

  async function stopWork() {
    const current = activeSessionRef.current;
    if (!current || isStopping) return;
    const confirmed = window.confirm(
      `Stop work for ${current.clientName}? You can add or change the report note afterwards.`,
    );
    if (!confirmed) return;

    setIsStopping(true);
    try {
      const response = await fetch("/api/admin/work-tracker", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", sessionId: current.id }),
      });
      const data = (await response.json().catch(() => null)) as TrackerResponse | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to stop work.");
      }
      setActiveSession(null);
      setPauseReason(null);
      window.dispatchEvent(new Event(TRACKER_CHANGED_EVENT));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to stop work.");
    } finally {
      setIsStopping(false);
    }
  }

  if (access !== "allowed" || !activeSession) return null;

  return (
    <aside className={`${styles.bar} ${pauseReason ? styles.barPaused : ""}`} aria-label="Admin work timer">
      <div className={styles.statusDot} aria-hidden="true" />
      <div className={styles.copy}>
        <span>{pauseReason ? "Work timer paused" : "Admin work timer"}</span>
        <strong>{activeSession.clientName}</strong>
        <small>{pauseReason || activeSession.currentPageLabel}</small>
      </div>
      <time className={styles.timer}>{formatLiveDuration(liveSeconds)}</time>
      <Link href="/admin/work-tracker" className={styles.reviewLink}>
        Review
      </Link>
      <button type="button" className={styles.stopButton} onClick={stopWork} disabled={isStopping}>
        {isStopping ? "Stopping…" : "Stop work"}
      </button>
    </aside>
  );
}
