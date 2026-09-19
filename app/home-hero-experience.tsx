'use client';

import { currentWebsiteScale } from '../lib/website-canvas';
import { attachHomeStorySwipe } from '../lib/home-story-swipe';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import HomeAssetPreview, { type QuestionKey } from './home-asset-preview';
import styles from './page.module.css';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FEATURE_START_INDEX = 3;
const OPENING_TAGLINE = ['Asset Management Software', 'built for South Africa.'] as const;

// Leave time to read both feature paragraphs before the next automatic card.
export const HERO_FEATURE_DURATION_MS = 10000;

export const HERO_STAGES: readonly QuestionKey[] = [
  'worth',
  'have',
  'manage',
  'cost',
  'attention',
];

export const HERO_STORY_STEPS = [
  'brand',
  'promise',
  'preview',
  ...HERO_STAGES,
] as const;

type StoryStep = (typeof HERO_STORY_STEPS)[number];

type FeatureStory = {
  title: string;
  titleLines?: readonly [string, string];
  body: string;
  detail: string;
};

const STORY_DURATIONS: Readonly<Record<StoryStep, number>> = {
  brand: 5200,
  promise: 4800,
  preview: 3600,
  have: HERO_FEATURE_DURATION_MS,
  worth: HERO_FEATURE_DURATION_MS,
  cost: HERO_FEATURE_DURATION_MS,
  manage: HERO_FEATURE_DURATION_MS,
  attention: HERO_FEATURE_DURATION_MS,
};

const FEATURE_STORIES: Readonly<Record<QuestionKey, FeatureStory>> = {
  worth: {
    title: 'Add your assets.',
    body: 'Add your vehicles, machinery and equipment through Get Estimate or manually. Get an indicative estimate or enter a value you already have, then review it to make sure it makes sense for the asset.',
    detail: 'Save the asset to your register to start keeping its details, documents, maintenance and costs together. You can update its information as things change.',
  },
  have: {
    title: 'Follow their changing value.',
    body: 'Bring your assets together in a register that changes with them. Automatic depreciation reflects the passing of time, while updated usage helps adjust estimated values as assets work more.',
    detail: 'Keep photos, documents, serial numbers and key details connected to each asset. Group assets into umbrellas, see their combined value and share a current record when you need it.',
  },
  manage: {
    title: 'Manage each asset in one place.',
    titleLines: ['Manage each asset', 'in one place.'],
    body: 'Update asset details, refresh values, record fuel and expenses, and set budgets from one place. Keep the supporting photos and documents with the asset they belong to.',
    detail: 'Access reports, share records, print a QR label or view the asset on a map. Prepare a Marketplace listing when it is time to sell.',
  },
  cost: {
    title: 'Know what ownership costs.',
    body: 'Understand the money going into each asset. Keep fuel, servicing, repairs and other expenses linked to the right asset, and compare spending with its budgets.',
    detail: 'Use fuel, maintenance and cost-of-ownership reports to review spending over time and build a clearer picture of what each asset costs to keep.',
  },
  attention: {
    title: 'Keep maintenance on track.',
    titleLines: ['Keep maintenance', 'on track.'],
    body: 'See what needs attention, what work has been completed and what is due next. Follow reported problems and maintenance updates directly on the asset record.',
    detail: 'Schedule services, use equipment-specific checklists and keep repair notes and maintenance history together. See who recorded the work and when it was done.',
  },
};

const clampStoryIndex = (index: number) =>
  Math.max(0, Math.min(HERO_STORY_STEPS.length - 1, index));

export default function HomeHeroExperience() {
  const [storyStepIndex, setStoryStepIndex] = useState(0);
  const [typedCount, setTypedCount] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey>('worth');
  const [canAutoplay, setCanAutoplay] = useState(false);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isDesktopStory, setIsDesktopStory] = useState(true);
  const [isManuallyControlled, setIsManuallyControlled] = useState(false);
  const [hasAutoplayFinished, setHasAutoplayFinished] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const storyGridRef = useRef<HTMLDivElement | null>(null);
  const assetMotionRef = useRef<HTMLDivElement | null>(null);
  const narrativeRef = useRef<HTMLElement | null>(null);
  const storyStepRef = useRef(0);
  const autoplayFinishedRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const scrollClaimRef = useRef(false);

  const updateStoryStep = useCallback((nextIndex: number) => {
    const safeIndex = clampStoryIndex(nextIndex);
    storyStepRef.current = safeIndex;
    setStoryStepIndex(safeIndex);

    if (safeIndex >= FEATURE_START_INDEX) {
      const questionIndex = safeIndex - FEATURE_START_INDEX;
      setActiveQuestion(HERO_STAGES[questionIndex] ?? 'worth');
    } else {
      setActiveQuestion('worth');
    }
  }, []);

  const finishAutoplay = useCallback(() => {
    autoplayFinishedRef.current = true;
    setHasAutoplayFinished(true);
    setIsAutoplaying(false);
    setIsPaused(false);
    updateStoryStep(0);
  }, [updateStoryStep]);

  const claimManualControl = useCallback(() => {
    setIsManuallyControlled(true);
    setIsAutoplaying(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);

    const syncStoryCapability = () => {
      const supportsStory = !reducedMotionMedia.matches;
      setCanAutoplay(supportsStory);
      setIsDesktopStory(supportsStory);

      if (!supportsStory) {
        setIsAutoplaying(false);
        setIsManuallyControlled(true);
        updateStoryStep(FEATURE_START_INDEX);
      }
    };

    syncStoryCapability();
    reducedMotionMedia.addEventListener('change', syncStoryCapability);

    return () => {
      reducedMotionMedia.removeEventListener('change', syncStoryCapability);
    };
  }, [updateStoryStep]);

  useEffect(() => {
    const syncVisibility = () => setIsPageVisible(!document.hidden);

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);

    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !('IntersectionObserver' in window)) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry?.isIntersecting ?? true),
      { threshold: 0.12 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      !canAutoplay ||
      !isPageVisible ||
      !isHeroVisible ||
      isPaused ||
      isManuallyControlled ||
      hasAutoplayFinished
    ) {
      setIsAutoplaying(false);
      return undefined;
    }

    const storyStep = HERO_STORY_STEPS[storyStepIndex] ?? HERO_STORY_STEPS[0];
    setIsAutoplaying(true);

    const timer = window.setTimeout(() => {
      if (autoplayFinishedRef.current) return;

      if (storyStepIndex >= HERO_STORY_STEPS.length - 1) {
        finishAutoplay();
        return;
      }

      updateStoryStep(storyStepIndex + 1);
    }, STORY_DURATIONS[storyStep]);

    return () => window.clearTimeout(timer);
  }, [
    canAutoplay,
    finishAutoplay,
    hasAutoplayFinished,
    isManuallyControlled,
    isHeroVisible,
    isPageVisible,
    isPaused,
    storyStepIndex,
    updateStoryStep,
  ]);

  useEffect(() => {
    if (!isDesktopStory) return undefined;

    const scheduleStorySync = (claimControl: boolean) => {
      if (claimControl) autoplayFinishedRef.current = true;
      scrollClaimRef.current = scrollClaimRef.current || claimControl;
      if (scrollFrameRef.current !== null) return;

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;

        const shouldClaimControl = scrollClaimRef.current;
        scrollClaimRef.current = false;

        const section = sectionRef.current;
        const sticky = stickyRef.current;
        if (!section || !sticky) return;

        const currentScrollY = window.scrollY;
        const sectionRect = section.getBoundingClientRect();
        const stickyRect = sticky.getBoundingClientRect();
        const sectionTop = currentScrollY + sectionRect.top;
        const stickyTop =
          (Number.parseFloat(window.getComputedStyle(sticky).top) || 0) * currentWebsiteScale();
        const trackStart = sectionTop - stickyTop;
        // Use rendered geometry rather than offsetHeight. CSS `zoom` changes
        // the physical scroll distance but offsetHeight remains unzoomed,
        // which otherwise makes later story stages unreachable when zoomed
        // out and finish too early when zoomed in.
        const trackTravel = Math.max(
          1,
          sectionRect.height - stickyRect.height,
        );
        const localScroll = Math.max(
          0,
          Math.min(trackTravel, currentScrollY - trackStart),
        );
        const progress = localScroll / trackTravel;
        const nextIndex = clampStoryIndex(
          Math.floor(progress * HERO_STORY_STEPS.length),
        );

        if (nextIndex !== storyStepRef.current) updateStoryStep(nextIndex);

        if (shouldClaimControl) {
          setHasAutoplayFinished(true);
          setIsManuallyControlled(true);
          setIsPaused(false);
          setIsAutoplaying(false);
        }
      });
    };

    const handleScroll = () => {
      scheduleStorySync(true);
    };
    const handleResize = () => {
      if (autoplayFinishedRef.current || window.scrollY > 4) {
        scheduleStorySync(window.scrollY > 4);
      }
    };
    const handlePageShow = () => scheduleStorySync(window.scrollY > 4);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('aim4price:canvas-geometry', handleResize);
    window.addEventListener('pageshow', handlePageShow);

    if (window.scrollY > 4) scheduleStorySync(true);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('aim4price:canvas-geometry', handleResize);
      window.removeEventListener('pageshow', handlePageShow);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      scrollClaimRef.current = false;
    };
  }, [isDesktopStory, updateStoryStep]);

  useEffect(() => {
    const storyGrid = storyGridRef.current;
    const assetMotion = assetMotionRef.current;
    if (!storyGrid || !assetMotion) return undefined;

    const measureAssetShift = () => {
      assetMotion.style.setProperty('--asset-stage-shift-x', `${-assetMotion.offsetLeft}px`);
      const narrative = narrativeRef.current;
      if (narrative) {
        const inset = parseFloat(getComputedStyle(narrative).getPropertyValue('--feature-copy-inset'));
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        narrative.style.setProperty('--narrative-stage-shift-x', `${-narrative.offsetLeft + inset * rem}px`);
      }
    };

    measureAssetShift();
    window.addEventListener('resize', measureAssetShift);

    return () => window.removeEventListener('resize', measureAssetShift);
  }, [isDesktopStory, storyStepIndex]);

  useEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky) return undefined;

    return attachHomeStorySwipe(sticky, (direction) => {
      const section = sectionRef.current;
      if (!section) return;
      const nextIndex = Math.max(
        isDesktopStory ? 0 : FEATURE_START_INDEX,
        clampStoryIndex(storyStepRef.current + direction),
      );
      autoplayFinishedRef.current = true;
      setHasAutoplayFinished(true);
      claimManualControl();
      updateStoryStep(nextIndex);

      if (!isDesktopStory) return;
      // Keep native vertical scrolling aligned with the selected card. Use the
      // middle of its scroll interval to avoid rounding into a neighbouring step.
      const sectionRect = section.getBoundingClientRect();
      const stickyTop = (parseFloat(getComputedStyle(sticky).top) || 0) * currentWebsiteScale();
      const trackStart = window.scrollY + sectionRect.top - stickyTop;
      const travel = Math.max(1, sectionRect.height - sticky.getBoundingClientRect().height);
      window.scrollTo({
        top: Math.max(0, trackStart + travel * ((nextIndex + 0.5) / HERO_STORY_STEPS.length)),
        behavior: 'instant',
      });
    });
  }, [claimManualControl, isDesktopStory, updateStoryStep]);

  useEffect(() => {
    const length = OPENING_TAGLINE.join('').length;
    if (!canAutoplay || storyStepIndex !== 0 || isPaused || !isPageVisible || !isHeroVisible || typedCount >= length) return;
    const timer = window.setTimeout(() => setTypedCount((count) => Math.min(count + 1, length)), typedCount === 0 ? 250 : 45);
    return () => window.clearTimeout(timer);
  }, [canAutoplay, storyStepIndex, isPaused, isPageVisible, isHeroVisible, typedCount]);

  const handleQuestionChange = (question: QuestionKey, index: number) => {
    claimManualControl();
    setActiveQuestion(question);
    updateStoryStep(FEATURE_START_INDEX + index);
  };

  const handlePreviewInteraction = (source: 'pointer' | 'focus') => {
    if (source === 'focus') claimManualControl();
  };

  const handleRoleSkip = () => {
    claimManualControl();
  };

  const handleScrollCue = () => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return;

    claimManualControl();
    const stickyTop = (parseFloat(getComputedStyle(sticky).top) || 0) * currentWebsiteScale();
    const trackStart = window.scrollY + section.getBoundingClientRect().top - stickyTop;
    const travel = Math.max(1, section.getBoundingClientRect().height - sticky.getBoundingClientRect().height);
    window.scrollTo({
      top: Math.max(0, trackStart + travel * (1.25 / HERO_STORY_STEPS.length)),
      behavior: 'smooth',
    });
  };

  const handleStoryFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-story-pause-control]')) return;

    claimManualControl();
  };

  const storyStep = HERO_STORY_STEPS[storyStepIndex] ?? HERO_STORY_STEPS[0];
  const storyMode =
    storyStepIndex < 2 ? 'opening' : storyStepIndex === 2 ? 'preview' : 'features';

  return (
    <section
      ref={sectionRef}
      className={styles.heroSection}
      aria-labelledby="home-hero-title"
      data-story-step={storyStep}
      data-motion-paused={isPaused ? 'true' : 'false'}
      data-story-mode={storyMode}
      data-active-question={activeQuestion}
      data-card-side={activeQuestion === 'have' || activeQuestion === 'cost' ? 'right' : 'left'}
      data-autoplay={
        isAutoplaying && storyStepIndex >= FEATURE_START_INDEX ? 'true' : 'false'
      }
    >
      <h1 id="home-hero-title" className={styles.heroA11yTitle}>
        Aim4price.com asset management software built for South Africa
      </h1>

      <div className={styles.heroStory}>
        <div
          ref={stickyRef}
          className={[styles.heroMedia, styles.heroSticky].join(' ')}
        >
          <div className={styles.shell}>
            <div
              ref={storyGridRef}
              className={styles.storyHeroGrid}
              onFocusCapture={handleStoryFocus}
            >
              <div className={styles.heroCopyDeck}>
                <div
                  className={[styles.storyCopyLayer, styles.heroBrandCopy].join(' ')}
                  aria-hidden="true"
                >
                  <p className={styles.heroBrandTitle}>
                    <span>
                      Aim4price.com
                      <span className={styles.openingProgress} aria-hidden="true">
                        {isDesktopStory && storyStep === 'brand' && isAutoplaying &&
                          !isPaused && !isManuallyControlled && !hasAutoplayFinished &&
                          isHeroVisible && isPageVisible ? (
                          <span className={styles.openingProgressFill} style={{ animationDuration: `${STORY_DURATIONS.brand}ms` }} />
                        ) : null}
                      </span>
                    </span>
                    {OPENING_TAGLINE.map((line, lineIndex) => (
                      <span key={line} className={styles.typedLine}>
                        <span className={styles.typedReserve}>{line}</span>
                        <span className={styles.typedText}>{isDesktopStory
                          ? line.slice(0, Math.max(0, typedCount - (lineIndex ? OPENING_TAGLINE[0].length : 0)))
                          : line}</span>
                      </span>
                    ))}
                  </p>
                </div>

                <div
                  className={[styles.storyCopyLayer, styles.heroPromiseCopy].join(' ')}
                  aria-hidden={storyStepIndex !== 1 && storyStepIndex !== 2}
                >
                  <p className={styles.heroPromiseTitle}>
                    <span>Know what you have.</span>
                    <span>Know what it’s worth.</span>
                    <span>Know what it costs.</span>
                  </p>

                  <p className={styles.heroPromiseText}>
                    Manage your vehicles, machinery and equipment in one place. Keep asset details,
                    estimated values, documents, maintenance, budgets and costs connected to individual assets.
                  </p>

                  <div className={styles.heroActions}>
                    <a
                      href="#choose-role"
                      className={styles.primaryCta}
                      onClick={handleRoleSkip}
                    >
                      Get started
                    </a>
                    <Link href="/valuation" className={styles.secondaryCta}>
                      Get a Free Estimate
                    </Link>
                  </div>
                </div>
              </div>

              <div className={styles.storyHeroLogo} aria-hidden="true">
                <Image
                  src="/brand/aim4price-mark-black.png"
                  alt=""
                  width={660}
                  height={515}
                  unoptimized
                  className={styles.storyHeroLogoImage}
                  priority
                />
              </div>

              <div ref={assetMotionRef} className={styles.assetStageMotion}>
                <HomeAssetPreview
                  showRegister={storyStepIndex < FEATURE_START_INDEX}
                  activeQuestion={activeQuestion}
                  onQuestionChange={handleQuestionChange}
                  onInteraction={handlePreviewInteraction}
                />
              </div>

              <aside
                ref={narrativeRef}
                className={styles.featureNarrative}
                aria-label="What Aim4price helps you do"
              >
                {HERO_STAGES.map((question) => {
                  const feature = FEATURE_STORIES[question];
                  const isActive = question === activeQuestion;

                  return (
                    <div
                      key={question}
                      className={styles.featureNarrativeLayer}
                      data-active={isActive ? 'true' : 'false'}
                      aria-hidden={!isActive || storyMode !== 'features'}
                    >
                      <p className={styles.featureNarrativeCount} aria-hidden="true">
                        <strong>{HERO_STAGES.indexOf(question) + 1}</strong>
                        <span>/ 5</span>
                      </p>
                      <h2 className={feature.titleLines ? styles.featureNarrativeFixedTitle : undefined}>
                        {feature.titleLines
                          ? <>{feature.titleLines[0]}<br />{feature.titleLines[1]}</>
                          : feature.title}
                      </h2>
                      <div className={styles.featureNarrativeCopy}>
                        <p>{feature.body}</p>
                        <p>{feature.detail}</p>
                      </div>
                    </div>
                  );
                })}


              </aside>

              <div className={styles.compactHeroActions}>
                <a
                  href="#choose-role"
                  className={styles.primaryCta}
                  onClick={handleRoleSkip}
                >
                  Get started
                </a>
                <Link href="/valuation" className={styles.secondaryCta}>
                  Get a Free Estimate
                </Link>
              </div>

              {isDesktopStory &&
                !isManuallyControlled &&
                !hasAutoplayFinished ? (
                <button
                  type="button"
                  className={styles.storyPauseControl}
                  data-story-pause-control
                  aria-pressed={isPaused}
                  onClick={() => setIsPaused((current) => !current)}
                >
                  {isPaused ? 'Continue animation' : 'Pause animation'}
                </button>
              ) : null}
            </div>
          </div>
          {isDesktopStory && storyStep === 'brand' ? (
            <button
              type="button"
              className={styles.storyScrollCue}
              aria-label="Scroll down to explore Aim4price"
              onClick={handleScrollCue}
            >
              <span className={styles.scrollCueLabel}>Scroll to explore</span>
              <svg width="30" height="48" viewBox="0 0 30 48" fill="none" aria-hidden="true">
                <rect x="3" y="2" width="24" height="44" rx="12" stroke="currentColor" strokeWidth="2" />
                <path className={styles.scrollMouseWheel} d="M15 10v6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}

        </div>
      </div>
    </section>
  );
}
