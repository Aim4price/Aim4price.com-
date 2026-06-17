"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type AccountStatus = "pending_payment" | "active" | "suspended";

type AdminUserRow = {
  userId: string;
  name: string;
  email: string;
  accountType: string;
  accountSubtype: string;
  introducedBy: string;
  introducedByOption: string;
  introducedByName: string;
  accountStatus: AccountStatus;
  accountStatusLabel: string;
  passwordStatus: "Set" | "Not set";
  createdAtIso: string | null;
};

type ApiResponse = {
  ok: boolean;
  users?: AdminUserRow[];
  message?: string;
  error?: string;
};

type AdminAction = "activate" | "pending" | "suspend" | "send_reset";

type Notice = {
  tone: "success" | "error";
  message: string;
} | null;

function formatDate(value: string | null): string {
  if (!value) return "Unknown";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatAccountValue(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClassName(status: AccountStatus): string {
  if (status === "active") return `${styles.statusPill} ${styles.statusActive}`;
  if (status === "suspended")
    return `${styles.statusPill} ${styles.statusSuspended}`;
  return `${styles.statusPill} ${styles.statusPending}`;
}

export default function AdminClient({
  initialUsers,
}: {
  initialUsers: AdminUserRow[];
}) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyUserAction, setBusyUserAction] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.accountStatus === "active").length,
      pending: users.filter((user) => user.accountStatus === "pending_payment")
        .length,
      suspended: users.filter((user) => user.accountStatus === "suspended")
        .length,
    }),
    [users],
  );

  async function runAction(user: AdminUserRow, action: AdminAction) {
    setNotice(null);
    setBusyUserAction(`${user.userId}:${action}`);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: user.userId, action }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok || !data.users) {
        throw new Error(data.error || "Admin action failed.");
      }

      setUsers(data.users);
      setNotice({
        tone: "success",
        message:
          data.message ||
          (action === "activate"
            ? `${user.email} activated.`
            : action === "pending"
              ? `${user.email} set back to pending.`
              : action === "suspend"
                ? `${user.email} suspended.`
                : `Reset email sent to ${user.email}.`),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Admin action failed.",
      });
    } finally {
      setBusyUserAction(null);
    }
  }

  return (
    <section className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Aim4price admin</p>
          <h1>Account management</h1>
          <p>
            Activate paid accounts manually, suspend access where needed, and
            send reset-password emails without ever exposing passwords.
          </p>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="Account summary">
        <div className={styles.summaryCard}>
          <span>Total users</span>
          <strong>{counts.total}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Active</span>
          <strong>{counts.active}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Pending payment</span>
          <strong>{counts.pending}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Suspended</span>
          <strong>{counts.suspended}</strong>
        </div>
      </section>

      {notice ? (
        <div
          className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
          role="status"
        >
          {notice.message}
        </div>
      ) : null}

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div>
            <h2>Users</h2>
            <p>
              One admin table for payment status, account status, introduced-by
              tracking and password reset actions.
            </p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.userTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Account type</th>
                <th>Subtype</th>
                <th>Introduced by</th>
                <th>Payment/account status</th>
                <th>Password</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.emptyCell}>
                    No users found yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.userId}>
                    <td data-label="Name">
                      <strong className={styles.nameCell}>{user.name}</strong>
                    </td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Account type">
                      {formatAccountValue(user.accountType)}
                    </td>
                    <td data-label="Subtype">
                      {formatAccountValue(user.accountSubtype)}
                    </td>
                    <td data-label="Introduced by">{user.introducedBy}</td>
                    <td data-label="Status">
                      <span className={statusClassName(user.accountStatus)}>
                        {user.accountStatusLabel}
                      </span>
                    </td>
                    <td data-label="Password">
                      <span
                        className={
                          user.passwordStatus === "Set"
                            ? styles.passwordSet
                            : styles.passwordMissing
                        }
                      >
                        {user.passwordStatus}
                      </span>
                    </td>
                    <td data-label="Created">
                      {formatDate(user.createdAtIso)}
                    </td>
                    <td data-label="Actions">
                      <div className={styles.actionGroup}>
                        <button
                          type="button"
                          onClick={() => runAction(user, "activate")}
                          disabled={
                            busyUserAction !== null ||
                            user.accountStatus === "active"
                          }
                        >
                          {busyUserAction === `${user.userId}:activate`
                            ? "Activating..."
                            : "Activate account"}
                        </button>
                        <button
                          type="button"
                          onClick={() => runAction(user, "pending")}
                          disabled={
                            busyUserAction !== null ||
                            user.accountStatus === "pending_payment"
                          }
                        >
                          {busyUserAction === `${user.userId}:pending`
                            ? "Updating..."
                            : "Set pending"}
                        </button>
                        <button
                          type="button"
                          onClick={() => runAction(user, "suspend")}
                          disabled={
                            busyUserAction !== null ||
                            user.accountStatus === "suspended"
                          }
                        >
                          {busyUserAction === `${user.userId}:suspend`
                            ? "Suspending..."
                            : "Suspend"}
                        </button>
                        <button
                          type="button"
                          onClick={() => runAction(user, "send_reset")}
                          disabled={busyUserAction !== null}
                        >
                          {busyUserAction === `${user.userId}:send_reset`
                            ? "Sending..."
                            : "Send reset email"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
