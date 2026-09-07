import type { ReactNode } from 'react';
import type { Viewport } from 'next';

// Preserve Admin's effective viewport independently of the website canvas.
export const viewport: Viewport = { width: 980, initialScale: -1, userScalable: true };
import './admin-foundation.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="adminWorkspaceRoot">{children}</div>;
}
