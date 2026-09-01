'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import HomeAssetPreview, { type QuestionKey } from './home-asset-preview';
import styles from './page.module.css';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DESKTOP_STORY_QUERY = '(min-width: 1181px)';

type HeroStage = {
  key: QuestionKey;
  titleLines: readonly [string, string];
  description: string;
};

export const HERO_STAGES: readonly HeroStage[] = [
  {
    key: 'have',
    titleLines: ['Everything you own.', 'One living record.'],
    description: 'Know what you have, where it is and whether its record is complete.',
  },
  {
    key: 'worth',
    titleLines: ['Know what it’s worth.', 'At every stage.'],
    description: 'Follow its value over time and keep a clear valuation report ready.',
  },
  {
    key: 'manage',
    titleLines: ['Manage every asset.', 'From one place.'],
    description: 'Update records, capture costs, schedule maintenance, map, share or sell.',
  },
  {
    key: 'cost',
    titleLines: ['Know what every asset', 'really costs.'],
    description: 'Bring fuel, maintenance, repairs and ownership costs into one clear view.',
  },
  {
    key: 'attention',
    titleLines: ['See what needs attention.', 'Before it costs you.'],
    description: 'Spot open issues, expired items and upcoming maintenance early.',
  },
];

export default function HomeHeroExperience() {
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey>('have');
  const [isDesktopStory, setIsDesktopStory] = useState(false);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const desktopStoryMedia = window.matchMedia(DESKTOP_STORY_QUERY);

    const syncMediaPreferences = () => {
      setIsDesktopStory(
        desktopStoryMedia.matches
          && !reducedMotionMedia.matches
          && 'IntersectionObserver' in window,
      );
    };

    syncMediaPreferences();
    reducedMotionMedia.addEventListener('change', syncMediaPreferences);
    desktopStoryMedia.addEventListener('change', syncMediaPreferences);

    return () => {
      reducedMotionMedia.removeEventListener('change', syncMediaPreferences);
      desktopStoryMedia.removeEventListener('change', syncMediaPreferences);
    };
  }, []);

  useEffect(() => {
    if (!isDesktopStory) return undefined;

    const intersectionRatios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersectionRatios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        const visibleStep = stepRefs.current
          .filter((step): step is HTMLDivElement => Boolean(step))
          .filter((step) => (intersectionRatios.get(step) ?? 0) > 0)
          .sort((left, right) => {
            const ratioDifference =
              (intersectionRatios.get(right) ?? 0) - (intersectionRatios.get(left) ?? 0);

            if (ratioDifference !== 0) return ratioDifference;

            const viewportMiddle = window.innerHeight / 2;
            const leftRect = left.getBoundingClientRect();
            const rightRect = right.getBoundingClientRect();
            const leftDistance = Math.abs(leftRect.top + leftRect.height / 2 - viewportMiddle);
            const rightDistance = Math.abs(rightRect.top + rightRect.height / 2 - viewportMiddle);
            return leftDistance - rightDistance;
          })[0];

        const nextQuestion = visibleStep?.dataset.heroStage as QuestionKey | undefined;
        if (nextQuestion) setActiveQuestion(nextQuestion);
      },
      {
        root: null,
        rootMargin: '-44% 0px -44% 0px',
        threshold: [0, 0.01, 0.5, 1],
      },
    );

    stepRefs.current.forEach((step) => {
      if (step) observer.observe(step);
    });

    return () => observer.disconnect();
  }, [isDesktopStory]);

  const activeStage = HERO_STAGES.find(({ key }) => key === activeQuestion) ?? HERO_STAGES[0]!;

  const handleQuestionChange = (question: QuestionKey, index: number) => {
    setActiveQuestion(question);

    if (!isDesktopStory) return;

    stepRefs.current[index]?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    });
  };

  return (
    <section
      className={styles.heroSection}
      aria-labelledby="home-hero-title"
      data-active-question={activeQuestion}
    >
      <div className={styles.heroStory}>
        <div className={`${styles.heroMedia} ${styles.heroSticky}`}>
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <div key={activeStage.key} className={styles.heroCopyState}>
                  <h1 id="home-hero-title" className={styles.heroTitle}>
                    {activeStage.titleLines.map((line) => (
                      <span key={line} className={styles.heroTitleLine}>
                        {line}
                      </span>
                    ))}
                  </h1>

                  <p className={styles.heroText}>{activeStage.description}</p>
                </div>

                <div className={styles.heroSupport}>
                  <div className={styles.heroActions}>
                    <Link href="/valuation" className={styles.primaryCta}>
                      Get Free Estimate
                    </Link>
                    <a href="#choose-role" className={styles.secondaryCta}>
                      See How It Works
                    </a>
                  </div>

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

        <div className={styles.heroScrollTrack} aria-hidden="true">
          {HERO_STAGES.map((stage, index) => (
            <div
              key={stage.key}
              ref={(element) => {
                stepRefs.current[index] = element;
              }}
              className={styles.heroScrollStep}
              data-hero-stage={stage.key}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
