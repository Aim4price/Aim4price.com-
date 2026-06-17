"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type AccountStatus = "pending_payment" | "active" | "suspended";

type AdminUserRow = {
  userId: string;
  name: string;
  email: string;
  phone: string;
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
  redirectUrl?: string;
};

type AdminAction =
  | "activate"
  | "pending"
  | "suspend"
  | "send_reset"
  | "open_account"
  | "delete_user";

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
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClassName(status: AccountStatus): string {
  if (status === "active") return `${styles.statusPill} ${styles.statusActive}`;
  if (status === "suspended")
    return `${styles.statusPill} ${styles.statusSuspended}`;
  return `${styles.statusPill} ${styles.statusPending}`;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSearch(user: AdminUserRow, searchTerm: string): boolean {
  const query = normalizeSearchValue(searchTerm);

  if (!query) {
    return true;
  }

  const haystack = [
    user.name,
    user.email,
    user.phone,
    user.accountType,
    user.accountSubtype,
    user.introducedBy,
    user.accountStatusLabel,
    user.passwordStatus,
    formatDate(user.createdAtIso),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getActionText(action: AdminAction, user: AdminUserRow): string {
  if (action === "activate") return `${user.email} activated.`;
  if (action === "pending") return `${user.email} set back to pending.`;
  if (action === "suspend") return `${user.email} suspended.`;
  if (action === "send_reset") return `Reset email sent to ${user.email}.`;
  if (action === "open_account") return `Opening ${user.email}.`;
  return `${user.email} deleted.`;
}

function getBusyText(action: AdminAction): string {
  if (action === "activate") return "Activating...";
  if (action === "pending") return "Updating...";
  if (action === "suspend") return "Suspending...";
  if (action === "send_reset") return "Sending...";
  if (action === "open_account") return "Opening...";
  return "Deleting...";
}

export default function AdminClient({
  initialUsers,
}: {
  initialUsers: AdminUserRow[];
}) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busyUserAction, setBusyUserAction] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const visibleUsers = useMemo(
    () => users.filter((user) => matchesSearch(user, searchTerm)),
    [users, searchTerm],
  );

  async function handleSignOut() {
    try {
      setIsSigningOut(true);

      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "close_account" }),
      }).catch(() => null);

      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
    } finally {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("aim4price-tractors-kit-register");
        window.localStorage.removeItem("aim4price-tractors-kit-marketplace");
        window.location.assign("/");
      }
    }
  }

  async function runAction(user: AdminUserRow, action: AdminAction) {
    if (action === "delete_user") {
      const confirmation =
        typeof window !== "undefined"
          ? window.prompt(
              `Type DELETE to permanently delete ${user.email} and that account's saved Aim4price workspace data.`,
            )
          : null;

      if (confirmation !== "DELETE") {
        return;
      }
    }

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

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Admin action failed.");
      }

      if (data.users) {
        setUsers(data.users);
      }

      setNotice({
        tone: "success",
        message: data.message || getActionText(action, user),
      });

      if (action === "open_account" && data.redirectUrl && typeof window !== "undefined") {
        window.location.assign(data.redirectUrl);
      }
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
      <section className={styles.topBar}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Aim4price admin</p>
          <h1>Users</h1>
          <span>
            Showing {visibleUsers.length} of {users.length} account
            {users.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span>Search users</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, email, number, type or status"
            />
          </label>

          <button
            type="button"
            className={styles.signOutButton}
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
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

      <section className={styles.tableCard} aria-label="User accounts">
        <div className={styles.tableWrap}>
          <table className={styles.userTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Number</th>
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
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.emptyCell}>
                    No matching users found.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => {
                  const isProtectedAdmin =
                    user.email.trim().toLowerCase() === "aim4price@gmail.com";

                  return (
                    <tr key={user.userId}>
                      <td>
                        <strong className={styles.nameCell}>{user.name}</strong>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        {user.phone ? (
                          <span className={styles.phoneCell}>{user.phone}</span>
                        ) : (
                          <span className={styles.mutedText}>Not saved</span>
                        )}
                      </td>
                      <td>{formatAccountValue(user.accountType)}</td>
                      <td>{formatAccountValue(user.accountSubtype)}</td>
                      <td>{user.introducedBy}</td>
                      <td>
                        <span className={statusClassName(user.accountStatus)}>
                          {user.accountStatusLabel}
                        </span>
                      </td>
                      <td>
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
                      <td>{formatDate(user.createdAtIso)}</td>
                      <td>
                        <div className={styles.actionGroup}>
                          <button
                            type="button"
                            className={styles.openButton}
                            onClick={() => runAction(user, "open_account")}
                            disabled={busyUserAction !== null || isProtectedAdmin}
                          >
                            {busyUserAction === `${user.userId}:open_account`
                              ? getBusyText("open_account")
                              : "Open"}
                          </button>

                          <button
                            type="button"
                            className={styles.activateButton}
                            onClick={() => runAction(user, "activate")}
                            disabled={
                              busyUserAction !== null ||
                              user.accountStatus === "active"
                            }
                          >
                            {busyUserAction === `${user.userId}:activate`
                              ? getBusyText("activate")
                              : "Activate"}
                          </button>

                          <button
                            type="button"
                            onClick={() => runAction(user, "pending")}
                            disabled={
                              busyUserAction !== null ||
                              isProtectedAdmin ||
                              user.accountStatus === "pending_payment"
                            }
                          >
                            {busyUserAction === `${user.userId}:pending`
                              ? getBusyText("pending")
                              : "Pending"}
                          </button>

                          <button
                            type="button"
                            onClick={() => runAction(user, "suspend")}
                            disabled={
                              busyUserAction !== null ||
                              isProtectedAdmin ||
                              user.accountStatus === "suspended"
                            }
                          >
                            {busyUserAction === `${user.userId}:suspend`
                              ? getBusyText("suspend")
                              : "Suspend"}
                          </button>

                          <button
                            type="button"
                            onClick={() => runAction(user, "send_reset")}
                            disabled={busyUserAction !== null}
                          >
                            {busyUserAction === `${user.userId}:send_reset`
                              ? getBusyText("send_reset")
                              : "Reset"}
                          </button>

                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => runAction(user, "delete_user")}
                            disabled={busyUserAction !== null || isProtectedAdmin}
                          >
                            {busyUserAction === `${user.userId}:delete_user`
                              ? getBusyText("delete_user")
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
