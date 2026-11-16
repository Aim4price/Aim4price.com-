import type { ReactNode } from 'react';
import type { Viewport } from 'next';

// Preserve Admin's effective viewport independently of the website canvas.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, userScalable: true };
import './admin-foundation.css';
import AdminWorkspace from '../../components/AdminWorkspace';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="adminWorkspaceRoot"><AdminWorkspace>{children}</AdminWorkspace></div>;
}
