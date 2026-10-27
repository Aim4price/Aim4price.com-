"use client";
import { useEffect, useState } from "react";
import styles from "../../dealer/parts/parts.module.css";
export default function JoinParts() {
  const [token, setToken] = useState(""),
    [pin, setPin] = useState(""),
    [sent, setSent] = useState(false),
    [done, setDone] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [list, setList] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.search).get("token") || "";
    setToken(value);
    if (value)
      void fetch("/api/parts-network?token=" + encodeURIComponent(value), {
        cache: "no-store",
        headers: { "x-aim4price-client-realm": "website" },
      })
        .then(async (r) => {
          if (!r.ok) return;
          const d = await r.json();
          setSignedIn(true);
          if (d.accepted) {
            setDone(true);
            setList(d.network);
            if (d.status === "active")
              window.location.replace(
                "/parts/" + encodeURIComponent(d.network),
              );
          }
        })
        .catch(() => {});
  }, []);
  async function submit(action: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/parts-network", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aim4price-client-realm": "website",
        },
        body: JSON.stringify({ action, token, pin }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (action === "accept") {
        setDone(true);
        setList(d.network || "");
      } else setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const returnTo = "/parts/join?token=" + encodeURIComponent(token);
  return (
    <main className={styles.page}>
      <section className={styles.invitationLayout}>
        <div className={styles.invitationIntro}><span className={styles.eyebrow}>Aim4price · Dealer parts</span><h1>Parts.<br />Shared with you.</h1><p>A private parts list from another dealer.</p></div>
        <div className={styles.invitationCard}>
        <span className={styles.eyebrow}>Aim4price · Shared parts</span>
        <h2>Open shared parts</h2>
        {done ? (
          <>
            <p>
              Your email is verified. The list owner will confirm your
              dealership before opening access.
            </p>
            <a
              className={styles.button}
              href={
                "/parts" + (list ? "/" + encodeURIComponent(list) : "")
              }
            >
              View shared parts
            </a>
          </>
        ) : (
          <>
            {!signedIn && (
              <>
                <p>
                  Sign up or sign in with the email address on your invitation.
                  New dealers create their password during signup.
                </p>
                <a
                  className={styles.button}
                  href={"/auth?returnTo=" + encodeURIComponent(returnTo)}
                >
                  Sign up / Sign in
                </a>
              </>
            )}
            {signedIn && <p>Verify your invitation with an email PIN.</p>}
            {sent && (
              <label>
                Email PIN
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </label>
            )}
            {signedIn && <div className={styles.actions}>
              <button
                disabled={busy || !token}
                onClick={() => void submit("send-pin")}
              >
                {sent ? "Resend PIN" : "Send email PIN"}
              </button>
              {sent && (
                <button
                  disabled={busy || pin.length !== 6}
                  onClick={() => void submit("accept")}
                >
                  Verify invitation
                </button>
              )}
            </div>}
          </>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        </div>
      </section>
    </main>
  );
}
