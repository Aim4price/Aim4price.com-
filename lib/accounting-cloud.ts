export const names = {intacct:'Sage Intacct',xero:'Xero', quickbooks:'QuickBooks Online', zoho:'Zoho Books'} as const;
export type Provider = keyof typeof names;
export function isProvider(value: string): value is Provider {
  return Object.prototype.hasOwnProperty.call(names, value);
}
export type Config = {provider: Provider; origin: string; key: Buffer; clientId: string; secret: string; sandbox: boolean};
export type Grant = {access: string; refresh: string; expires: number; realm: string; dc: string};
export type Company = {id: string; name: string};
export type BillLine = {invoice: string; supplier: string; description: string; amount: number | null; currency: string; billKey?: string; lineKey?: string; date?: string; grossZar?: number; vatZar?: number};
const dcs: Record<string,string> = {us:'com',eu:'eu',in:'in',au:'com.au',ca:'ca',jp:'jp',sa:'sa'};
const zohoDomain = (dc: string) => {
  if (!Object.hasOwn(dcs,dc)) throw new Error('Unsupported Zoho data centre.');
  return dcs[dc];
};
export const cloudPath = (p: Provider) => '/my-invoices/accounting/' + p;
export const callback = (c: Config) => c.origin + '/api/accounting/' + c.provider + '/callback';
export function cloudConfig(p: Provider): Config | null {
  const prefix = p.toUpperCase();
  const clientId = process.env[prefix+'_CLIENT_ID'];
  const secret = process.env[prefix+'_CLIENT_SECRET'];
  const origin = process.env.ACCOUNTING_APP_ORIGIN || process.env.SAGE_ZA_APP_ORIGIN || '';
  const key = Buffer.from(process.env.ACCOUNTING_ENCRYPTION_KEY || process.env.SAGE_ZA_ENCRYPTION_KEY || '', 'base64');
  if (!clientId || !secret || !URL.canParse(origin) || new URL(origin).origin !== origin || !origin.startsWith('https://') || key.length !== 32) return null;
  return {provider:p, clientId, secret, origin, key, sandbox:process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox'};
}

export function authorize(c: Config, state: string) {
  const endpoints = {intacct:'https://api.intacct.com/ia/api/v1/oauth2/authorize',xero:'https://login.xero.com/identity/connect/authorize',quickbooks:'https://appcenter.intuit.com/connect/oauth2',zoho:'https://accounts.zoho.com/oauth/v2/auth'};
  const scopes = {intacct:'offline_access',xero:'accounting.invoices.read offline_access',quickbooks:'com.intuit.quickbooks.accounting',zoho:'ZohoBooks.settings.READ,ZohoBooks.bills.READ'};
  const url = new URL(endpoints[c.provider]);
  url.search = new URLSearchParams({response_type:'code',client_id:c.clientId,redirect_uri:callback(c),scope:scopes[c.provider],state}).toString();
  if (c.provider==='zoho') {
    url.searchParams.set('access_type','offline');
    url.searchParams.set('prompt','consent');
  }
  return url.href;
}

async function json(url: string | URL, init: RequestInit) {
  const res = await fetch(url,{...init,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  if (!res.ok) throw new Error('Accounting provider request failed.');
  return res.json();
}

export async function exchange(c: Config, input: {code:string} | {refresh_token:string}, realm: string, dc: string): Promise<Grant> {
  const headers: Record<string,string> = {Accept:'application/json'};
  const body = new URLSearchParams(input);
  body.set('grant_type','code' in input ? 'authorization_code' : 'refresh_token');
  if ('code' in input) body.set('redirect_uri',callback(c));
  let endpoint: string;
  if (c.provider==='intacct') {
    endpoint = 'https://api.intacct.com/ia/api/v1/oauth2/token';
    body.set('client_id',c.clientId);
    body.set('client_secret',c.secret);
    headers['Content-Type']='application/json';
  } else if (c.provider==='zoho') {
    endpoint = 'https://accounts.zoho.'+zohoDomain(dc)+'/oauth/v2/token';
    body.set('client_id',c.clientId);
    body.set('client_secret',c.secret);
  } else {
    endpoint = c.provider==='xero' ? 'https://identity.xero.com/connect/token' : 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    headers.Authorization = 'Basic '+Buffer.from(c.clientId+':'+c.secret).toString('base64');
  }
  if (c.provider==='quickbooks' && !/^\d{1,25}$/.test(realm)) throw new Error('Missing QuickBooks company.');
  const result = await json(endpoint,{method:'POST',headers,body:c.provider==='intacct'?JSON.stringify(Object.fromEntries(body)):body});
  const data = c.provider==='intacct' ? result['ia::result']??result : result;
  const refresh = data.refresh_token || ('refresh_token' in input && input.refresh_token);
  if (typeof data.access_token!=='string' || !data.access_token || typeof refresh!=='string' || !refresh || !(Number(data.expires_in)>0)) throw new Error('Incomplete authorisation.');
  return {access:data.access_token,refresh,expires:Date.now()+Number(data.expires_in)*1000,realm,dc};
}

function read(c: Config,g: Grant,url: URL|string,extra: Record<string,string>={}) {
  return json(url,{headers:{Accept:'application/json',Authorization:(c.provider==='zoho'?'Zoho-oauthtoken ':'Bearer ')+g.access,...extra}});
}
function qbBase(c: Config,g: Grant) {
  return 'https://'+(c.sandbox?'sandbox-':'')+'quickbooks.api.intuit.com/v3/company/'+encodeURIComponent(g.realm);
}
function zohoBase(g: Grant) { return 'https://www.zohoapis.'+zohoDomain(g.dc)+'/books/v3'; }
type RecordData = Record<string,any>;
function records(value: unknown): RecordData[] {
  if (!Array.isArray(value) || value.some(v=>!v || typeof v !== 'object')) throw new Error('Unexpected provider data.');
  return value;
}

async function intacctQuery(g:Grant, size:number) {
  const result=await json('https://api.intacct.com/ia/api/v1/services/core/query',{
    method:'POST', headers:{Authorization:'Bearer '+g.access,'Content-Type':'application/json'},
    body:JSON.stringify({object:'accounts-payable/bill',fields:['key'],orderBy:[{key:'desc'}],size})
  });
  return records(result['ia::result']);
}

export async function companies(c: Config,g: Grant): Promise<Company[]> {
  if (c.provider==='intacct') {
    // Consent binds the token to the company selected in Intacct. Verify AP read access.
    await intacctQuery(g,1);
    return [{id:'authorised-company',name:'Company authorised in Sage Intacct'}];
  }
  if (c.provider==='quickbooks') {
    const data = await read(c,g,qbBase(c,g)+'/companyinfo/'+encodeURIComponent(g.realm));
    if (!data.CompanyInfo?.CompanyName) throw new Error('Missing company.');
    return [{id:g.realm,name:data.CompanyInfo.CompanyName}];
  }
  if (c.provider==='zoho') {
    const data = await read(c,g,zohoBase(g)+'/organizations');
    return records(data.organizations).filter(o=>o.is_org_active!==false).map(o=>({id:o.organization_id,name:o.name}));
  }
  return records(await read(c,g,'https://api.xero.com/connections')).filter(t=>t.tenantType==='ORGANISATION').map(t=>({id:t.tenantId,name:t.tenantName}));
}

function billLine(invoice: unknown,supplier: unknown,description: unknown,amount: unknown,currency: unknown): BillLine {
  return {invoice:String(invoice??''),supplier:String(supplier??''),description:String(description??''),amount:typeof amount==='number' && Number.isFinite(amount)?amount:null,currency:String(currency??'')};
}

function identified(line: BillLine, bill: unknown, key: unknown, date: unknown, gross?: number, vat?: number): BillLine {
  if (bill == null || key == null || key === '') return line;
  const rawDate=String(date ?? '');
  const ms=/^\/Date\((\d+)/.exec(rawDate);
  const iso=ms && Number(ms[1]) < 8640000000000000 ? new Date(Number(ms[1])).toISOString() : rawDate;
  return {...line,billKey:String(bill),lineKey:String(key),date:iso.slice(0,10),
    vatZar:line.currency === 'ZAR' && Number.isFinite(vat) ? vat : undefined,
    grossZar:line.currency === 'ZAR' && typeof gross==='number' && Number.isFinite(gross) ? gross : undefined};
}

// Keep provider-reported line amounts in the source currency; tax basis varies by bill.
export async function latestBills(c:Config,g:Grant,id:string): Promise<BillLine[]> {
  if (c.provider==='intacct') {
    if (id!=='authorised-company') throw new Error('Invalid Intacct context.');
    const lines:BillLine[]=[];
    for (const record of await intacctQuery(g,10)) {
      const result=await read(c,g,'https://api.intacct.com/ia/api/v1/objects/accounts-payable/bill/'+encodeURIComponent(record.key));
      const bill=result['ia::result'];
      for (const line of records(bill.lines)) {
        const amount=line.txnAmount;
        lines.push(identified(billLine(bill.billNumber??bill.id,bill.vendor?.name,line.memo,
          typeof amount==='string' && amount.trim() ? Number(amount):amount,bill.currency?.txnCurrency),bill.key ?? record.key,line.key,bill.billDate));
      }
    }
    return lines;
  }
  if (c.provider==='quickbooks') {
    if (id!==g.realm) throw new Error('Company mismatch.');
    const url = new URL(qbBase(c,g)+'/query');
    url.searchParams.set('query','SELECT * FROM Bill ORDERBY TxnDate DESC MAXRESULTS 10');
    const data = await read(c,g,url);
    if (!data.QueryResponse) throw new Error('Missing bill response.');
    return records(data.QueryResponse.Bill??[]).flatMap(b=>records(b.Line).filter(l=>['AccountBasedExpenseLineDetail','ItemBasedExpenseLineDetail'].includes(l.DetailType))
      .map(l=>identified(billLine(b.DocNumber??b.Id,b.VendorRef?.name,l.Description,l.Amount,b.CurrencyRef?.value),b.Id,l.Id,b.TxnDate)));
  }
  if (c.provider==='xero') {
    const url = new URL('https://api.xero.com/api.xro/2.0/Invoices');
    url.search = new URLSearchParams({where:'Type=="ACCPAY"&&(Status=="AUTHORISED"||Status=="PAID")',order:'Date DESC',page:'1',pageSize:'10'}).toString();
    const data = await read(c,g,url,{'xero-tenant-id':id});
    return records(data.Invoices).flatMap(b=>records(b.LineItems).map(l=>identified(billLine(b.InvoiceNumber??b.InvoiceID,b.Contact?.Name,l.Description,l.LineAmount,b.CurrencyCode),
      b.InvoiceID,l.LineItemID,b.DateString ?? b.Date,
      b.LineAmountTypes==='Inclusive' || b.LineAmountTypes==='NoTax' ? l.LineAmount :
        b.LineAmountTypes==='Exclusive' && typeof l.TaxAmount==='number' ? l.LineAmount+l.TaxAmount : undefined,l.TaxAmount)));
  }
  const url = new URL(zohoBase(g)+'/bills');
  url.search = new URLSearchParams({organization_id:id,sort_column:'date',sort_order:'D',per_page:'10'}).toString();
  const summary = await read(c,g,url);
  const lines: BillLine[] = [];
  for (const b of records(summary.bills).slice(0,10)) {
    const detail = new URL(zohoBase(g)+'/bills/'+encodeURIComponent(b.bill_id));
    detail.searchParams.set('organization_id',id);
    const {bill} = await read(c,g,detail);
    for (const l of records(bill.line_items)) lines.push(identified(billLine(bill.bill_number??bill.bill_id,bill.vendor_name,l.description,l.item_total,bill.currency_code),bill.bill_id,l.line_item_id,bill.date));
  }
  return lines;
}
