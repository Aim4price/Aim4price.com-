import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const sagePage = '/my-invoices/sage-za';
export const callbackPath = '/api/accounting/sage-za/callback';

export function sageConfig() {
  const clientId = process.env.SAGE_ZA_CLIENT_ID;
  const secret = process.env.SAGE_ZA_CLIENT_SECRET;
  const apiKey = process.env.SAGE_ZA_API_KEY;
  const origin = process.env.SAGE_ZA_APP_ORIGIN;
  const key = Buffer.from(process.env.SAGE_ZA_ENCRYPTION_KEY || '', 'base64');
  if (!clientId || !secret || !apiKey || !origin || key.length !== 32) return null;
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) return null;
  return { clientId, secret, apiKey, key, origin };
}

export type SageConfig = NonNullable<ReturnType<typeof sageConfig>>;

export function seal(value: string, purpose: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}

export function unseal(value: string, purpose: string, key: Buffer) {
  const [iv, tag, data] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(purpose));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}

export function sageAuthorize(config: SageConfig, state: string) {
  const url = new URL('https://id.sage.com/authorize');
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.origin + callbackPath, response_type: 'code',
    audience: 'sbca-za-prd/PUBLIC-API', scope: 'openid offline_access', state,
  }).toString();
  return url.href;
}

export async function sageTokens(config: SageConfig, grant: {code: string} | {refresh_token: string}) {
  const response = await fetch('https://id.sage.com/oauth/token', {
    method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
    body: new URLSearchParams({client_id: config.clientId, client_secret: config.secret,
      ...('code' in grant ? {grant_type: 'authorization_code', redirect_uri: config.origin + callbackPath} : {grant_type: 'refresh_token'}),
      ...grant}),
  });
  if (!response.ok) throw new Error('Sage sign-in needs attention. Reconnect and try again.');
  const data = await response.json();
  const refresh = data.refresh_token || ('refresh_token' in grant && grant.refresh_token);
  if (typeof data.access_token !== 'string' || typeof refresh !== 'string' || !refresh) throw new Error('Incomplete Sage authorisation.');
  return {access: data.access_token as string, refresh, expires: Date.now() + Math.max(0, Number(data.expires_in) || 0) * 1000};
}

export async function sageRead(config: SageConfig, access: string, path: 'Company/Get' | 'SupplierInvoice/Get', company?: number, skip = 0) {
  const url = new URL(path, 'https://accounting.sageone.co.za/api/2.0.0/');
  url.searchParams.set('apikey', config.apiKey);
  url.searchParams.set('$skip', String(skip));
  url.searchParams.set('$top', path === 'Company/Get' ? '100' : '10');
  if (path === 'SupplierInvoice/Get') {
    if (!Number.isSafeInteger(company) || Number(company) <= 0) throw new Error('Choose a Sage company.');
    url.searchParams.set('CompanyId', String(company));
    url.searchParams.set('includeDetail', 'true');
    url.searchParams.set('$orderby', 'Date desc,ID desc');
  }
  const response = await fetch(url, {headers: {Authorization: 'Bearer ' + access, Accept: 'application/json'},
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Sage data is unavailable.');
  const result = await response.json();
  if (!Array.isArray(result.Results) || !Number.isSafeInteger(result.TotalResults)) throw new Error('Unexpected Sage response.');
  return { rows: result.Results as Record<string, unknown>[], total: Number(result.TotalResults) };
}

export async function sageCompanies(config: SageConfig, access: string) {
  const companies: {id: number; name: string}[] = [];
  let offset = 0;
  do {
    const { rows, total } = await sageRead(config, access, 'Company/Get', undefined, offset);
    for (const row of rows) {
      if (typeof row.ID === 'number' && Number.isSafeInteger(row.ID) && typeof row.Name === 'string') companies.push({id: row.ID, name: row.Name});
    }
    offset += rows.length;
    if (offset >= total) return companies;
    if (!rows.length) throw new Error('Incomplete company list.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (true);
}

export { assetForLine as assetForSageLine } from './accounting-serial.ts';
