import { isMiddlemanAccountSubtype } from './middleman-account';

export type WorkspaceRole = 'owner' | 'business' | 'middleman';

export function workspaceRole(accountType?: string | null, subtype?: string | null, plan?: string | null): WorkspaceRole | null {
  if (plan === 'free' || accountType === 'business') return 'business';
  if (accountType === 'owner') return 'owner';
  if (accountType === 'dealer') return isMiddlemanAccountSubtype(subtype) ? 'middleman' : 'business';
  return null;
}

export function receivedAssetsHref(accountType?: string | null, plan?: string | null) {
  if (accountType === 'business') return '/business';
  return plan === 'free' ? '/shared-enquiries' : '/leads';
}

export function workspaceHeader(role: WorkspaceRole, receivedHref: string) {
  const primary = {
    owner: {key:'asset-register', href:'/asset-register', label:'Asset Register'},
    business: {key:'leads', href:receivedHref, label:'Shared Assets'},
    middleman: {key:'marketplace', href:'/marketplace', label:'Marketplace'},
  } as const;
  return [
    {key:'home', href:'/', label:'Home'},
    {key:'workspace', href:'/workspace', label:'Workspace'},
    primary[role],
    {key:'valuation', href:'/valuation', label:'Value Asset'},
  ] as const;
}

const cards = {
  register: ['Asset Register','/asset-register','agriculture'],
  value: ['Value Asset','/valuation','construction'],
  marketplace: ['Marketplace','/marketplace','motor'],
  registers: ['Manage Registers','/asset-registers','industrial'],
  map: ['Asset Map','/asset-map','motor'],
  maintenance: ['Maintenance','/maintenance','construction'],
  costs: ['Cost Ledger','/my-invoices','industrial'],
  budgets: ['Budgets','/budgets','agriculture'],
  fuel: ['Fuel Slips','/fuel?view=slips','motor'],
  storage: ['Fuel Storage','/fuel?view=storage','industrial'],
  documents: ['Documents','/documents','construction'],
  annual: ['Annual Review','/annual-review','agriculture'],
  shared: ['Shared Assets','/leads','agriculture'],
  parts: ['Parts','/parts','industrial'],
  tracking: ['Maintenance Tracking','/tracking','construction'],
  businessCosts: ['Cost Ledger','/dealer-costs','industrial'],
  showroom: ['My Showroom','/my-showroom','agriculture'],
  template: ['Advert Template','/ad-studio?mode=template','construction'],
  advert: ['Create Advert','/ad-studio?mode=create','motor'],
  account: ['Account','/account','industrial'],
} as const;
type CardKey = keyof typeof cards;
const inventories: Record<WorkspaceRole, CardKey[]> = {
  owner: ['register','value','marketplace','map','maintenance','costs','budgets','fuel','storage','documents','annual','registers','account'],
  business: ['shared','register','parts','value','marketplace','showroom','tracking','businessCosts','registers','template','advert','account'],
  middleman: ['marketplace','showroom','value','template','advert','account'],
};
const freeCards = new Set<CardKey>(['shared','value','marketplace','account']);

export function workspaceCards(role: WorkspaceRole, free: boolean, receivedHref: string) {
  return inventories[role].map(key => {
    const [label,href,sector] = cards[key];
    return {key,label,href:key === 'shared' ? receivedHref : href,sector,locked:free && !freeCards.has(key)};
  });
}
