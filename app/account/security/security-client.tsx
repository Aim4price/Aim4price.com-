"use client";

import { type FormEvent, useState } from "react";
import AccountSectionLayout from "../account-section-layout";
import type { AccountProfile, AccountScanPinStatus } from "../account-types";
import { isOwnerProfile, readResponseError } from "../account-types";
import styles from "../account-system.module.css";

type Props = { initialProfile: AccountProfile; initialScanPinStatus: AccountScanPinStatus };
type Notice = { tone: "success" | "error"; message: string } | null;
type ScanPinResponse = { ok: boolean; scanPin?: AccountScanPinStatus; error?: string };

export default function SecurityClient({ initialProfile: profile, initialScanPinStatus }: Props) {
  const [notice, setNotice] = useState<Notice>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [scanPin, setScanPin] = useState(initialScanPinStatus);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const owner = isOwnerProfile(profile);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword.trim()) return setNotice({ tone: "error", message: "Enter your current password." });
    if (newPassword.length < 8) return setNotice({ tone: "error", message: "Your new password must be at least 8 characters." });
    if (newPassword !== confirmPassword) return setNotice({ tone: "error", message: "The new passwords do not match." });

    setChangingPassword(true);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readResponseError(payload, "Failed to change password."));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice({ tone: "success", message: "Password changed. Other sessions have been signed out." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Failed to change password." });
    } finally {
      setChangingPassword(false);
    }
  }

  async function sendResetEmail() {
    setSendingReset(true);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, redirectTo: new URL("/reset-password", window.location.origin).toString() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readResponseError(payload, "Failed to send the reset email."));
      setNotice({ tone: "success", message: "Reset password email sent. Check your inbox for the secure link." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Failed to send the reset email." });
    } finally {
      setSendingReset(false);
    }
  }

  async function updatePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(newPin)) return setNotice({ tone: "error", message: "Use a 4 to 8 digit QR PIN." });
    if (newPin !== confirmPin) return setNotice({ tone: "error", message: "The QR PINs do not match." });
    setSavingPin(true);
    setNotice(null);
    try {
      const response = await fetch("/api/account-profile/scan-pin", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin, confirmPin }),
      });
      const payload = (await response.json().catch(() => null)) as ScanPinResponse | null;
      if (!response.ok || !payload?.ok || !payload.scanPin) throw new Error(readResponseError(payload, "Failed to save the QR PIN."));
      setScanPin(payload.scanPin);
      setNewPin("");
      setConfirmPin("");
      setNotice({ tone: "success", message: "QR scan PIN saved." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Failed to save the QR PIN." });
    } finally {
      setSavingPin(false);
    }
  }

  async function disablePin() {
    setSavingPin(true);
    setNotice(null);
    try {
      const response = await fetch("/api/account-profile/scan-pin", { method: "DELETE", credentials: "include" });
      const payload = (await response.json().catch(() => null)) as ScanPinResponse | null;
      if (!response.ok || !payload?.ok || !payload.scanPin) throw new Error(readResponseError(payload, "Failed to disable the QR PIN."));
      setScanPin(payload.scanPin);
      setNotice({ tone: "success", message: "QR scan PIN disabled." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Failed to disable the QR PIN." });
    } finally {
      setSavingPin(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deletePassword.trim()) return setNotice({ tone: "error", message: "Enter your password to delete the account." });
    if (deleteText.trim().toUpperCase() !== "DELETE") return setNotice({ tone: "error", message: "Type DELETE to confirm account removal." });
    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/delete-user", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword, callbackURL: "/" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readResponseError(payload, "Failed to delete account."));
      window.location.assign("/");
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Failed to delete account." });
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AccountSectionLayout
      profile={profile}
      eyebrow="Protected settings"
      title={owner ? "Security & QR access" : "Password & security"}
      description="Manage sign-in protection, password recovery and sensitive account actions in one place."
      badge="Secure account"
    >
      {notice ? <div className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}>{notice.message}</div> : null}
      <div className={styles.securityGrid}>
        <section className={styles.formCard}>
          <form className={styles.formSection} onSubmit={changePassword}>
            <div className={styles.formSectionHeader}><h2>Change password</h2><p>Use at least 8 characters. Saving signs out other active sessions.</p></div>
            <label className={styles.fullField}><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>New password</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Minimum 8 characters" /></label>
              <label className={styles.field}><span>Confirm new password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            </div>
            <button type="submit" className={styles.primaryButton} disabled={changingPassword}>{changingPassword ? "Changing…" : "Change password"}</button>
          </form>

          {owner ? (
            <form className={styles.formSection} onSubmit={updatePin}>
              <div className={styles.formSectionHeader}><h2>QR scan PIN</h2><p>Require a private 4 to 8 digit PIN before someone can update a scanned asset.</p></div>
              <div className={styles.mapStatus}><span>Current status</span><strong>{scanPin.hasPin && scanPin.enabled ? "PIN active" : "Not configured"}</strong></div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}><span>New PIN</span><input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))} /></label>
                <label className={styles.field}><span>Confirm PIN</span><input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))} /></label>
              </div>
              <div className={styles.saveBarActions}>
                <button type="submit" className={styles.primaryButton} disabled={savingPin}>{savingPin ? "Saving…" : scanPin.hasPin ? "Update PIN" : "Set PIN"}</button>
                {scanPin.hasPin ? <button type="button" className={styles.secondaryButton} onClick={disablePin} disabled={savingPin}>Disable PIN</button> : null}
              </div>
            </form>
          ) : null}
        </section>

        <aside className={styles.sideCard}>
          <div><h2>Password recovery</h2><p>Send a secure reset link to the email address used for this account.</p></div>
          <div className={styles.detailRow}><span>Account email</span><strong>{profile.email}</strong></div>
          <button type="button" className={styles.secondaryButton} onClick={sendResetEmail} disabled={sendingReset}>{sendingReset ? "Sending…" : "Send reset password email"}</button>
          <div className={styles.privacyCard}><strong>Security tip</strong><p>Never share your main account password. Use the dedicated Owner App, Dealer App or Field Manager access pages for staff.</p></div>
          <div className={styles.dangerZone}>
            <h3>Delete account</h3>
            <p>Permanently remove this account and its saved workspace data. This cannot be undone.</p>
            <button type="button" className={styles.dangerButton} onClick={() => setDeleteDialogOpen(true)}>Delete account</button>
          </div>
        </aside>
      </div>

      {deleteDialogOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteDialogOpen(false); }}>
          <form className={styles.confirmDialog} onSubmit={deleteAccount} role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <h2 id="delete-account-title">Permanently delete account?</h2>
            <p>Enter your password and type DELETE. Your account and saved workspace data cannot be recovered afterwards.</p>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>Password</span><input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" /></label>
              <label className={styles.field}><span>Type DELETE</span><input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" /></label>
            </div>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</button>
              <button type="submit" className={styles.dangerButton} disabled={deleting}>{deleting ? "Deleting…" : "Delete permanently"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </AccountSectionLayout>
  );
}
