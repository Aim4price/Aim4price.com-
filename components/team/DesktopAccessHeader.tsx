'use client';
import AppHeader from '../AppHeader';

/** Compatibility wrapper: use the owner header, never a separate desktop design. */
export default function DesktopAccessHeader({ onSignOut }: { onSignOut: () => void; accountHref?: string }) {
  return <AppHeader active="asset-register" brandAlignment="working-column" desktopContext={{name:'Aim4price',onSignOut}} />;
}
