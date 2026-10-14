'use client';

import Link from 'next/link';
import { useState } from 'react';
import { featureCategories, tutorials } from './tutorial-content';
import styles from './tutorials.module.css';

const iconPaths: Record<string, string> = {
  spark: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z',
  asset: 'M3 7h18v14H3ZM7 7V3h10v4M3 12h18M9 12v4h6v-4',
  value: 'M4 20V4m0 16h16M8 15l4-5 4 2 5-7',
  cost: 'M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 8h6M9 12h6M9 16h3',
  fuel: 'M5 21V3h9v18M3 21h13M5 9h9m0 3h3v5a2 2 0 0 0 4 0V8l-3-3',
  tool: 'm14 6 4 4 3-3a6 6 0 0 1-7 8l-6 6-5-5 6-6a6 6 0 0 1 8-7Z',
  share: 'M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm14-7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 14a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 11l8-5M8 13l8 5',
  report: 'M5 3h10l4 4v14H5ZM15 3v5h4M9 17v-4m3 4v-7m3 7v-5',
  business: 'M3 21V7h10v14M13 11h8v10M6 11h4M6 15h4M6 19h4M16 15h2M16 19h2M1 21h22',
  connection: 'M9 3H4v18h12v-7M7 17h6M14 4h7v7m0-7-9 9',
};
function FeatureIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name] ?? iconPaths.asset} /></svg>;
}

export default function TutorialLibrary() {
  const [query, setQuery] = useState('');
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = tutorials.filter(item => {
    const text = `${item.title} ${item.description} ${item.where} ${item.audience} ${item.keywords} ${item.steps.join(' ')} ${item.example}`.toLowerCase();
    return words.every(word => text.includes(word));
  });
  const sections = featureCategories.map(category => ({ ...category, items: visible.filter(item => item.category === category.id) })).filter(category => category.items.length);

  return <div className={styles.shell}>
    <header className={styles.hero}>
      <span className={styles.badge}>Private preview</span>
      <h1>Explore Aim4price.</h1>
      <p>Discover what you can do, and learn how to do it.</p>
      <div className={styles.heroBottom}><span>{tutorials.length} features · {featureCategories.length} sections</span>{!query && <a href="#feature-start">Start with the basics <span aria-hidden="true">↗</span></a>}</div>
    </header>

    <section className={styles.finder} aria-label="Find a feature">
      <div className={styles.searchRow}><label htmlFor="tutorial-search">What would you like to do?</label><div className={styles.searchField}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input id="tutorial-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try maintenance, invoices or sharing…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">Clear</button>}</div></div>
      <nav className={styles.categoryLinks} aria-label="Feature sections">{sections.map(category => <a key={category.id} href={`#feature-${category.id}`}>{category.title}<span>{category.items.length}</span></a>)}</nav>
      <div className={styles.finderNote}><span role="status">{query ? `${visible.length} matching ${visible.length === 1 ? 'feature' : 'features'}` : 'Browse all features below'}</span><span>Open any feature to see how it works.</span></div>
    </section>

    {sections.length ? <div className={styles.sections}>{sections.map(category => <section key={category.id} id={`feature-${category.id}`} className={styles.category} aria-labelledby={`heading-${category.id}`}>
      <header className={styles.categoryHeader}><span className={styles.categoryIcon}><FeatureIcon name={category.icon}/></span><div><h2 id={`heading-${category.id}`}>{category.title}</h2><p>{category.description}</p></div><span className={styles.categoryCount}>{category.items.length} features</span></header>
      <div className={styles.featureList}>{category.items.map(item => <details key={item.id} className={styles.feature} id={`guide-${item.id}`}>
        <summary><span className={styles.rowIcon}><FeatureIcon name={category.icon}/></span><span className={styles.featureCopy}><h3>{item.title}</h3><span>{item.description}</span></span><span className={styles.openAction}><span className={styles.closedLabel}>See how</span><span className={styles.openLabel}>Close guide</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></summary>
        <div className={styles.guide}>
          <div className={styles.guideMeta}><div><span>Where to find it</span><p>{item.where}</p></div><div><span>Who it’s for</span><p>{item.audience}</p></div></div>
          <div className={styles.guideColumns}><div><h4>How to use it</h4><ol>{item.steps.map(step => <li key={step}>{step}</li>)}</ol></div><aside className={styles.example}><span>For example</span><p>{item.example}</p>{item.note && <div className={styles.note}><strong>Good to know</strong><p>{item.note}</p></div>}</aside></div>
          {item.videoSrc && <details className={styles.videoGuide}><summary>Watch the video</summary><video controls preload="none"><source src={item.videoSrc} type="video/mp4"/>{item.captionsSrc && <track kind="captions" src={item.captionsSrc} srcLang="en" label="English" default/>}Your browser does not support video.</video></details>}
          <div className={styles.guideFooter}><Link href={item.href}>{item.action}<span aria-hidden="true"> ↗</span></Link><span>Tools shown depend on your account and permissions.</span></div>
        </div>
      </details>)}</div>
    </section>)}</div> : <section className={styles.empty}><h2>No matching features</h2><p>Try a shorter search, such as “fuel” or “maintenance”.</p><button onClick={() => setQuery('')}>Show all features</button></section>}
    <footer className={styles.closing}><div><h2>Start with one asset.</h2><p>Add its details. Record the next job. Build from there.</p></div><Link href="/asset-register">Open Asset Register <span aria-hidden="true">↗</span></Link><a href="#tutorial-search">Back to search ↑</a></footer>
  </div>;
}
