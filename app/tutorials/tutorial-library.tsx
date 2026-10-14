'use client';
import { useRef, useState } from 'react';
import { tutorials, tutorialTopics, type TutorialTopic } from './tutorial-content';
import styles from './tutorials.module.css';

export default function TutorialLibrary() {
  const guideHeading = useRef<HTMLHeadingElement>(null);
  const [topic, setTopic] = useState<TutorialTopic>('All tutorials');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState('first-asset');
  const visible = tutorials.filter(item => (topic === 'All tutorials' || item.topic === topic) && `${item.title} ${item.description} ${item.steps.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  const active = visible.find(item => item.id === activeId) ?? visible[0];
  return <div className={styles.shell}>
    <header className={styles.hero}><span className={styles.badge}>Private preview</span><h1>How to use Aim4price.</h1><p>Simple guides. One task at a time.</p><p className={styles.draftNote}>Written guides are ready to review. Videos will be added here later.</p></header>
    <section className={styles.filters} aria-label="Find a tutorial">
      <label htmlFor="tutorial-search">What would you like to do?</label>
      <input id="tutorial-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search assets, sharing, fuel…" />
      <div className={styles.topics} role="group" aria-label="Tutorial topics">{tutorialTopics.map(item => <button key={item} aria-pressed={topic === item} onClick={() => setTopic(item)}>{item}</button>)}</div>
    </section>
    <p className={styles.resultCount} role="status">{visible.length} {visible.length === 1 ? 'guide' : 'guides'} available</p>
    {active ? <div className={styles.workspace}>
      <nav className={styles.guideList} aria-label="Tutorials">{visible.map((item, index) => <button key={item.id} aria-current={active.id === item.id ? 'true' : undefined} onClick={() => { setActiveId(item.id); requestAnimationFrame(() => guideHeading.current?.focus()); }}><span className={styles.number}>{String(index + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{item.topic}</small></span><span aria-hidden="true">→</span></button>)}</nav>
      <article className={styles.guide} key={active.id} aria-labelledby="guide-title">
        <p className={styles.topic}>{active.topic}</p><h2 id="guide-title" ref={guideHeading} tabIndex={-1}>{active.title}</h2><p className={styles.description}>{active.description}</p>
        {active.videoSrc ? <video className={styles.video} controls preload="metadata"><source src={active.videoSrc} type="video/mp4" />{active.captionsSrc && <track kind="captions" src={active.captionsSrc} srcLang="en" label="English" default />}Your browser does not support this video.</video> : <div className={styles.videoPlaceholder}><span className={styles.play} aria-hidden="true">▷</span><strong>Video coming later</strong><span>Follow the written steps below for now.</span></div>}
        <h3>Follow these steps</h3><ol className={styles.steps}>{active.steps.map(step => <li key={step}>{step}</li>)}</ol><p className={styles.takeaway}><strong>Good to know</strong>{active.takeaway}</p>
      </article>
    </div> : <div className={styles.empty}><h2>No matching guides</h2><p>Try a different word or show all tutorials.</p><button onClick={() => {setTopic('All tutorials'); setQuery('');}}>Show all tutorials</button></div>}
  </div>;
}
