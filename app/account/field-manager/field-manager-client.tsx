'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppHeader from '../../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';

type FieldManagerRecord = {
  id: string;
  ownerUserId: string;
  displayName: string;
  username: string;
  isActive: boolean;
  status: 'active' | 'inactive';
  lastLoginAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type FieldManagerApiResponse = {
  ok: boolean;
  managers?: FieldManagerRecord[];
  manager?: FieldManagerRecord;
  error?: string;
};

type DraftState = {
  displayName: string;
  username: string;
  password: string;
};

type EditDraftState = {
  displayName: string;
  username: string;
  password: string;
};

const initialDraft: DraftState = {
  displayName: '',
  username: '',
  password: '',
};

function extractError(payload: FieldManagerApiResponse | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not yet';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not yet';

  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._@-]/g, '')
    .slice(0, 80);
}

function getFieldManagerLoginLink(): string {
  if (typeof window === 'undefined') return '/field-manager/login';
  return `${window.location.origin}/field-manager/login`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function FieldManagerOwnerClient() {
  const [managers, setManagers] = useState<FieldManagerRecord[]>([]);
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraftState>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [savingManagerId, setSavingManagerId] = useState<string | null>(null);
  const [deletingManagerId, setDeletingManagerId] = useState<string | null>(null);
  const [expandedManagerId, setExpandedManagerId] = useState<string | null>(null);

  const loginLink = useMemo(() => getFieldManagerLoginLink(), []);
  const shareText = useMemo(() => `Open Field Manager for Aim4price here: ${loginLink}`, [loginLink]);

  useEffect(() => {
    void loadManagers();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadManagers() {
    setIsLoading(true);

    try {
      const response = await fetch('/api/field-managers', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as FieldManagerApiResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(extractError(payload, 'Failed to load Field Manager logins.'));
      }

      const nextManagers = payload.managers ?? [];
      setManagers(nextManagers);
      setEditDrafts((current) => {
        const next: Record<string, EditDraftState> = {};
        nextManagers.forEach((manager) => {
          next[manager.id] = current[manager.id] ?? {
            displayName: manager.displayName,
            username: manager.username,
            password: '',
          };
        });
        return next;
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to load Field Manager logins.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.displayName.trim()) {
      setNotice({ tone: 'error', message: 'Enter the manager display name.' });
      return;
    }

    if (draft.username.trim().length < 3) {
      setNotice({ tone: 'error', message: 'Enter a username with at least 3 characters.' });
      return;
    }

    if (draft.password.length < 8) {
      setNotice({ tone: 'error', message: 'Enter a password with at least 8 characters.' });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/field-managers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: draft.displayName.trim(),
          username: normalizeUsername(draft.username),
          password: draft.password,
        }),
      });
      const payload = (await response.json().catch(() => null)) as FieldManagerApiResponse | null;

      if (!response.ok || !payload?.ok || !payload.manager) {
        throw new Error(extractError(payload, 'Failed to create Field Manager login.'));
      }

      setManagers((current) => [payload.manager as FieldManagerRecord, ...current]);
      setEditDrafts((current) => ({
        ...current,
        [payload.manager!.id]: {
          displayName: payload.manager!.displayName,
          username: payload.manager!.username,
          password: '',
        },
      }));
      setDraft(initialDraft);
      setNotice({ tone: 'success', message: 'Field Manager login created.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to create Field Manager login.',
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function patchManager(managerId: string, body: Record<string, unknown>, successMessage: string) {
    setSavingManagerId(managerId);

    try {
      const response = await fetch(`/api/field-managers/${encodeURIComponent(managerId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as FieldManagerApiResponse | null;

      if (!response.ok || !payload?.ok || !payload.manager) {
        throw new Error(extractError(payload, 'Failed to update Field Manager login.'));
      }

      setManagers((current) => current.map((manager) => (manager.id === managerId ? payload.manager! : manager)));
      setEditDrafts((current) => ({
        ...current,
        [managerId]: {
          displayName: payload.manager!.displayName,
          username: payload.manager!.username,
          password: '',
        },
      }));
      setNotice({ tone: 'success', message: successMessage });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to update Field Manager login.',
      });
    } finally {
      setSavingManagerId(null);
    }
  }

  function updateEditDraft(managerId: string, updates: Partial<EditDraftState>) {
    setEditDrafts((current) => ({
      ...current,
      [managerId]: {
        ...(current[managerId] ?? { displayName: '', username: '', password: '' }),
        ...updates,
      },
    }));
  }

  async function handleSaveManager(event: FormEvent<HTMLFormElement>, manager: FieldManagerRecord) {
    event.preventDefault();
    const editDraft = editDrafts[manager.id];

    if (!editDraft) return;

    const body: Record<string, unknown> = {
      displayName: editDraft.displayName.trim(),
      username: normalizeUsername(editDraft.username),
    };

    if (editDraft.password.trim()) {
      body.password = editDraft.password;
    }

    await patchManager(manager.id, body, 'Field Manager login updated.');
  }

  async function handleToggleManager(manager: FieldManagerRecord) {
    await patchManager(
      manager.id,
      { isActive: !manager.isActive },
      manager.isActive ? 'Field Manager login deactivated.' : 'Field Manager login activated.',
    );
  }

  async function handleDeleteManager(manager: FieldManagerRecord) {
    const confirmed = window.confirm(
      `Delete Field Manager login for ${manager.displayName}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingManagerId(manager.id);

    try {
      const response = await fetch(`/api/field-managers/${encodeURIComponent(manager.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as FieldManagerApiResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(extractError(payload, 'Failed to delete Field Manager login.'));
      }

      setManagers((current) => current.filter((existingManager) => existingManager.id !== manager.id));
      setEditDrafts((current) => {
        const { [manager.id]: _removedManager, ...remainingDrafts } = current;
        return remainingDrafts;
      });
      setExpandedManagerId((current) => (current === manager.id ? null : current));
      setNotice({ tone: 'success', message: 'Field Manager login deleted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete Field Manager login.',
      });
    } finally {
      setDeletingManagerId(null);
    }
  }

  async function handleCopyLink() {
    const copied = await copyToClipboard(loginLink);
    setNotice({
      tone: copied ? 'success' : 'error',
      message: copied ? 'Field Manager login link copied.' : 'Copy failed. Use the link shown on this page.',
    });
  }

  async function handleShareLink() {
    const sharePayload = {
      title: 'Aim4price Field Manager',
      text: shareText,
      url: loginLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(sharePayload);
        return;
      } catch {
        // Fall back to clipboard below when sharing is cancelled or unavailable.
      }
    }

    await handleCopyLink();
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={() => window.location.assign('/account')}>
          ← Back to account
        </button>

        <section className={styles.heroCard}>
          <div className={styles.heroCopy}>
            <h1>Field Manager</h1>
            <p>
              Create mobile-only access for managers who need to update machinery in the field without entering the
              full Aim4price account area.
            </p>
          </div>

          <div className={styles.linkPanel}>
            <div className={styles.linkPanelHeader}>
              <h2>Manager login link</h2>
              <p>Send this link to approved managers after creating their login details.</p>
            </div>
            <code>{loginLink}</code>
            <div className={styles.shareRow}>
              <button type="button" className={styles.secondaryButton} onClick={handleCopyLink}>
                Copy link
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleShareLink}>
                Share link
              </button>
            </div>
          </div>
        </section>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <section className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>New Field Manager login</h2>
              <p>Create a dedicated username and password for one field manager.</p>
            </div>

            <form className={styles.form} onSubmit={handleCreateManager}>
              <label className={styles.field}>
                <span>Manager display name</span>
                <input
                  value={draft.displayName}
                  onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="Example: Piet Field Manager"
                  autoComplete="off"
                />
              </label>

              <label className={styles.field}>
                <span>Username</span>
                <input
                  value={draft.username}
                  onChange={(event) => setDraft((current) => ({ ...current, username: normalizeUsername(event.target.value) }))}
                  placeholder="example: piet.manager"
                  autoComplete="off"
                />
              </label>

              <label className={styles.field}>
                <span>Password</span>
                <input
                  type="password"
                  value={draft.password}
                  onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                />
              </label>

              <button type="submit" className={styles.primaryButton} disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create login'}
              </button>
            </form>
          </section>

          <section className={`${styles.card} ${styles.managerListCard}`}>
            <div className={styles.cardHeader}>
              <h2>Field Manager logins</h2>
              <p>Manage details, reset passwords, deactivate or delete manager access.</p>
            </div>

            {isLoading ? <p className={styles.emptyState}>Loading Field Manager logins…</p> : null}

            {!isLoading && !managers.length ? (
              <p className={styles.emptyState}>No Field Manager logins created yet.</p>
            ) : null}

            <div className={styles.managerList}>
              {managers.map((manager) => {
                const editDraft = editDrafts[manager.id] ?? {
                  displayName: manager.displayName,
                  username: manager.username,
                  password: '',
                };
                const isExpanded = expandedManagerId === manager.id;
                const isSavingThisManager = savingManagerId === manager.id;
                const isDeletingThisManager = deletingManagerId === manager.id;
                const isBusyThisManager = isSavingThisManager || isDeletingThisManager;
                const managerPanelId = `field-manager-panel-${manager.id}`;

                return (
                  <article
                    key={manager.id}
                    className={`${styles.managerCard} ${isExpanded ? styles.managerCardExpanded : ''}`}
                  >
                    <div className={styles.managerSummary}>
                      <div className={styles.managerIdentity}>
                        <strong>{manager.displayName}</strong>
                        <span>{manager.username}</span>
                      </div>

                      <div className={styles.managerSummaryMeta} aria-label="Field Manager dates">
                        <span>
                          <b>Last login</b>
                          {formatDateTime(manager.lastLoginAtIso)}
                        </span>
                        <span>
                          <b>Updated</b>
                          {formatDateTime(manager.updatedAtIso)}
                        </span>
                      </div>

                      <span className={`${styles.statusText} ${manager.isActive ? styles.statusActive : styles.statusInactive}`}>
                        {manager.isActive ? 'Active' : 'Inactive'}
                      </span>

                      <button
                        type="button"
                        className={styles.manageButton}
                        onClick={() => setExpandedManagerId((current) => (current === manager.id ? null : manager.id))}
                        aria-expanded={isExpanded}
                        aria-controls={managerPanelId}
                      >
                        {isExpanded ? 'Close' : 'Manage'}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div id={managerPanelId} className={styles.managerDropdown}>
                        <form className={styles.inlineForm} onSubmit={(event) => void handleSaveManager(event, manager)}>
                          <label className={styles.compactField}>
                            <span>Display name</span>
                            <input
                              value={editDraft.displayName}
                              onChange={(event) => updateEditDraft(manager.id, { displayName: event.target.value })}
                            />
                          </label>

                          <label className={styles.compactField}>
                            <span>Username</span>
                            <input
                              value={editDraft.username}
                              onChange={(event) =>
                                updateEditDraft(manager.id, { username: normalizeUsername(event.target.value) })
                              }
                            />
                          </label>

                          <label className={styles.compactField}>
                            <span>New password</span>
                            <input
                              type="password"
                              value={editDraft.password}
                              onChange={(event) => updateEditDraft(manager.id, { password: event.target.value })}
                              placeholder="Leave blank to keep current"
                              autoComplete="new-password"
                            />
                          </label>

                          <div className={styles.managerActions}>
                            <button type="submit" className={styles.secondaryButton} disabled={isBusyThisManager}>
                              {isSavingThisManager ? 'Saving…' : 'Save changes'}
                            </button>
                            <button
                              type="button"
                              className={manager.isActive ? styles.dangerButton : styles.primaryButton}
                              onClick={() => void handleToggleManager(manager)}
                              disabled={isBusyThisManager}
                            >
                              {manager.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              onClick={() => void handleDeleteManager(manager)}
                              disabled={isBusyThisManager}
                            >
                              {isDeletingThisManager ? 'Deleting…' : 'Delete'}
                            </button>
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
