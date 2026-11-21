'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { workspaceCards } from '../../lib/workspace-navigation';
import styles from './workspace.module.css';

const posters = {
  agriculture:'/brand/home-hero-poster.jpg', construction:'/brand/home-background-excavator.jpg',
  industrial:'/brand/home-background-truck.jpg', motor:'/brand/home-asset-hilux.webp',
};
const specificPosters: Record<string,string> = {
  budgets:'/costs/budgets.webp', costs:'/costs/cost-ledger.webp', businessCosts:'/costs/cost-ledger.webp',
  fuel:'/fuel/fuel-slips.webp',storage:'/fuel/storage-tanks.webp',shared:'/brand/asset-enquiry-hero.webp',
};

export default function WorkspaceGrid({cards}:{cards:ReturnType<typeof workspaceCards>}) {
  const [preview,setPreview] = useState('');
  function play(key:string) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPreview(key);
  }
  return <nav className={styles.grid} aria-label="Workspace pages">
    {cards.map(({key,label,href,sector,locked}) => <Link key={key}
      href={locked ? '/upgrade-account' : href} prefetch={false}
      aria-label={locked ? label+' — upgrade to Paid Business' : label}
      className={styles.card} data-account={key === 'account' || undefined} data-locked={locked || undefined}
      onMouseEnter={()=>!locked && play(key)} onMouseLeave={()=>setPreview('')}
      onFocus={()=>!locked && play(key)} onBlur={()=>setPreview('')}>
      <span className={styles.surface} style={{backgroundImage:'url('+(specificPosters[key] || posters[sector])+')'}}>
        {preview === key && <video aria-hidden="true" autoPlay loop muted playsInline
          src={'/brand/valuation/previews/'+sector+'-home-preview.mp4'}/>}
      </span>
      <strong>{label}</strong>
      {locked && <span className={styles.lock} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>}
    </Link>)}
  </nav>;
}
