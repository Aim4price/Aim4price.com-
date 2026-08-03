'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppHeader from '../../../components/AppHeader';
import styles from '../dealer-app/page.module.css';

type OwnerAppUser = {
  id: string;
  displayName: string;
  username: string;
  isActive: boolean;
  accessRole: 'admin' | 'operations' | 'view_only';
  lastLoginAtIso: string | null;
  updatedAtIso: string;
};

type ApiResponse = { ok: boolean; users?: OwnerAppUser[]; user?: OwnerAppUser; error?: string };
type Draft = { displayName: string; username: string; password: string; accessRole: OwnerAppUser['accessRole'] };
const EMPTY_DRAFT: Draft = { displayName: '', username: '', password: '', accessRole: 'operations' };

const ACCESS_ROLES: Array<{ value: OwnerAppUser['accessRole']; label: string; description: string }> = [
  { value: 'operations', label: 'Operations', description: 'Usage, maintenance, fuel, location, photos and problems.' },
  { value: 'view_only', label: 'View only', description: 'Can view assets and records without changing anything.' },
  { value: 'admin', label: 'Owner / Admin', description: 'Full access, including values, finance, Marketplace and deletion.' },
];

function accessRoleLabel(role: OwnerAppUser['accessRole']) {
  return ACCESS_ROLES.find((option) => option.value === role)?.label ?? 'Operations';
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._@-]/g, '').slice(0, 80);
}

function normalizePasscode(value: string) {
  return value.slice(0, 64);
}

function isValidPasscode(value: string) {
  return value.length >= 4 && value.length <= 64 && /\S/.test(value);
}

function formatDate(value: string | null) {
  if (!value) return 'Not yet';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Not yet'
    : new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function loginLink() {
  return typeof window === 'undefined' ? '/owner-app/login' : `${window.location.origin}/owner-app/login`;
}

export default function OwnerAppAccessClient() {
  const [users, setUsers] = useState<OwnerAppUser[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editDrafts, setEditDrafts] = useState<Record<string, Draft>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [createUsernameError, setCreateUsernameError] = useState('');
  const [editUsernameErrors, setEditUsernameErrors] = useState<Record<string, string>>({});
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const appLink = useMemo(loginLink, []);

  useEffect(() => { void loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await fetch('/api/owner-app/users', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as ApiResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to load Owner App users.');
      const nextUsers = payload.users ?? [];
      setUsers(nextUsers);
      setEditDrafts(Object.fromEntries(nextUsers.map((user) => [user.id, {
        displayName: user.displayName,
        username: user.username,
        password: '',
        accessRole: user.accessRole,
      }])));
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load Owner App users.' });
    } finally {
      setLoading(false);
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    if (!draft.displayName.trim() || normalizeUsername(draft.username).length < 3 || !isValidPasscode(draft.password)) {
      setNotice({ tone: 'error', message: 'Enter a name, a username of at least 3 characters, and a passcode of at least 4 characters.' });
      return;
    }
    setCreateUsernameError('');
    setCreating(true);
    try {
      const response = await fetch('/api/owner-app/users', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, username: normalizeUsername(draft.username) }),
      });
      const payload = await response.json().catch(() => null) as ApiResponse | null;
      if (!response.ok || !payload?.ok || !payload.user) throw new Error(payload?.error || 'Failed to create Owner App user.');
      setUsers((current) => [payload.user!, ...current]);
      setEditDrafts((current) => ({ ...current, [payload.user!.id]: { displayName: payload.user!.displayName, username: payload.user!.username, password: '', accessRole: payload.user!.accessRole } }));
      setDraft(EMPTY_DRAFT);
      setShowCreatePassword(false);
      setCreateUsernameError('');
      setNotice({ tone: 'success', message: 'Owner App user created.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create Owner App user.';
      if (/username is already in use/i.test(message)) {
        setCreateUsernameError(message);
        setNotice(null);
      } else {
        setNotice({ tone: 'error', message });
      }
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(user: OwnerAppUser, changes: Record<string, unknown>, message: string) {
    setEditUsernameErrors((current) => ({ ...current, [user.id]: '' }));
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/owner-app/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes),
      });
      const payload = await response.json().catch(() => null) as ApiResponse | null;
      if (!response.ok || !payload?.ok || !payload.user) throw new Error(payload?.error || 'Failed to update Owner App user.');
      const updated = payload.user;
      setUsers((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setEditDrafts((current) => ({ ...current, [updated.id]: { displayName: updated.displayName, username: updated.username, password: '', accessRole: updated.accessRole } }));
      setVisiblePasswords((current) => ({ ...current, [updated.id]: false }));
      setEditUsernameErrors((current) => ({ ...current, [updated.id]: '' }));
      setNotice({ tone: 'success', message });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update Owner App user.';
      if (/username is already in use/i.test(errorMessage)) {
        setEditUsernameErrors((current) => ({ ...current, [user.id]: errorMessage }));
        setNotice(null);
      } else {
        setNotice({ tone: 'error', message: errorMessage });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveUser(event: FormEvent, user: OwnerAppUser) {
    event.preventDefault();
    const edit = editDrafts[user.id];
    if (!edit) return;
    const changes: Record<string, unknown> = { displayName: edit.displayName.trim(), username: normalizeUsername(edit.username), accessRole: edit.accessRole };
    if (edit.password) {
      if (!isValidPasscode(edit.password)) {
        setNotice({ tone: 'error', message: 'The new passcode must contain at least 4 characters.' });
        return;
      }
      changes.password = edit.password;
    }
    await patchUser(user, changes, edit.password ? 'Owner App user updated and existing sessions revoked.' : 'Owner App user updated.');
  }

  async function deleteUser(user: OwnerAppUser) {
    if (!window.confirm(`Delete the Owner App user for ${user.displayName}? This cannot be undone.`)) return;
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/owner-app/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', credentials: 'include' });
      const payload = await response.json().catch(() => null) as ApiResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Failed to delete Owner App user.');
      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      setExpandedId(null);
      setNotice({ tone: 'success', message: 'Owner App user deleted and existing sessions revoked.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to delete Owner App user.' });
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(appLink);
      setNotice({ tone: 'success', message: 'Owner App login link copied.' });
    } catch {
      setNotice({ tone: 'error', message: 'Copy failed. Use the link shown on this page.' });
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Aim4price Owner', text: 'Open Aim4price Owner', url: appLink });
        return;
      } catch { /* Clipboard fallback below. */ }
    }
    await copyLink();
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />
      <section className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={() => window.location.assign('/account')}>← Back to account</button>
        <section className={styles.heroCard}>
          <div className={styles.heroCopy}>
            <h1>Aim4price Owner</h1>
            <p>Create and manage the usernames that can use your Owner App.</p>
          </div>
          <div className={styles.linkPanel}>
            <div className={styles.linkPanelHeader}><h2>Owner App login link</h2><p>Share this direct link with active users.</p></div>
            <code>{appLink}</code>
            <div className={styles.shareRow}>
              <button type="button" className={styles.secondaryButton} onClick={() => void copyLink()}>Copy link</button>
              <button type="button" className={styles.primaryButton} onClick={() => void shareLink()}>Share link</button>
            </div>
          </div>
        </section>

        {notice ? <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>{notice.message}</div> : null}

        <section className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}><h2>New Owner App user</h2><p>Create one username and a passcode of at least 4 characters.</p></div>
            <form className={styles.form} onSubmit={createUser}>
              <label className={styles.field}><span>Display name</span><input value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Example: Farm owner" /></label>
              <label className={styles.field}>
                <span>Username</span>
                <input value={draft.username} onChange={(event) => { setDraft((current) => ({ ...current, username: normalizeUsername(event.target.value) })); setCreateUsernameError(''); }} placeholder="owner.name" autoCapitalize="none" aria-invalid={Boolean(createUsernameError)} />
                {createUsernameError ? <small className={styles.fieldError} role="alert">{createUsernameError}</small> : null}
              </label>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="owner-app-create-password">Passcode</label>
                <div className={styles.passwordInputWrap}>
                  <input id="owner-app-create-password" type={showCreatePassword ? 'text' : 'password'} value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: normalizePasscode(event.target.value) }))} placeholder="At least 4 characters" minLength={4} maxLength={64} autoComplete="new-password" />
                  <button type="button" className={styles.passwordToggleButton} onClick={() => setShowCreatePassword((current) => !current)}>{showCreatePassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <label className={styles.field}><span>Access</span><select value={draft.accessRole} onChange={(event) => setDraft((current) => ({ ...current, accessRole: event.target.value as OwnerAppUser['accessRole'] }))}>{ACCESS_ROLES.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}</select></label>
              <button type="submit" className={styles.primaryButton} disabled={creating}>{creating ? 'Creating…' : 'Create login'}</button>
            </form>
          </section>

          <section className={`${styles.card} ${styles.managerListCard}`}>
            <div className={styles.cardHeader}><h2>Owner App users</h2><p>Edit, reset, activate, deactivate or delete access.</p></div>
            {loading ? <p className={styles.emptyState}>Loading Owner App users…</p> : null}
            {!loading && !users.length ? <p className={styles.emptyState}>No Owner App users created yet.</p> : null}
            <div className={styles.managerList}>
              {users.map((user) => {
                const edit = editDrafts[user.id] ?? { displayName: user.displayName, username: user.username, password: '', accessRole: user.accessRole };
                const expanded = expandedId === user.id;
                const busy = busyId === user.id;
                return (
                  <article key={user.id} className={`${styles.managerCard} ${expanded ? styles.managerCardExpanded : ''}`}>
                    <div className={styles.managerSummary}>
                      <div className={styles.managerIdentity}><strong>{user.displayName}</strong><span>{user.username} · {accessRoleLabel(user.accessRole)}</span></div>
                      <div className={styles.managerSummaryMeta}><span><b>Last login</b>{formatDate(user.lastLoginAtIso)}</span><span><b>Updated</b>{formatDate(user.updatedAtIso)}</span></div>
                      <span className={`${styles.statusText} ${user.isActive ? styles.statusActive : styles.statusInactive}`}>{user.isActive ? 'Active' : 'Inactive'}</span>
                      <button type="button" className={styles.manageButton} onClick={() => setExpandedId(expanded ? null : user.id)}>{expanded ? 'Close' : 'Manage'}</button>
                    </div>
                    {expanded ? (
                      <div className={styles.managerDropdown}>
                        <form className={styles.inlineForm} onSubmit={(event) => void saveUser(event, user)}>
                          <label className={styles.compactField}><span>Display name</span><input value={edit.displayName} onChange={(event) => setEditDrafts((current) => ({ ...current, [user.id]: { ...edit, displayName: event.target.value } }))} /></label>
                          <label className={styles.compactField}>
                            <span>Username</span>
                            <input value={edit.username} onChange={(event) => { setEditDrafts((current) => ({ ...current, [user.id]: { ...edit, username: normalizeUsername(event.target.value) } })); setEditUsernameErrors((current) => ({ ...current, [user.id]: '' })); }} aria-invalid={Boolean(editUsernameErrors[user.id])} />
                            {editUsernameErrors[user.id] ? <small className={styles.fieldError} role="alert">{editUsernameErrors[user.id]}</small> : null}
                          </label>
                          <label className={styles.compactField}><span>Access</span><select value={edit.accessRole} onChange={(event) => setEditDrafts((current) => ({ ...current, [user.id]: { ...edit, accessRole: event.target.value as OwnerAppUser['accessRole'] } }))}>{ACCESS_ROLES.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}</select></label>
                          <div className={styles.compactField}>
                            <label className={styles.fieldLabel} htmlFor={`owner-app-password-${user.id}`}>New passcode</label>
                            <div className={styles.passwordInputWrap}>
                              <input id={`owner-app-password-${user.id}`} type={visiblePasswords[user.id] ? 'text' : 'password'} value={edit.password} onChange={(event) => setEditDrafts((current) => ({ ...current, [user.id]: { ...edit, password: normalizePasscode(event.target.value) } }))} placeholder="Leave blank to keep current passcode" minLength={4} maxLength={64} />
                              <button type="button" className={styles.passwordToggleButton} onClick={() => setVisiblePasswords((current) => ({ ...current, [user.id]: !current[user.id] }))}>{visiblePasswords[user.id] ? 'Hide' : 'Show'}</button>
                            </div>
                          </div>
                          <div className={styles.managerActions}>
                            <button type="submit" className={styles.secondaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
                            <button type="button" className={user.isActive ? styles.dangerButton : styles.primaryButton} disabled={busy} onClick={() => void patchUser(user, { isActive: !user.isActive }, user.isActive ? 'Owner App user deactivated and sessions revoked.' : 'Owner App user activated.')}>{user.isActive ? 'Deactivate' : 'Activate'}</button>
                            <button type="button" className={styles.deleteButton} disabled={busy} onClick={() => void deleteUser(user)}>Delete</button>
                          </div>
                        </form>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
