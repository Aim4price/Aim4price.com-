"use client";
import { useState } from "react";
import styles from "../../../components/business-network/BusinessNetwork.module.css";
export default function Page() {
  const [email, setEmail] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className={`${styles.panel} ${styles.page}`}>
      <h1>Manage your business</h1>
      <p>We’ll email a secure link to update your listing or stop requests.</p>
      <form
        className={styles.panel}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/business-network/manage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setNotice(
              "If this email is listed, a management link is on its way.",
            );
          } catch (e) {
            setNotice(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Business email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button disabled={busy}>Send management link</button>
      </form>
      <p role="status">{notice}</p>
    </main>
  );
}
