import type { ReactNode } from 'react';
import './admin-foundation.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="adminWorkspaceRoot">{children}</div>;
}
