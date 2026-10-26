import type { DealerStaffRole } from './dealer-app';

export type DealerAppCapability =
  | 'parts_network'
  | 'overview'
  | 'inventory'
  | 'notifications'
  | 'leads'
  | 'maintenance'
  | 'valuation'
  | 'discovery'
  | 'client_costs'
  | 'marketplace'
  | 'ad_studio'
  | 'showroom';

const ROLE_CAPABILITIES: Record<DealerStaffRole, ReadonlySet<DealerAppCapability>> = {
  owner: new Set([
    'parts_network',
    'overview',
    'inventory',
    'notifications',
    'leads',
    'maintenance',
    'valuation',
    'discovery',
    'client_costs',
    'marketplace',
    'ad_studio',
    'showroom',
  ]),
  sales: new Set([
    'parts_network',
    'overview',
    'inventory',
    'notifications',
    'leads',
    'maintenance',
    'valuation',
    'discovery',
    'marketplace',
    'ad_studio',
    'showroom',
  ]),
  parts: new Set([
    'parts_network',
    'overview',
    'notifications',
    'leads',
    'maintenance',
    'discovery',
    'client_costs',
  ]),
  technician: new Set(['overview', 'maintenance']),
};

export const DEALER_STAFF_ROLE_LABELS: Record<DealerStaffRole, string> = {
  owner: 'Owner / Manager',
  sales: 'Sales',
  parts: 'Parts',
  technician: 'Technician',
};

export function dealerRoleCan(role: DealerStaffRole, capability: DealerAppCapability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export function dealerStaffRoleLabel(role: DealerStaffRole): string {
  return DEALER_STAFF_ROLE_LABELS[role];
}
