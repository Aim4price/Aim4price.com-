"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "../auth/page.module.css";

type ResetPasswordClientProps = {
  token: string;
  error: string;
};

type NoticeTone = "success" | "error" | "info";

type ResetNotice = {
  tone: NoticeTone;
  title: string;
  text: string;
} | null;

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text.trim() ? { message: text } : null;
}

function getNestedRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  const record = getNestedRecord(payload);

  if (!record) {
    return null;
  }

  const errorRecord = getNestedRecord(record.error);
  const dataRecord = getNestedRecord(record.data);

  const candidates = [
    record.message,
    record.error,
    record.reason,
    errorRecord?.message,
    errorRecord?.error,
    dataRecord?.message,
    dataRecord?.error,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

export default function ResetPasswordClient({
  token,
  error,
}: ResetPasswordClientProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<ResetNotice>(
    error
      ? {
          tone: "error",
          title: "Reset link invalid",
          text: "The reset link is invalid or has expired. Request a new password reset email.",
        }
      : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canUseToken = Boolean(token) && !error;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    if (!canUseToken) {
      setNotice({
        tone: "error",
        title: "Reset link required",
        text: "Request a new reset email and open the link from your inbox.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setNotice({
        tone: "error",
        title: "Password too short",
        text: "Use at least 8 characters before continuing.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice({
        tone: "error",
        title: "Passwords do not match",
        text: "Confirm the same password in both password fields.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword,
          token,
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(payload) ??
            "Password reset failed. Request a new link and try again.",
        );
      }

      setNewPassword("");
      setConfirmPassword("");
      setNotice({
        tone: "success",
        title: "Password updated",
        text: "Your password has been reset. You can now log in with the new password.",
      });
    } catch (requestError) {
      setNotice({
        tone: "error",
        title: "Unable to reset password",
        text:
          requestError instanceof Error
            ? requestError.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <Link href="/auth#login" className={styles.homeLink}>
            Back to login
          </Link>
        </div>

        <section className={styles.frame}>
          <section
            className={styles.authCard}
            aria-labelledby="reset-password-heading"
            aria-busy={isSubmitting}
          >
            <div className={styles.authHeader}>
              <h1 id="reset-password-heading" className={styles.authTitle}>
                Set a new password
              </h1>
              <p className={styles.authText}>
                Create a new Aim4price password using the secure link from your
                reset email.
              </p>
            </div>

            {notice ? (
              <div
                className={`${styles.notice} ${
                  notice.tone === "success"
                    ? styles.noticeSuccess
                    : notice.tone === "info"
                      ? styles.noticeInfo
                      : styles.noticeError
                }`}
                role={notice.tone === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                <strong className={styles.noticeTitle}>{notice.title}</strong>
                <span className={styles.noticeText}>{notice.text}</span>
              </div>
            ) : null}

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <label className={styles.field}>
                <div className={styles.labelRow}>
                  <span className={styles.label}>New password</span>
                  <span className={styles.helperText}>
                    Minimum 8 characters
                  </span>
                </div>

                <div className={styles.passwordWrap}>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="newPassword"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Create a new password"
                    className={`${styles.input} ${styles.passwordInput}`}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={!canUseToken || isSubmitting}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className={styles.passwordToggle}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    disabled={!canUseToken || isSubmitting}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Confirm new password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Repeat your new password"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={!canUseToken || isSubmitting}
                />
              </label>

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={!canUseToken || isSubmitting}
              >
                {isSubmitting ? "Updating password..." : "Update password"}
              </button>
            </form>

            <p className={styles.footerText}>
              Need another link?{" "}
              <Link href="/auth#forgot" className={styles.footerButton}>
                Send reset email
              </Link>
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
