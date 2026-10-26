"use client";
import { useEffect, useState } from "react";
import styles from "../../dealer/parts/parts.module.css";
export default function JoinParts() {
  const [token, setToken] = useState(""),
    [pin, setPin] = useState(""),
    [sent, setSent] = useState(false),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
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
      if (action === "accept") setDone(true);
      else setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const returnTo = "/parts/join?token=" + encodeURIComponent(token);
  return (
    <main className={styles.page}>
      <section className={styles.join}>
        <span className={styles.eyebrow}>
          Aim4price · Private dealer network
        </span>
        <h1>Join Parts</h1>
        {done ? (
          <>
            <p>
              Your email is verified. A network administrator will confirm your
              dealership before opening access.
            </p>
            <a className={styles.button} href="/parts">
              View membership
            </a>
          </>
        ) : (
          <>
            <p>
              Sign up or sign in with the email address on your invitation. New
              dealers create their password during signup.
            </p>
            <a
              className={styles.button}
              href={"/auth?returnTo=" + encodeURIComponent(returnTo)}
            >
              Sign up / Sign in
            </a>
            <p>Once signed in, verify your invitation with an email PIN.</p>
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
            <div className={styles.actions}>
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
            </div>
          </>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
