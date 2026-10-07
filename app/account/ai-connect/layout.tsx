import type { ReactNode } from 'react';
import AppHeader from '../../../components/AppHeader';

export default function AiConnectionsLayout({ children }: { children: ReactNode }) {
  return <><AppHeader active="account" />{children}</>;
}
