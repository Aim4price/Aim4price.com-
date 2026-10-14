'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { featureCategories, tutorials } from './tutorial-content';
import styles from './tutorials.module.css';

export default function TutorialLibrary() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activeId, setActiveId] = useState('first-asset');
  const panel = useRef<HTMLElement>(null);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = tutorials.filter(item => {
    const text = `${item.title} ${item.question} ${item.description} ${item.where} ${item.keywords} ${item.example} ${item.steps.join(' ')}`.toLowerCase();
    return (category === 'all' || item.category === category) && words.every(word => text.includes(word));
  });
  const active = visible.find(item => item.id === activeId) ?? visible[0];
  const index = active ? visible.indexOf(active) : -1;
  const select = (id: string) => {
    setActiveId(id);
    requestAnimationFrame(() => {
      const element = panel.current;
      if (!element) return;
      const bounds = element.getBoundingClientRect();
      if (bounds.top < 0 || bounds.top > window.innerHeight * .5) element.scrollIntoView({ block: 'start' });
    });
  };
  const clear = () => { setQuery(''); setCategory('all'); };

  return <div className={styles.shell}>
    <header className={styles.hero}><span className={styles.badge}>Private preview · Owners</span><h1>Aim4price for owners.</h1><p>What would you like to know about your assets?</p><p className={styles.intro}>Explore the features below. Video walkthroughs will be added here as they’re ready.</p></header>
    <section className={styles.finder} aria-label="Find an owner feature">
      <label htmlFor="tutorial-search">Find a feature or ask a question</label>
      <div className={styles.searchField}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input id="tutorial-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search fuel, maintenance, sharing, reports…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">Clear</button>}</div>
      <div className={styles.categories} role="group" aria-label="Owner feature categories"><button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All features</button>{featureCategories.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.title}</button>)}</div>
    </section>
    <p className={styles.results} role="status">{visible.length} {visible.length === 1 ? 'owner feature' : 'owner features'}{query || category !== 'all' ? ' found' : ' to explore'}</p>
    {active ? <div className={styles.workspace}>
      <nav className={styles.featureList} aria-label="Owner features">{featureCategories.map(group => {
        const items = visible.filter(item => item.category === group.id);
        return items.length ? <section key={group.id} aria-labelledby={`group-${group.id}`}><h2 id={`group-${group.id}`}>{group.title}<span>{items.length}</span></h2><div className={styles.groupList}>{items.map(item => <button type="button" key={item.id} aria-current={active.id === item.id ? 'true' : undefined} aria-controls="owner-feature-panel" onClick={() => select(item.id)}><span className={styles.number}>{String(tutorials.indexOf(item) + 1).padStart(2,'0')}</span><span><strong>{item.title}</strong><small>{group.title}</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>)}</div></section> : null;
      })}</nav>
      <article key={active.id} id="owner-feature-panel" ref={panel} className={styles.panel} aria-labelledby="owner-feature-title">
        <header><p className={styles.topic}>{featureCategories.find(item => item.id === active.category)?.title}</p><h2 id="owner-feature-title">{active.question}</h2><p className={styles.description}>{active.description}</p></header>
        {active.videoSrc ? <video className={styles.video} controls preload="metadata" aria-label={`${active.title} video`}><source src={active.videoSrc} type="video/mp4" />{active.captionsSrc && <track kind="captions" src={active.captionsSrc} srcLang="en" label="English" default />}Your browser does not support this video.</video> : <div className={styles.videoPlaceholder} aria-label="Video not yet available"><span className={styles.play} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 11 7-11 7Z"/></svg></span><strong>{active.title}</strong><span>Video coming soon</span></div>}
        <div className={styles.example}><strong>What this helps you do</strong><p>{active.example}</p></div>
        <details className={styles.steps} onToggle={event => { if (event.currentTarget.open) requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'start' })); }}><summary>Read the quick guide <span aria-hidden="true">⌄</span></summary><div><p className={styles.where}><strong>Where to find it</strong>{active.where}</p><ol>{active.steps.map(step => <li key={step}>{step}</li>)}</ol>{active.note && <p className={styles.note}>{active.note}</p>}<Link href={active.href}>{active.action} <span aria-hidden="true">↗</span></Link></div></details>
        <div className={styles.paging}><button type="button" disabled={index === 0} onClick={() => select(visible[index - 1].id)}>← Previous feature</button><span>{index + 1} of {visible.length}</span><button type="button" disabled={index === visible.length - 1} onClick={() => select(visible[index + 1].id)}>Next feature →</button></div>
      </article>
    </div> : <section className={styles.empty}><h2>No matching owner features</h2><p>Try a shorter search or choose another category.</p><button type="button" onClick={clear}>Show all features</button></section>}
  </div>;
}
