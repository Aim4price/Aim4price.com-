type DisposalIconName = 'check' | 'outcome' | 'details' | 'impact' | 'record' | 'sold' | 'traded_in' | 'scrapped' | 'written_off' | 'mistake_duplicate' | 'other';

/** A single stroke style for the disposal steps and outcome choices. */
export default function DisposalIcon({ name, className }: { name: DisposalIconName; className?: string }) {
  const paths: Record<DisposalIconName, string> = {
    check: 'm5 12 4 4L19 6',
    outcome: 'M5 21V4m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0',
    details: 'M8 4H5v17h14V4h-3M8 3h8v4H8zM8 12h8M8 16h5',
    impact: 'm4 16 5-5 4 3 7-9m-6 0h6v6',
    record: 'M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5',
    sold: 'M3 3h7l11 11-7 7L3 10zM7 7h.01',
    traded_in: 'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
    scrapped: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
    written_off: 'm12 3 10 18H2zM12 9v5M12 17h.01',
    mistake_duplicate: 'M9 9h11v11H9zM5 15H3V3h12v2M12 12l5 5m0-5-5 5',
    other: 'M6 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0M20 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
