/** Shared by the ledger, reports, budget filters and bookkeeping reference. */
export const costCategories = [
  { value: 'service', label: 'Services', subtitle: 'Routine upkeep', code: 'MAIN', icon: 'service_plan' },
  { value: 'repair', label: 'Repairs', subtitle: 'Breakdown fixes', code: 'REP', icon: 'service_plan' },
  { value: 'tyres', label: 'Tyres and tracks', shortLabel: 'Tyres', subtitle: 'Wheels and tracks', code: 'TYRE', icon: 'renewal' },
  { value: 'fuel', label: 'Fuel and charging', shortLabel: 'Fuel', subtitle: 'Diesel and charging', code: 'FUEL', icon: 'amount' },
  { value: 'insurance', label: 'Insurance', subtitle: 'Policy premiums', code: 'INS', icon: 'insurance' },
  { value: 'licence', label: 'Licensing', subtitle: 'Permits and renewals', code: 'LIC', icon: 'licence' },
  { value: 'finance', label: 'Finance charges', subtitle: 'Interest and fees', code: 'FIN', icon: 'finance' },
  { value: 'lease', label: 'Lease', subtitle: 'Lease payments', code: 'LEASE', icon: 'lease' },
  { value: 'rental', label: 'Rental', subtitle: 'Short-term hire', code: 'RENT', icon: 'rental' },
  { value: 'transport', label: 'Transport and recovery', shortLabel: 'Transport', subtitle: 'Haulage and towing', code: 'MOVE', icon: 'tracking' },
  { value: 'storage', label: 'Storage and security', shortLabel: 'Storage', subtitle: 'Parking and security', code: 'STORE', icon: 'storage' },
  { value: 'tracking', label: 'Tracking', subtitle: 'GPS monitoring', code: 'TRACK', icon: 'tracking' },
  { value: 'extended_warranty', label: 'Extended warranty', subtitle: 'Extra cover', code: 'WARR', icon: 'extended_warranty' },
  { value: 'service_plan', label: 'Service plan', subtitle: 'Prepaid servicing', code: 'PLAN', icon: 'service_plan' },
  { value: 'subscription', label: 'Subscription', subtitle: 'Software and access', code: 'SUB', icon: 'subscription' },
  { value: 'other', label: 'Other', subtitle: 'Unlisted costs', code: 'OTHER', icon: 'other' },
] as const;

export function costCategory(value: unknown) {
  return costCategories.find(category => category.value === value);
}

export function categorySummary(values?: readonly string[]) {
  return values?.length ? values.map(value => value === 'fuel_slip' ? 'Fuel slips' : costCategory(value)?.label ?? value).join(', ') : 'All costs';
}

export function appendReportCategories(params: URLSearchParams, selected: readonly string[] = []) {
  if (selected.includes('all')) return;
  for (const category of selected) params.append('category', category);
}

export const reportCostCategories = [{ value: 'all', label: 'All costs' }, ...costCategories];
