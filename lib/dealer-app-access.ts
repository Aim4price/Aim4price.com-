import type { DealerStaffRole } from './dealer-app';

export type DealerAppCapability =
  | 'overview'
  | 'notifications'
  | 'leads'
  | 'maintenance'
  | 'valuation'
  | 'discovery'
  | 'client_costs'
  | 'marketplace'
  | 'ad_studio';

const ROLE_CAPABILITIES: Record<DealerStaffRole, ReadonlySet<DealerAppCapability>> = {
  owner: new Set([
    'overview',
    'notifications',
    'leads',
    'maintenance',
    'valuation',
    'discovery',
    'client_costs',
    'marketplace',
    'ad_studio',
  ]),
  sales: new Set([
    'overview',
    'notifications',
    'leads',
    'maintenance',
    'valuation',
    'discovery',
    'marketplace',
    'ad_studio',
  ]),
  parts: new Set([
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
