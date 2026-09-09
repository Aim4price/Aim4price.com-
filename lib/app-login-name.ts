/** Shared, non-secret account and person identifiers. */
export function suggestAppAccountName(name: string): string {
  const first = name.trim().split(/\s+/)[0] || 'account';
  return first.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'account';
}

export function validateAppAccountName(value: unknown): string {
  const name = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(name)) {
    throw new Error('Enter a business login name of 3–32 letters, numbers or hyphens.');
  }
  return name;
}

export function accountAppUsername(value: unknown, accountName: string): string {
  const input = String(value ?? '').trim().toLowerCase();
  const parts = input.split('@');
  if (parts.length > 2 || (parts.length === 2 && parts[1] !== accountName)) {
    throw new Error(`Use your account suffix @${accountName}.`);
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(parts[0])) {
    throw new Error('Enter a username of 3–32 letters, numbers, dots, hyphens or underscores.');
  }
  return `${parts[0]}@${accountName}`;
}

/** Do not silently remove mistyped characters and match a different login. */
export function normalizeAppLogin(value: unknown): string {
  const input = String(value ?? '').trim().toLowerCase();
  return /^[a-z0-9._@-]{3,80}$/.test(input) ? input : '';
}
