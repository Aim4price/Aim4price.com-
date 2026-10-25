import type { ReactNode } from 'react';

const symbols: Record<string, ReactNode> = {
  insurance: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8 12 3 3 5-6" /></>,
  finance: <><path d="m3 8 9-5 9 5H3Zm1 13h16M6 11v6m6-6v6m6-6v6" /></>,
  rental: <><circle cx="8" cy="9" r="4" /><path d="m11 12 8 8 3-3-2-2-2 2m-3-6 2-2" /></>,
  tracking: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  storage: <><path d="m3 9 9-6 9 6v12H3Zm4 12V11h10v10M7 15h10M7 18h10" /></>,
  extended_warranty: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12h8m-4-4v8" /></>,
  service_plan: <><path d="M14 4a5 5 0 0 0-5 7L3 17a3 3 0 0 0 4 4l6-6a5 5 0 0 0 7-6l-4 3-4-4 3-4Z" /></>,
  licence: <><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="8" cy="10" r="2" /><path d="M5 16c0-3 6-3 6 0m3-6h4m-4 4h4" /></>,
  subscription: <><path d="M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5M4 15a8 8 0 0 0 14 4l3-3m0 5v-5h-5" /></>,
  lease: <><path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h5" /></>,
  other: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><path d="M14 17h7m-3.5-3.5v7" /></>,
  description: <><path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h8" /></>,
  amount: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18m-5 5h2" /></>,
  reference: <><path d="m9 3-2 18M17 3l-2 18M4 9h16M3 15h16" /></>,
  note: <><path d="M4 4h16v12l-5 5H4Zm11 17v-5h5M8 8h8m-8 4h6" /></>,
  start: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></>,
  end: <><circle cx="12" cy="12" r="9" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
};

export default function RecurringFieldIcon({ kind, className }: { kind: string; className?: string }) {
  const frequencyMonths: Record<string, number> = { monthly: 1, quarterly: 3, six_monthly: 6, annual: 12 };
  const months = frequencyMonths[kind];
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {months ? <><rect x="3" y="5" width="18" height="16" rx="4" /><path d="M7 3v4m10-4v4M3 10h18" /><text x="12" y="18" textAnchor="middle" fill="currentColor" stroke="none" fontSize="7" fontWeight="750">{months}</text><path d="m19 1 3 2-3 2" /></> : symbols[kind] ?? symbols.subscription}
  </svg>;
}
