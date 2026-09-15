export default function AssetReportTypeIcon({ className, kind }: { className?: string; kind: 'valuation' | 'maintenance' | 'fuel' | 'depreciation' | 'ownership' | 'map' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {kind === 'valuation' ? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 7h8M8 11h1m6 0h1M8 15h1m6 0h1M8 18h1m6 0h1" />
        </>
      ) : kind === 'maintenance' ? (
        <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4l-4.8 4.8a2.1 2.1 0 0 0 3 3l4.8-4.8a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z" />
      ) : kind === 'fuel' ? (
        <>
          <rect x="3" y="3" width="10" height="18" rx="1.5" />
          <path d="M3 10h10M2 21h12M13 12h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8l-4-4M18 5v3h3" />
        </>
      ) : kind === 'depreciation' ? (
        <>
          <path d="M3 3v18h18M6 7l5 5 4-3 6 7M16 16h5v-5" />
        </>
      ) : kind === 'map' ? (
        <>
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </>
      ) : (
        <>
          <path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v12H6a3 3 0 0 1-3-3V6" />
          <path d="M20 12h-4a2 2 0 0 0 0 4h4" />
        </>
      )}
    </svg>
  );
}
