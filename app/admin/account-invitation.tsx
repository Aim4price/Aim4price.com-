"use client";

import { useRef, useState } from "react";
import type { AdminUserRow } from "../../lib/admin-users";
import styles from "./page.module.css";

export default function AccountInvitation({user, onDone}: {user: AdminUserRow; onDone: () => void}) {
  const [state, setState] = useState<"ready" | "sending" | "sent" | "failed">("ready");
  const sending = useRef(false);
  async function invite() {
    if (sending.current) return;
    sending.current = true;
    setState("sending");
    try {
      const response = await fetch("/api/admin/users", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"send_setup",userId:user.userId})});
      if (!response.ok) throw new Error();
      setState("sent");
    } catch {
      setState("failed");
    } finally { sending.current = false; }
  }
  return <section className={styles.accountEditor} aria-label="Password setup invitation">
    <h2>Account created for {user.name}</h2>
    <p>{user.email}</p>
    <p role="status">{state === "sent" ? "Password setup email sent." : state === "failed" ? "The account is ready. Email sending could not be confirmed." : "Invite the client to choose their password when you’re ready."}</p>
    <div className={styles.headerActions}>
      {state !== "sent" && <button type="button" className={styles.notificationSendButton} disabled={state === "sending"} onClick={invite}>{state === "sending" ? "Sending…" : state === "failed" ? "Retry email" : "Send password setup email"}</button>}
      <button type="button" disabled={state === "sending"} className={styles.nameSecondaryButton} onClick={onDone}>Done</button>
    </div>
  </section>;
}
