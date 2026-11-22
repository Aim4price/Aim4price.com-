import type { PageHelpTopic } from '../../lib/page-help';
import type { CardKey, WorkspaceRole } from '../../lib/workspace-navigation';
const topics: Record<CardKey, PageHelpTopic> = {
  register: 'register',
  registers: 'registers',
  shared: 'sharedEnquiries',
  value: 'valuation',
  marketplace: 'marketplace',
  discovery: 'discovery',
  map: 'map',
  maintenance: 'maintenance',
  tracking: 'dealerTracking',
  costs: 'costs',
  businessCosts: 'dealerCosts',
  budgets: 'budgets',
  fuel: 'fuelSlips',
  storage: 'fuelStorage',
  documents: 'documents',
  parts: 'partsStock',
  showroom: 'showroom',
  template: 'adTemplate',
  advert: 'adCreator',
  account: 'account',
};

export function cardTopic(key: CardKey, role: WorkspaceRole, href: string, free: boolean): PageHelpTopic {
  if (key === 'shared' && href === '/leads') return 'partnerLeads';
  if (key === 'account' && role === 'middleman') return 'middlemanAccount';
  if (key === 'account' && role === 'business') return free ? 'sharingAccount' : 'dealerAccount';
  return topics[key];
}
