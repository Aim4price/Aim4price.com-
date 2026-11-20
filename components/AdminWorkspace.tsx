'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ADMIN_LINKS, ADMIN_GROUPS } from './AdminNavigation';
import styles from './AdminWorkspace.module.css';

const icons: Record<string, string> = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  accounts: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  billing: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',
  'capture-queue': 'M4 3h10l6 6v12H4z M14 3v6h6 M8 14h8 M8 17h5',
  'work-tracker': 'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  'asset-emails': 'M3 5h18v14H3z M3 5l9 7 9-7',
  marketplace: 'M3 9l2-6h14l2 6 M3 9h18 M5 9v12h14V9 M9 21v-7h6v7',
  discovery: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  'asset-map': 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
  'sold-assets': 'M4 12l5 5L20 6 M4 3h8 M3 3v18h18v-8',
  valuations: 'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',
  'asset-options': 'M4 5h16v4H4z M4 12h7v7H4z M14 13h6 M14 17h6',
  videos: 'M3 5h13v14H3z M16 10l5-4v12l-5-4',
  'ai-connections': 'M8 3v4 M16 3v4 M5 7h14v5a7 7 0 0 1-14 0z M12 19v3',
  'annual-review': 'M3 11a9 9 0 0 1 15-6l3 3 M21 3v5h-5 M21 13a9 9 0 0 1-15 6l-3-3 M3 21v-5h5',
  'maintenance-catalogue': 'M9 5h11v16H4V5h3 M9 3h6v4H9z M8 12l2 2 5-5 M8 18h8',
  sharing: 'M8 12l8-5 M8 12l8 5 M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
};
export function AdminIcon({ name }: { name: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name] || icons.dashboard} /></svg>;
}

export default function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const current = ADMIN_LINKS.find(item => item.href === pathname || (item.href !== '/admin' && pathname.startsWith(item.href + '/')));
  const isCurrent = (href: string) => current?.href === href;
  useEffect(() => { try { setCollapsed(localStorage.getItem('aim4price.admin.sidebar') === 'collapsed'); } catch {} }, []);
  useEffect(() => { drawer.current?.close(); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 981px)');
    const closeDrawerOnDesktop = () => { if (desktop.matches) drawer.current?.close(); };
    desktop.addEventListener('change', closeDrawerOnDesktop);
    return () => desktop.removeEventListener('change', closeDrawerOnDesktop);
  }, []);
  function toggleSidebar() {
    setCollapsed(value => { const next = !value; try { localStorage.setItem('aim4price.admin.sidebar', next ? 'collapsed' : 'expanded'); } catch {} return next; });
  }
  function navigation(compact = false) {
    return <nav aria-label="Admin sections" className={styles.navigation}>
      <Link href="/admin/dashboard" prefetch={false} className={`${styles.item} ${pathname === '/admin/dashboard' ? styles.selected : ''}`} aria-current={pathname === '/admin/dashboard' ? 'page' : undefined} title={compact ? 'Dashboard' : undefined} onClick={() => drawer.current?.close()}><AdminIcon name="dashboard" /><span>Dashboard</span></Link>
      {ADMIN_GROUPS.map(group => <section key={group.title} className={styles.group} aria-label={group.title}>
        <h2>{group.title}</h2>
        {group.keys.filter(key => key !== 'dashboard').map(key => ADMIN_LINKS.find(item => item.key === key)!).map(item => <Link key={item.key} href={item.href} prefetch={false} title={compact ? item.label : undefined} className={`${styles.item} ${isCurrent(item.href) ? styles.selected : ''}`} aria-current={isCurrent(item.href) ? 'page' : undefined} onClick={() => drawer.current?.close()}><AdminIcon name={item.key} /><span>{item.key === 'annual-review' ? 'Annual review' : item.label}</span></Link>)}
      </section>)}
      <Link href="/admin/sharing" prefetch={false} className={`${styles.item} ${pathname === '/admin/sharing' ? styles.selected : ''}`} aria-current={pathname === '/admin/sharing' ? 'page' : undefined} title={compact ? 'Sharing & access' : undefined} onClick={() => drawer.current?.close()}><AdminIcon name="sharing" /><span>Sharing & access</span></Link>
    </nav>;
  }
  return <div className={`${styles.workspace} ${collapsed ? styles.collapsed : ''}`}>
    <a className={styles.skipLink} href="#admin-workspace-content">Skip to page content</a>
    <aside className={styles.sidebar} aria-label="Admin workspace">
      <Link href="/admin/dashboard" className={styles.brand} aria-label="Aim4price Admin dashboard"><img className={styles.brandLogo} src="/brand/aim4price-mark-black.png" alt="" width={660} height={515} /><span className={styles.brandText}>Aim4price<small>Admin workspace</small></span></Link>
      {navigation(collapsed)}
      <div className={styles.sidebarFooter}><img className={styles.adminAvatar} src="/brand/aim4price-mark-black.png" alt="" width={660} height={515} /><span className={styles.adminIdentity}>Administrator<small>Aim4price</small></span><button type="button" className={styles.collapseButton} onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>{collapsed ? '›' : '‹'}</button></div>
    </aside>
    <div className={styles.content}>
      <header className={styles.workspaceBar}>
        <button ref={menuButton} type="button" className={styles.menuButton} onClick={() => drawer.current?.showModal()} aria-label="Open Admin navigation" aria-haspopup="dialog"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        <div className={styles.breadcrumb}><span>Workspace</span><span aria-hidden="true">/</span><strong>{current?.label || (pathname === '/admin/sharing' ? 'Sharing & access' : 'Admin')}</strong></div>
        <div className={styles.zoomHost} data-website-zoom-host="ready" data-admin-zoom-host />
        <span className={styles.accessLabel}><span />Admin access</span>
      </header>
      <div id="admin-workspace-content" className={styles.pageContent} tabIndex={-1}>{children}</div>
    </div>
    <dialog ref={drawer} className={styles.drawer} aria-label="Admin navigation" onClose={() => { if (window.matchMedia('(max-width: 980px)').matches) menuButton.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
      <div className={styles.drawerHeader}><span className={styles.drawerBrand}><img src="/brand/aim4price-mark-black.png" alt="" width={660} height={515} /><strong>Aim4price Admin</strong></span><button type="button" className={styles.collapseButton} data-modal-close aria-label="Close Admin navigation" onClick={() => drawer.current?.close()}>×</button></div>
      {navigation()}
    </dialog>
  </div>;
}
