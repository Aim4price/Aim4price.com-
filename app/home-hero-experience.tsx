'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import HomeAssetPreview, { type QuestionKey } from './home-asset-preview';
import styles from './page.module.css';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const HERO_AUTOPLAY_DELAY_MS = 1000;
export const HERO_STAGE_DURATION_MS = 2800;

export const HERO_STAGES: readonly QuestionKey[] = [
  'have',
  'worth',
  'cost',
  'manage',
  'attention',
];

export default function HomeHeroExperience() {
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey>('have');
  const [canAutoplay, setCanAutoplay] = useState(false);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [playbackId, setPlaybackId] = useState(0);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);

    const syncMotionPreference = () => {
      const shouldAutoplay = !reducedMotionMedia.matches;
      setCanAutoplay(shouldAutoplay);

      if (!shouldAutoplay) setIsAutoplaying(false);
    };

    syncMotionPreference();
    reducedMotionMedia.addEventListener('change', syncMotionPreference);

    return () => reducedMotionMedia.removeEventListener('change', syncMotionPreference);
  }, []);

  useEffect(() => {
    if (!canAutoplay || hasAutoStarted.current) return undefined;

    const startTimer = window.setTimeout(() => {
      if (hasAutoStarted.current) return;

      hasAutoStarted.current = true;
      setActiveQuestion('have');
      setIsAutoplaying(true);
    }, HERO_AUTOPLAY_DELAY_MS);

    return () => window.clearTimeout(startTimer);
  }, [canAutoplay]);

  useEffect(() => {
    if (!canAutoplay || !isAutoplaying) return undefined;

    const activeIndex = HERO_STAGES.indexOf(activeQuestion);
    const stageTimer = window.setTimeout(() => {
      if (activeIndex >= HERO_STAGES.length - 1) {
        setIsAutoplaying(false);
        return;
      }

      setActiveQuestion(HERO_STAGES[activeIndex + 1]!);
    }, HERO_STAGE_DURATION_MS);

    return () => window.clearTimeout(stageTimer);
  }, [activeQuestion, canAutoplay, isAutoplaying, playbackId]);

  const handleQuestionChange = (question: QuestionKey, _index: number) => {
    hasAutoStarted.current = true;
    setIsAutoplaying(false);
    setActiveQuestion(question);
  };

  const handleReplay = () => {
    hasAutoStarted.current = true;
    setActiveQuestion('have');
    setPlaybackId((currentId) => currentId + 1);
    setIsAutoplaying(canAutoplay);
  };

  return (
    <section
      className={styles.heroSection}
      aria-labelledby="home-hero-title"
      data-active-question={activeQuestion}
      data-autoplay={isAutoplaying ? 'true' : 'false'}
    >
      <div className={styles.heroStory}>
        <div className={[styles.heroMedia, styles.heroSticky].join(' ')}>
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <div className={styles.heroCopyState}>
                  <p className={styles.heroPlatformLabel}>One living record per asset</p>

                  <h1 id="home-hero-title" className={styles.heroTitle}>
                    <span className={styles.heroTitleLine}>Know what you have.</span>
                    <span className={styles.heroTitleLine}>Know what it’s worth.</span>
                    <span className={styles.heroTitleLine}>Know what it costs.</span>
                  </h1>

                  <p className={styles.heroText}>
                    Aim4price gives every important asset one living digital record—connecting
                    its identity, indicative value, documents, maintenance, fuel, costs and
                    history throughout its working life.
                  </p>
                </div>

                <div className={styles.heroSupport}>
                  <div className={styles.heroActions}>
                    <button type="button" className={styles.primaryCta} onClick={handleReplay}>
                      See Aim4price in Action
                    </button>
                    <Link href="/valuation" className={styles.secondaryCta}>
                      Get a Free Estimate
                    </Link>
                  </div>

                  <a href="#choose-role" className={styles.heroAudienceCta}>
                    Choose how you’ll use Aim4price
                    <span aria-hidden="true">→</span>
                  </a>

                  <p className={styles.heroSectors}>
                    <span>Agriculture</span>
                    <span>Construction</span>
                    <span>Industrial</span>
                    <span>Motor</span>
                  </p>
                </div>
              </div>

              <HomeAssetPreview
                activeQuestion={activeQuestion}
                onQuestionChange={handleQuestionChange}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
