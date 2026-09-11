"use client";
import BusinessShareHistory from "./BusinessShareHistory";
import { useState } from "react";
import styles from "./BusinessNetwork.module.css";
export default function BusinessInvite() {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  return (
    <div className={styles.panel}>
      <button type="button" onClick={() => setOpen(!open)}>
        Invite a business
      </button>
      {open ? (
        <div className={styles.card}>
          <label>
            Business name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
            />
          </label>
          <p className={styles.muted}>
            They appear for all owners after accepting. Joining is free.
          </p>
          <button
            type="button"
            disabled={busy || !name.trim() || !email.trim()}
            onClick={async () => {
              setBusy(true);
              setNotice("");
              try {
                const r = await fetch("/api/business-network/invite", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, email }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setNotice("Invitation sent.");
                setName("");
                setEmail("");
              } catch (e) {
                setNotice(
                  e instanceof Error ? e.message : "Invitation failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Sending…" : "Send invitation"}
          </button>
          {notice ? <p role="status">{notice}</p> : null}
        </div>
      ) : null}
      <BusinessShareHistory />
    </div>
  );
}
