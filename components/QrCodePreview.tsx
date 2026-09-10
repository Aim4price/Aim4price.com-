'use client';

import { useMemo } from 'react';
import { create } from 'qrcode';

/** Inline artwork avoids a second authenticated image request and stays sharp when zoomed. */
export default function QrCodePreview({ value, label }: { value: string | null; label: string }) {
  const artwork = useMemo(() => {
    if (!value) return null;
    const { modules } = create(value, { errorCorrectionLevel: 'M' });
    const quietZone = 4;
    const commands: string[] = [];
    for (let row = 0; row < modules.size; row += 1) {
      for (let column = 0; column < modules.size; column += 1) {
        if (modules.get(row, column)) commands.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
      }
    }
    return { size: modules.size + quietZone * 2, path: commands.join('') };
  }, [value]);

  if (!artwork) return <p role="status">QR code is not available yet.</p>;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${artwork.size} ${artwork.size}`}
      width="280"
      height="280"
      role="img"
      aria-label={label}
      focusable="false"
      shapeRendering="crispEdges"
      style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '1', background: '#fff' }}
    >
      <title>{label}</title>
      <rect width={artwork.size} height={artwork.size} fill="#fff" />
      <path d={artwork.path} fill="#000" />
    </svg>
  );
}
