'use client';

import { useRef } from 'react';
import HomeHeroExperience, { type HomePreviewProps } from '../home-hero-experience';
import { homeStories, type HomeAudience } from './home-stories';
import type { QuestionKey } from '../home-asset-preview';
import home from '../page.module.css';
import styles from './preview.module.css';

const keys: QuestionKey[] = ['worth', 'have', 'manage', 'cost', 'attention'];
const labels = {
  dealers: ['Estimate', 'Registers', 'Asset details', 'Showroom', 'After the sale'],
  businesses: ['Estimate', 'Shared assets', 'Information', 'Contributions', 'Client relationship'],
};

function DemoCard({ audience, activeQuestion, showRegister, onQuestionChange, onInteraction }: HomePreviewProps & { audience: HomeAudience }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const dealer = audience === 'dealers';
  const active = showRegister ? 'have' : activeQuestion;
  const title = labels[audience][keys.indexOf(active)];
  return <div className={`${home.assetHeroStage} ${styles.stage}`}>
    {!showRegister && <div className={home.assetQuestionGroup} role="tablist" aria-label={`Explore ${audience} features`}>
      {keys.map((key, index) => <button key={key} ref={node => { refs.current[index] = node; }}
        id={`preview-tab-${key}`} type="button" role="tab" aria-selected={activeQuestion === key}
        aria-controls="audience-demo" aria-label={labels[audience][index]} title={labels[audience][index]}
        tabIndex={activeQuestion === key ? 0 : -1}
        className={`${home.assetQuestion} ${activeQuestion === key ? home.assetQuestionActive : ''}`}
        onClick={() => onQuestionChange(key, index)} onKeyDown={event => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 4 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % 5 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index + 4) % 5 : -1;
          if (next < 0) return;
          event.preventDefault(); onQuestionChange(keys[next], next); refs.current[next]?.focus();
        }}><span className={home.assetQuestionBubble}>{String(index + 1).padStart(2, '0')}</span></button>)}
    </div>}
    <article id="audience-demo" role={showRegister ? 'region' : 'tabpanel'}
      aria-label={showRegister ? `${audience} example overview` : undefined}
      aria-labelledby={showRegister ? undefined : `preview-tab-${activeQuestion}`}
      className={`${home.assetPreviewCard} ${styles.card}`}
      onFocusCapture={() => onInteraction?.('focus')}>
      <header className={styles.header}><div><span className={styles.eyebrow}>Aim4price · {dealer ? 'Dealer' : 'Business'}</span><h2>{title}</h2></div><span className={styles.example}>Example</span></header>
      <div key={active} className={styles.body}>
        {active === 'worth' && <>
          <div className={styles.asset}><span className={styles.monogram}>JD</span><div><h3>John Deere 6155M</h3><p>Tractor · 2019 · 4,200 hours</p></div></div>
          <div className={styles.value}><span>Illustrative estimated value</span><strong>R 1,250,000</strong><small>Review condition, usage and specifications</small></div>
          <div className={styles.chips}><span>Asset details</span><span>Usage</span><span>Condition</span></div>
          <p className={styles.note}>An indicative starting point for a better conversation.</p>
        </>}
        {active === 'have' && <>
          <div className={styles.stats}><div><strong>{dealer ? '12' : '8'}</strong><span>{dealer ? 'Stock assets' : 'Shared assets'}</span></div><div><strong>{dealer ? '6' : '3'}</strong><span>{dealer ? 'Client shares' : 'Clients'}</span></div></div>
          <div className={styles.list}>{[['JD', 'John Deere 6155M', dealer ? 'Dealer stock' : 'Shared by client'], ['TH', 'Toyota Hilux 2.8 GD-6', 'Shared by client'], ['NH', 'New Holland T7', 'Shared by client']].map(([initial, name, status]) => <div className={styles.row} key={name}><span className={styles.monogram}>{initial}</span><div><strong>{name}</strong><small>{status}</small></div><span className={styles.dot} /></div>)}</div>
          <p className={styles.note}>{dealer ? 'Your stock and client-shared assets stay distinct.' : 'The client decides which assets and details to share.'}</p>
        </>}
        {active === 'manage' && <>
          <div className={styles.asset}><span className={styles.monogram}>JD</span><div><h3>One asset. More context.</h3><p>Information shared by the owner</p></div></div>
          <div className={styles.tiles}>{[['Asset details', 'Model, age and usage'], ['Photos', 'See the asset clearly'], ['Documents', 'Supporting information'], ['History', 'Available maintenance records']].map(([name, description], index) => <div key={name}><span className={styles.tileNumber}>0{index + 1}</span><strong>{name}</strong><small>{description}</small></div>)}</div>
          <p className={styles.note}>Only information covered by the owner’s permissions.</p>
        </>}
        {active === 'cost' && (dealer ? <>
          <div className={styles.showroom}><span className={styles.eyebrow}>Your showroom</span><h3>Ready for its next owner.</h3><p>Clear photos. Useful details. A professional presentation.</p><div className={styles.showroomAsset}>John Deere 6155M <span>2019 · 4,200 hours</span></div></div>
          <div className={styles.chips}><span>Stock presentation</span><span>Ad Studio</span></div><p className={styles.note}>Prepare your material, review it, then share it.</p>
        </> : <>
          <div className={styles.asset}><span className={styles.monogram}>JD</span><div><h3>Keep the work connected.</h3><p>John Deere 6155M · Shared asset</p></div></div>
          <div className={styles.timeline}><div><span>01</span><section><strong>Work recorded</strong><p>Service notes linked to this asset</p></section></div><div><span>02</span><section><strong>Supporting document</strong><p>A useful record for the client</p></section></div><div><span>03</span><section><strong>History updated</strong><p>Context for the next conversation</p></section></div></div><p className={styles.note}>Contributions depend on the access the owner grants.</p>
        </>)}
        {active === 'attention' && <>
          <div className={styles.relationship}><span className={styles.eyebrow}>An ongoing relationship</span><h3>{dealer ? 'Beyond the handover.' : 'Ready for the next conversation.'}</h3><p>A shared record that stays connected to the asset.</p></div>
          <div className={styles.list}>{['Shared asset information', dealer ? 'Maintenance and cost contributions' : 'Available service history', 'Owner-controlled access'].map((text, index) => <div className={styles.row} key={text}><span className={styles.step}>{index + 1}</span><strong>{text}</strong></div>)}</div>
        </>}
      </div>
      <footer className={styles.footer}>Illustrative preview · No live client data</footer>
    </article>
  </div>;
}
function DealerPreview(props: HomePreviewProps) { return <DemoCard {...props} audience="dealers" />; }
function BusinessPreview(props: HomePreviewProps) { return <DemoCard {...props} audience="businesses" />; }

export default function AudienceHome({ audience }: { audience: HomeAudience }) {
  return <div className={styles.scope}><HomeHeroExperience variant={homeStories[audience]} Preview={audience === 'dealers' ? DealerPreview : BusinessPreview} /></div>;
}
