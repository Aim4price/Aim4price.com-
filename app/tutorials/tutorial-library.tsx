'use client';

import Link from 'next/link';
import AssetModalSelect from '../../components/AssetModalSelect';
import { useRef, useState } from 'react';
import { featureCategories, tutorials, ownerIntroduction } from './tutorial-content';
import styles from './tutorials.module.css';

export default function TutorialLibrary() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activeId, setActiveId] = useState('welcome');
  const [expanded, setExpanded] = useState<'guide' | 'example' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = tutorials.filter(item => {
    const text = `${item.title} ${item.question} ${item.description} ${item.where} ${item.keywords} ${item.example} ${item.steps.join(' ')}`.toLowerCase();
    return (category === 'all' || item.category === category) && words.every(word => text.includes(word));
  });
  const active = visible.find(item => item.id === activeId) ?? visible[0];
  const showWelcome = activeId === 'welcome' && !query.trim() && category === 'all';
  const selectFeature = (id: string) => { setActiveId(id); setExpanded(null); };
  const welcome = () => { setActiveId('welcome'); setQuery(''); setCategory('all'); setExpanded(null); };
  const resetDetails = () => setExpanded(null);
  const clear = () => { setQuery(''); setCategory('all'); resetDetails(); };

  return <div className={styles.shell}>

    <section className={styles.finder} aria-label="Find an owner feature">
      <div className={styles.searchField}><label htmlFor="tutorial-search">Search features</label><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input id="tutorial-search" type="search" value={query} onChange={event => { setQuery(event.target.value); resetDetails(); }} placeholder="Try fuel, maintenance or sharing" />{query && <button type="button" onClick={() => { setQuery(''); resetDetails(); }} aria-label="Clear search">Clear</button>}</div></div>
      <AssetModalSelect label="Category" buttonLabel="Choose feature category" value={category} options={[{value:'all',label:'All features'}, ...featureCategories.map(item => ({value:item.id,label:item.title}))]} onChange={value => { setCategory(value); resetDetails(); }} className={styles.category} menuClassName={styles.categoryMenu} showDescriptions={false} usePortal={false} />
    </section>
    {active ? <div className={styles.workspace}>
      <aside className={styles.listCard}><div className={styles.listHeading}><h1>Owner features</h1><span role="status">{visible.length} {visible.length === 1 ? 'feature' : 'features'}</span></div>
      <button className={styles.welcomeLink} type="button" aria-current={showWelcome ? 'true' : undefined} aria-controls="owner-feature-panel" onClick={welcome}>Welcome · Start here</button>
      <nav className={styles.featureList} aria-label="Owner features" tabIndex={0}><div className={styles.groupList}>{visible.map(item => <button type="button" key={item.id} aria-current={!showWelcome && active.id === item.id ? 'true' : undefined} aria-controls="owner-feature-panel" onClick={() => selectFeature(item.id)}><span className={styles.featureNumber}>{tutorials.indexOf(item) + 1}</span><span>{item.title}</span></button>)}</div></nav></aside>
      <article id="owner-feature-panel" className={styles.panel} aria-labelledby="owner-feature-title">
        {showWelcome ? <div className={styles.welcome}>
          <header><h2 id="owner-feature-title">Welcome to Aim4price.</h2><p className={styles.description}>Watch the introduction, then choose a numbered feature from the list.</p></header>
          {ownerIntroduction.videoSrc ? <video className={styles.introVideo} controls autoPlay muted playsInline preload="metadata" aria-label="Introduction to Aim4price video"><source src={ownerIntroduction.videoSrc} type="video/mp4" />{ownerIntroduction.captionsSrc && <track kind="captions" src={ownerIntroduction.captionsSrc} srcLang="en" label="English" default />}</video> : <div className={styles.introPlaceholder} aria-label="Introduction video not yet available"><span className={styles.introFilm} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg></span><strong>Your introduction to Aim4price</strong><span>Video coming soon</span></div>}
          <p className={styles.introHint}>{ownerIntroduction.videoSrc ? 'Use the video controls to turn on sound. ' : ''}Choose any feature to open its video and quick guide.</p>
        </div> : <>
        <header><h2 id="owner-feature-title">{active.question}</h2><p className={styles.description}>{active.description}</p></header>
        <div className={styles.mediaRow}>{active.videoSrc ? <button ref={trigger} type="button" className={styles.videoPreview} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><span className={styles.play} aria-hidden="true">▶</span><strong>Watch video</strong></button> : <div className={styles.videoPreview} aria-label="Video not yet available"><span className={styles.film} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg></span><strong>Video coming soon</strong></div>}<div><h3>{active.title}</h3><p>A short walkthrough of this feature.</p><Link className={styles.action} href={active.href}>{active.action}</Link></div></div>
        <div className={styles.disclosures}>{(['guide','example'] as const).map(section => <section key={section}><button type="button" aria-expanded={expanded === section} aria-controls={`feature-${section}`} onClick={() => setExpanded(expanded === section ? null : section)}><span>{section === 'guide' ? 'How to use it' : 'Example'}</span><small>{expanded === section ? 'Hide' : 'Show'}</small></button><div id={`feature-${section}`} hidden={expanded !== section} className={styles.explanation}>{section === 'guide' ? <><p className={styles.where}><strong>Where to find it</strong>{active.where}</p><ol>{active.steps.map(step => <li key={step}>{step}</li>)}</ol>{active.note && <p className={styles.note}>{active.note}</p>}</> : <p>{active.example}</p>}</div></section>)}</div>
        {active.videoSrc && <dialog ref={dialog} className={styles.videoDialog} aria-labelledby="tutorial-video-title" onClose={() => { dialog.current?.querySelector('video')?.pause(); trigger.current?.focus(); }} onClick={event => { if(event.target === dialog.current) { const r=dialog.current.getBoundingClientRect(); if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.current.close(); } }}><header><h2 id="tutorial-video-title">{active.title}</h2><button type="button" onClick={() => dialog.current?.close()}>Close video</button></header><video key={active.id} controls preload="none" aria-label={`${active.title} video`}><source src={active.videoSrc} type="video/mp4" />{active.captionsSrc && <track kind="captions" src={active.captionsSrc} srcLang="en" label="English" default />}</video></dialog>}
        </>}
      </article>
    </div> : <section className={styles.empty}><h2>No matching owner features</h2><p>Try a shorter search or choose another category.</p><button type="button" onClick={clear}>Show all features</button></section>}
  </div>;
}
