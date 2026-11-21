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
  register: ['Asset Register','/asset-register'],
  value: ['Value Asset','/valuation'],
  marketplace: ['Marketplace','/marketplace'],
  registers: ['Manage Registers','/asset-registers'],
  map: ['Asset Map','/asset-map'],
  maintenance: ['Maintenance','/maintenance'],
  costs: ['Cost Ledger','/my-invoices'],
  budgets: ['Budgets','/budgets'],
  fuel: ['Fuel Slips','/fuel?view=slips'],
  storage: ['Fuel Storage','/fuel?view=storage'],
  documents: ['Documents','/documents'],
  shared: ['Shared Assets','/leads'],
  parts: ['Parts & Stock','/parts'],
  tracking: ['Maintenance Tracking','/tracking'],
  businessCosts: ['Cost Ledger','/dealer-costs'],
  showroom: ['My Showroom','/my-showroom'],
  template: ['Advert Template','/ad-studio?mode=template'],
  advert: ['Create Advert','/ad-studio?mode=create'],
  account: ['Account','/account'],
} as const;
type CardKey = keyof typeof cards;
const inventories: Record<WorkspaceRole, CardKey[]> = {
  owner: ['registers','value','map','maintenance','fuel','storage','costs','budgets','documents','marketplace','account'],
  business: ['shared','register','registers','parts','tracking','businessCosts','value','marketplace','showroom','template','advert','account'],
  middleman: ['marketplace','showroom','value','template','advert','account'],
};
const freeCards = new Set<CardKey>(['shared','value','marketplace','account']);

export function workspaceCards(role: WorkspaceRole, free: boolean, receivedHref: string) {
  return inventories[role].map(key => {
    const [label,href] = cards[key];
    return {key,label,href:key === 'shared' ? receivedHref : href,locked:free && !freeCards.has(key)};
  });
}
