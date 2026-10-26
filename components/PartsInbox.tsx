"use client";
import { useEffect, useState } from "react";
import styles from "../app/dealer/parts/parts.module.css";
type Inbox = {
  shared: { id: string; name: string; status: string }[];
  invitations: { id: string; name: string }[];
  enquiries: {
    id: string;
    name: string;
    part_number: string;
    message: string;
    reply_email: string;
    status: string;
    created_at: string;
  }[];
};
export default function PartsInbox({
  onAccepted,
  showShared = true,
}: {
  onAccepted?: () => void;
  showShared?: boolean;
}) {
  const [data, setData] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState("/parts");
  async function request(body?: Record<string, unknown>) {
    const app = window.location.pathname.startsWith("/dealer/");
    const r = await fetch("/api/parts-network" + (body ? "" : "?view=inbox"), {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-aim4price-client-realm": app ? "dealer" : "website",
      },
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) {
      if (!body && r.status === 403) return null;
      throw new Error(
        (await r.json()).error || "Could not load parts enquiries.",
      );
    }
    return r.json();
  }
  useEffect(() => {
    let live = true;
    setBase(
      window.location.pathname.startsWith("/dealer/")
        ? "/dealer/parts"
        : "/parts",
    );
    void request()
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  async function act(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(body);
      setData(await request());
      if (body.action === "accept-direct") onAccepted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (
    !error &&
    (!data ||
      (!data.invitations.length &&
        !data.enquiries.length &&
        (!showShared || !data.shared?.length)))
  )
    return null;
  return (
    <details className={`${styles.inbox} ${styles.page}`} open>
      <summary>
        Parts ·{" "}
        {(data?.invitations.length || 0) +
          (showShared ? data?.shared?.length || 0 : 0)}{" "}
        shared lists ·{" "}
        {data?.enquiries.filter((e) => e.status === "new").length || 0} new
        enquiries
      </summary>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {data?.invitations.map((i) => (
        <div key={i.id} className={styles.inboxItem}>
          <h3>{i.name}</h3>
          <p>A parts list has been shared with your account.</p>
          <button
            disabled={busy}
            onClick={() => void act({ action: "accept-direct", id: i.id })}
          >
            Accept shared parts
          </button>
        </div>
      ))}
      {showShared &&
        data?.shared?.map((list) => (
          <div key={list.id} className={styles.inboxItem}>
            <h3>{list.name}</h3>
            <a
              className={styles.button}
              href={`${base}?list=${encodeURIComponent(list.id)}`}
            >
              {list.status === "active"
                ? "View shared parts"
                : "View access status"}
            </a>
          </div>
        ))}
      {data?.enquiries.map((e) => (
        <div key={e.id} className={styles.inboxItem}>
          <h3>
            {e.part_number} · {e.name}
          </h3>
          <small>
            {new Date(e.created_at).toLocaleDateString("en-ZA")} ·{" "}
            {e.status === "new" ? "New" : "Handled"}
          </small>
          <p>{e.message}</p>
          <div className={styles.actions}>
            <a
              className={styles.button}
              href={`mailto:${encodeURIComponent(e.reply_email)}?subject=${encodeURIComponent("Part enquiry: " + e.part_number)}`}
            >
              Reply to {e.reply_email}
            </a>
            {e.status === "new" && (
              <button
                disabled={busy}
                onClick={() => void act({ action: "handle-enquiry", id: e.id })}
              >
                Mark handled
              </button>
            )}
          </div>
        </div>
      ))}
      <p>
        <a className={styles.button} href={base}>
          Open Parts
        </a>
      </p>
    </details>
  );
}
