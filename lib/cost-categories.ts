/** Shared by the ledger, reports, budget filters and bookkeeping reference. */
export const costCategories = [
  { value: 'service', label: 'Services', code: 'MAIN', icon: 'service_plan' },
  { value: 'repair', label: 'Repairs', code: 'REP', icon: 'service_plan' },
  { value: 'tyres', label: 'Tyres and tracks', code: 'TYRE', icon: 'renewal' },
  { value: 'fuel', label: 'Fuel and charging', code: 'FUEL', icon: 'amount' },
  { value: 'insurance', label: 'Insurance', code: 'INS', icon: 'insurance' },
  { value: 'licence', label: 'Licensing and compliance', code: 'LIC', icon: 'licence' },
  { value: 'finance', label: 'Finance charges', code: 'FIN', icon: 'finance' },
  { value: 'lease', label: 'Lease', code: 'LEASE', icon: 'lease' },
  { value: 'rental', label: 'Rental', code: 'RENT', icon: 'rental' },
  { value: 'transport', label: 'Transport and recovery', code: 'MOVE', icon: 'tracking' },
  { value: 'storage', label: 'Storage and security', code: 'STORE', icon: 'storage' },
  { value: 'tracking', label: 'Tracking', code: 'TRACK', icon: 'tracking' },
  { value: 'extended_warranty', label: 'Extended warranty', code: 'WARR', icon: 'extended_warranty' },
  { value: 'service_plan', label: 'Service plan', code: 'PLAN', icon: 'service_plan' },
  { value: 'subscription', label: 'Subscription', code: 'SUB', icon: 'subscription' },
  { value: 'other', label: 'Other', code: 'OTHER', icon: 'other' },
] as const;

export function costCategory(value: unknown) {
  return costCategories.find(category => category.value === value);
}

export function categorySummary(values?: readonly string[]) {
  return values?.length ? values.map(value => costCategory(value)?.label ?? value).join(', ') : 'All costs';
}

export const reportCostCategories = [{ value: 'all', label: 'All costs' }, ...costCategories];
