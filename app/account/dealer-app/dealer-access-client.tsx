'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppHeader from '../../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';
type DealerStaffRole = 'owner' | 'sales' | 'parts' | 'technician';

type FieldManagerRecord = {
  id: string;
  displayName: string;
  username: string;
  role: DealerStaffRole;
  isActive: boolean;
  lastLoginAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type FieldManagerApiResponse = {
  ok: boolean;
  staff?: FieldManagerRecord[] | FieldManagerRecord;
  error?: string;
};

type DraftState = {
  displayName: string;
  username: string;
  password: string;
  role: DealerStaffRole;
};

type EditDraftState = {
  displayName: string;
  username: string;
  password: string;
  role: DealerStaffRole;
};

const initialDraft: DraftState = {
  displayName: '',
  username: '',
  password: '',
  role: 'technician',
};

const ROLE_OPTIONS: Array<{ value: DealerStaffRole; label: string; description: string }> = [
  { value: 'owner', label: 'Owner / Manager', description: 'Full access and problem assignment.' },
  { value: 'sales', label: 'Sales', description: 'All tools except Client Costs.' },
  { value: 'parts', label: 'Parts', description: 'No Marketplace or Get Estimate.' },
  { value: 'technician', label: 'Technician', description: 'Overview and Maintenance only.' },
];

function roleLabel(role: DealerStaffRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? 'Technician';
}

function RoleSelect({
  value,
  onChange,
}: {
  value: DealerStaffRole;
  onChange: (role: DealerStaffRole) => void;
}) {
  return (
    <div className={styles.roleSelectWrap}>
      <select value={value} onChange={(event) => onChange(event.target.value as DealerStaffRole)}>
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <span className={styles.roleSelectChevron} aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

const DEALER_STAFF_PASSWORD_MIN_LENGTH = 8;

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

function getDealerLoginLink(): string {
  if (typeof window === 'undefined') return '/dealer/login';
  return `${window.location.origin}/dealer/login`;
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

export default function DealerAccessClient() {
  const [managers, setManagers] = useState<FieldManagerRecord[]>([]);
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraftState>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [savingManagerId, setSavingManagerId] = useState<string | null>(null);
  const [deletingManagerId, setDeletingManagerId] = useState<string | null>(null);
  const [expandedManagerId, setExpandedManagerId] = useState<string | null>(null);
  const [isCreatePasswordVisible, setIsCreatePasswordVisible] = useState(false);
  const [visibleEditPasswordIds, setVisibleEditPasswordIds] = useState<Record<string, boolean>>({});

  const loginLink = useMemo(() => getDealerLoginLink(), []);
  const shareText = useMemo(() => `Open the Aim4price Dealer App here: ${loginLink}`, [loginLink]);

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
      const response = await fetch('/api/dealer/staff', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as FieldManagerApiResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(extractError(payload, 'Failed to load Dealer App staff logins.'));
      }

      const nextManagers = Array.isArray(payload.staff) ? payload.staff : [];
      setManagers(nextManagers);
      setEditDrafts((current) => {
        const next: Record<string, EditDraftState> = {};
        nextManagers.forEach((manager) => {
          next[manager.id] = current[manager.id] ?? {
            displayName: manager.displayName,
            username: manager.username,
            password: '',
            role: manager.role,
          };
        });
        return next;
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to load Dealer App staff logins.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.displayName.trim()) {
      setNotice({ tone: 'error', message: 'Enter the staff member display name.' });
      return;
    }

    if (draft.username.trim().length < 3) {
      setNotice({ tone: 'error', message: 'Enter a username with at least 3 characters.' });
      return;
    }

    if (draft.password.length < DEALER_STAFF_PASSWORD_MIN_LENGTH) {
      setNotice({
        tone: 'error',
        message: `Enter a password with at least ${DEALER_STAFF_PASSWORD_MIN_LENGTH} characters.`,
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/dealer/staff', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: draft.displayName.trim(),
          username: normalizeUsername(draft.username),
          password: draft.password,
          role: draft.role,
        }),
      });
      const payload = (await response.json().catch(() => null)) as FieldManagerApiResponse | null;

      const createdStaff = payload?.staff && !Array.isArray(payload.staff) ? payload.staff : null;
      if (!response.ok || !payload?.ok || !createdStaff) {
        throw new Error(extractError(payload, 'Failed to create Dealer App staff login.'));
      }

      setManagers((current) => [createdStaff, ...current]);
      setEditDrafts((current) => ({
        ...current,
        [createdStaff.id]: {
          displayName: createdStaff.displayName,
          username: createdStaff.username,
          password: '',
          role: createdStaff.role,
        },
      }));
      setDraft(initialDraft);
      setIsCreatePasswordVisible(false);
      setNotice({ tone: 'success', message: 'Dealer App staff login created.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to create Dealer App staff login.',
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function patchManager(managerId: string, body: Record<string, unknown>, successMessage: string) {
    setSavingManagerId(managerId);

    try {
      const response = await fetch(`/api/dealer/staff/${encodeURIComponent(managerId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as FieldManagerApiResponse | null;

      const updatedStaff = payload?.staff && !Array.isArray(payload.staff) ? payload.staff : null;
      if (!response.ok || !payload?.ok || !updatedStaff) {
        throw new Error(extractError(payload, 'Failed to update Dealer App staff login.'));
      }

      setManagers((current) => current.map((manager) => (manager.id === managerId ? updatedStaff : manager)));
      setEditDrafts((current) => ({
        ...current,
        [managerId]: {
          displayName: updatedStaff.displayName,
          username: updatedStaff.username,
          password: '',
          role: updatedStaff.role,
        },
      }));
      setVisibleEditPasswordIds((current) => ({ ...current, [managerId]: false }));
      setNotice({ tone: 'success', message: successMessage });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to update Dealer App staff login.',
      });
    } finally {
      setSavingManagerId(null);
    }
  }

  function updateEditDraft(managerId: string, updates: Partial<EditDraftState>) {
    setEditDrafts((current) => ({
      ...current,
      [managerId]: {
        ...(current[managerId] ?? { displayName: '', username: '', password: '', role: 'technician' }),
        ...updates,
      },
    }));
  }

  function toggleEditPasswordVisibility(managerId: string) {
    setVisibleEditPasswordIds((current) => ({
      ...current,
      [managerId]: !current[managerId],
    }));
  }

  async function handleSaveManager(event: FormEvent<HTMLFormElement>, manager: FieldManagerRecord) {
    event.preventDefault();
    const editDraft = editDrafts[manager.id];

    if (!editDraft) return;

    const body: Record<string, unknown> = {
      displayName: editDraft.displayName.trim(),
      username: normalizeUsername(editDraft.username),
      role: editDraft.role,
    };

    if (editDraft.password.trim()) {
      if (editDraft.password.length < DEALER_STAFF_PASSWORD_MIN_LENGTH) {
        setNotice({
          tone: 'error',
          message: `Enter a password with at least ${DEALER_STAFF_PASSWORD_MIN_LENGTH} characters.`,
        });
        return;
      }

      body.password = editDraft.password;
    }

    await patchManager(manager.id, body, 'Dealer App staff login updated.');
  }

  async function handleToggleManager(manager: FieldManagerRecord) {
    await patchManager(
      manager.id,
      { isActive: !manager.isActive },
      manager.isActive ? 'Dealer App staff login deactivated.' : 'Dealer App staff login activated.',
    );
  }

  async function handleDeleteManager(manager: FieldManagerRecord) {
    const confirmed = window.confirm(
      `Delete Dealer App staff login for ${manager.displayName}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingManagerId(manager.id);

    try {
      const response = await fetch(`/api/dealer/staff/${encodeURIComponent(manager.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as FieldManagerApiResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(extractError(payload, 'Failed to delete Dealer App staff login.'));
      }

      setManagers((current) => current.filter((existingManager) => existingManager.id !== manager.id));
      setEditDrafts((current) => {
        const { [manager.id]: _removedManager, ...remainingDrafts } = current;
        return remainingDrafts;
      });
      setVisibleEditPasswordIds((current) => {
        const { [manager.id]: _removedManager, ...remainingVisibility } = current;
        return remainingVisibility;
      });
      setExpandedManagerId((current) => (current === manager.id ? null : current));
      setNotice({ tone: 'success', message: 'Dealer App staff login deleted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete Dealer App staff login.',
      });
    } finally {
      setDeletingManagerId(null);
    }
  }

  async function handleCopyLink() {
    const copied = await copyToClipboard(loginLink);
    setNotice({
      tone: copied ? 'success' : 'error',
      message: copied ? 'Dealer App login link copied.' : 'Copy failed. Use the link shown on this page.',
    });
  }

  async function handleShareLink() {
    const sharePayload = {
      title: 'Aim4price Dealer App',
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
            <h1>Dealer App Staff</h1>
            <p>
              Create one role-based login for every Owner, Sales, Parts or Technician staff member.
            </p>
          </div>

          <div className={styles.linkPanel}>
            <div className={styles.linkPanelHeader}>
              <h2>Staff login link</h2>
              <p>Send this link to approved staff after creating their login details.</p>
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
          <section className={`${styles.card} ${expandedManagerId ? styles.focusMuted : ''}`}>
            <div className={styles.cardHeader}>
              <h2>New Dealer App login</h2>
              <p>Create a dedicated username and password for one staff member.</p>
            </div>

            <form className={styles.form} onSubmit={handleCreateManager}>
              <label className={styles.field}>
                <span>Staff member name</span>
                <input
                  value={draft.displayName}
                  onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="Example: Sales Manager"
                  autoComplete="off"
                />
              </label>

              <label className={styles.field}>
                <span>Username</span>
                <input
                  value={draft.username}
                  onChange={(event) => setDraft((current) => ({ ...current, username: normalizeUsername(event.target.value) }))}
                  placeholder="example: sales.manager"
                  autoComplete="off"
                />
              </label>

              <label className={styles.field}>
                <span>Role</span>
                <RoleSelect
                  value={draft.role}
                  onChange={(role) => setDraft((current) => ({ ...current, role }))}
                />
              </label>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="dealer-staff-create-password">
                  Password
                </label>
                <div className={styles.passwordInputWrap}>
                  <input
                    id="dealer-staff-create-password"
                    type={isCreatePasswordVisible ? 'text' : 'password'}
                    value={draft.password}
                    onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
                    placeholder={`Minimum ${DEALER_STAFF_PASSWORD_MIN_LENGTH} characters`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.passwordToggleButton}
                    onClick={() => setIsCreatePasswordVisible((current) => !current)}
                    aria-label={isCreatePasswordVisible ? 'Hide Dealer App password' : 'Show Dealer App password'}
                    aria-pressed={isCreatePasswordVisible}
                  >
                    {isCreatePasswordVisible ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" className={styles.primaryButton} disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create login'}
              </button>
            </form>
          </section>

          <section className={`${styles.card} ${styles.managerListCard}`}>
            <div className={styles.cardHeader}>
              <h2>Dealer App staff logins</h2>
              <p>Manage details, reset passwords, deactivate or delete staff access.</p>
            </div>

            {isLoading ? <p className={styles.emptyState}>Loading Dealer App staff logins…</p> : null}

            {!isLoading && !managers.length ? (
              <p className={styles.emptyState}>No Dealer App staff logins created yet.</p>
            ) : null}

            <div className={styles.managerList}>
              {managers.map((manager) => {
                const editDraft = editDrafts[manager.id] ?? {
                  displayName: manager.displayName,
                  username: manager.username,
                  password: '',
                  role: manager.role,
                };
                const isExpanded = expandedManagerId === manager.id;
                const isSavingThisManager = savingManagerId === manager.id;
                const isDeletingThisManager = deletingManagerId === manager.id;
                const isBusyThisManager = isSavingThisManager || isDeletingThisManager;
                const managerPanelId = `dealer-staff-panel-${manager.id}`;
                const passwordInputId = `dealer-staff-password-${manager.id}`;
                const isEditPasswordVisible = Boolean(visibleEditPasswordIds[manager.id]);

                return (
                  <article
                    key={manager.id}
                    className={`${styles.managerCard} ${isExpanded ? styles.managerCardExpanded : ''} ${expandedManagerId && !isExpanded ? styles.managerCardMuted : ''}`}
                  >
                    <div className={styles.managerSummary}>
                      <div className={styles.managerIdentity}>
                        <strong>{manager.displayName}</strong>
                        <span>{manager.username}</span>
                        <small className={styles.rolePill}>{roleLabel(manager.role)}</small>
                      </div>

                      <div className={styles.managerSummaryMeta} aria-label="Dealer App staff dates">
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

                      {!isExpanded ? (
                        <button
                          type="button"
                          className={styles.manageButton}
                          onClick={() => setExpandedManagerId(manager.id)}
                          aria-expanded="false"
                          aria-controls={managerPanelId}
                          aria-label={`Manage ${manager.displayName}`}
                        >
                          Manage <span aria-hidden="true">›</span>
                        </button>
                      ) : null}
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
                            <span>Role</span>
                            <RoleSelect
                              value={editDraft.role}
                              onChange={(role) => updateEditDraft(manager.id, { role })}
                            />
                          </label>

                          <div className={styles.compactField}>
                            <label className={styles.fieldLabel} htmlFor={passwordInputId}>
                              Password
                            </label>
                            <div className={styles.passwordInputWrap}>
                              <input
                                id={passwordInputId}
                                type={isEditPasswordVisible ? 'text' : 'password'}
                                value={editDraft.password}
                                onChange={(event) => updateEditDraft(manager.id, { password: event.target.value })}
                                placeholder="Enter a new password to reset it"
                                autoComplete="off"
                              />
                              <button
                                type="button"
                                className={styles.passwordToggleButton}
                                onClick={() => toggleEditPasswordVisibility(manager.id)}
                                aria-label={isEditPasswordVisible ? 'Hide new Dealer App password' : 'Show new Dealer App password'}
                                aria-pressed={isEditPasswordVisible}
                              >
                                {isEditPasswordVisible ? 'Hide' : 'Show'}
                              </button>
                            </div>
                            <p className={styles.fieldHint}>Leave blank to keep the current password.</p>
                          </div>

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
                            <button
                              type="button"
                              className={styles.manageCloseButton}
                              onClick={() => setExpandedManagerId(null)}
                              disabled={isBusyThisManager}
                            >
                              Close
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
