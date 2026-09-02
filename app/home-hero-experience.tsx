'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from 'react';
import HomeAssetPreview, { type QuestionKey } from './home-asset-preview';
import styles from './page.module.css';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DESKTOP_STORY_QUERY = '(min-width: 1181px) and (min-height: 640px)';
const PROMISE_STEP_INDEX = 1;
const FEATURE_START_INDEX = 3;

export const HERO_FEATURE_DURATION_MS = 4800;
export const HERO_STORY_SCROLL_RATIO = 0.32;

export const HERO_STAGES: readonly QuestionKey[] = [
  'have',
  'worth',
  'cost',
  'manage',
  'attention',
];

export const HERO_STORY_STEPS = [
  'brand',
  'promise',
  'preview',
  ...HERO_STAGES,
] as const;

type StoryStep = (typeof HERO_STORY_STEPS)[number];

type StoryStyle = CSSProperties & {
  '--hero-story-height'?: string;
};

type FeatureStory = {
  eyebrow: string;
  title: string;
  body: string;
};

const STORY_DURATIONS: Readonly<Record<StoryStep, number>> = {
  brand: 3800,
  promise: 4800,
  preview: 3600,
  have: HERO_FEATURE_DURATION_MS,
  worth: HERO_FEATURE_DURATION_MS,
  cost: HERO_FEATURE_DURATION_MS,
  manage: HERO_FEATURE_DURATION_MS,
  attention: HERO_FEATURE_DURATION_MS,
};

const FEATURE_STORIES: Readonly<Record<QuestionKey, FeatureStory>> = {
  have: {
    eyebrow: 'Know what you have',
    title: 'One complete record for every asset.',
    body:
      'Keep its identity, serial or VIN, specifications, photos, documents, condition and last-known location together, so you always know what belongs where.',
  },
  worth: {
    eyebrow: 'Know what it’s worth',
    title: 'Understand what it’s worth.',
    body:
      'Create an indicative estimate from year, usage, condition and replacement context, then keep valuation changes and depreciation history visible.',
  },
  cost: {
    eyebrow: 'Know what it really costs',
    title: 'See what it really costs.',
    body:
      'Connect invoices, repairs, parts, fuel and recurring commitments to the asset that caused them, with budgets and supporting evidence.',
  },
  manage: {
    eyebrow: 'Manage its working life',
    title: 'Manage its entire working life.',
    body:
      'Update details, plan maintenance, capture work and usage, organise documents and carry the same record through listing, disposal or transfer.',
  },
  attention: {
    eyebrow: 'See what needs attention',
    title: 'Bring the next action forward.',
    body:
      'Surface overdue maintenance, licence and document dates, budget pressure and reported problems before important work is missed.',
  },
};

const clampStoryIndex = (index: number) =>
  Math.max(0, Math.min(HERO_STORY_STEPS.length - 1, index));

export default function HomeHeroExperience() {
  const [storyStepIndex, setStoryStepIndex] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey>('have');
  const [canAutoplay, setCanAutoplay] = useState(false);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isDesktopStory, setIsDesktopStory] = useState(true);
  const [isManuallyControlled, setIsManuallyControlled] = useState(false);
  const [isScrollDriven, setIsScrollDriven] = useState(false);
  const [hasAutoplayFinished, setHasAutoplayFinished] = useState(false);
  const [isStoryComplete, setIsStoryComplete] = useState(false);
  const [storyHeightPx, setStoryHeightPx] = useState<number | null>(null);

  const sectionRef = useRef<HTMLElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const storyGridRef = useRef<HTMLDivElement | null>(null);
  const assetMotionRef = useRef<HTMLDivElement | null>(null);
  const storyStepRef = useRef(0);
  const autoplayFinishedRef = useRef(false);
  const storyCompleteRef = useRef(false);
  const scrollAnchorRef = useRef<{ scrollY: number; stepIndex: number } | null>(null);
  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const roleAlignmentFrameRef = useRef<number | null>(null);

  const updateStoryStep = useCallback((nextIndex: number) => {
    const safeIndex = clampStoryIndex(nextIndex);
    storyStepRef.current = safeIndex;
    setStoryStepIndex(safeIndex);

    if (safeIndex >= FEATURE_START_INDEX) {
      const questionIndex = safeIndex - FEATURE_START_INDEX;
      setActiveQuestion(HERO_STAGES[questionIndex] ?? 'have');
    } else {
      setActiveQuestion('have');
    }
  }, []);

  const finishAutoplay = useCallback(() => {
    autoplayFinishedRef.current = true;
    scrollAnchorRef.current = null;
    lastScrollYRef.current = window.scrollY;
    setHasAutoplayFinished(true);
    setIsAutoplaying(false);
    setIsPaused(false);
    setIsScrollDriven(false);
    updateStoryStep(PROMISE_STEP_INDEX);
  }, [updateStoryStep]);

  const completeStory = useCallback((collapseFromStart = false) => {
    if (storyCompleteRef.current) return;

    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (section && sticky) {
      const sectionTop = window.scrollY + section.getBoundingClientRect().top;
      const localScroll = collapseFromStart
        ? 0
        : Math.max(0, window.scrollY - sectionTop);
      const stickyTop = Number.parseFloat(window.getComputedStyle(sticky).top) || 0;
      setStoryHeightPx(
        Math.ceil(
          Math.max(
            sticky.offsetHeight + stickyTop,
            localScroll + sticky.offsetHeight + stickyTop,
          ),
        ),
      );
    }

    storyCompleteRef.current = true;
    setIsStoryComplete(true);
    setIsAutoplaying(false);
  }, []);

  const claimManualControl = useCallback(() => {
    setIsManuallyControlled(true);
    setIsAutoplaying(false);
    setIsPaused(false);
    scrollAnchorRef.current = null;
  }, []);

  const alignRoleSection = useCallback(() => {
    if (roleAlignmentFrameRef.current !== null) {
      window.cancelAnimationFrame(roleAlignmentFrameRef.current);
    }

    roleAlignmentFrameRef.current = window.requestAnimationFrame(() => {
      roleAlignmentFrameRef.current = null;
      document.getElementById('choose-role')?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      });
    });
  }, []);

  useEffect(
    () => () => {
      if (roleAlignmentFrameRef.current !== null) {
        window.cancelAnimationFrame(roleAlignmentFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const desktopStoryMedia = window.matchMedia(DESKTOP_STORY_QUERY);

    const syncStoryCapability = () => {
      const supportsStory = desktopStoryMedia.matches && !reducedMotionMedia.matches;
      setCanAutoplay(supportsStory);
      setIsDesktopStory(supportsStory);

      if (!supportsStory) {
        storyCompleteRef.current = true;
        setIsStoryComplete(true);
        setStoryHeightPx(null);
        setIsAutoplaying(false);
        setIsManuallyControlled(true);
        updateStoryStep(FEATURE_START_INDEX);
      }
    };

    syncStoryCapability();
    reducedMotionMedia.addEventListener('change', syncStoryCapability);
    desktopStoryMedia.addEventListener('change', syncStoryCapability);

    return () => {
      reducedMotionMedia.removeEventListener('change', syncStoryCapability);
      desktopStoryMedia.removeEventListener('change', syncStoryCapability);
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
    lastScrollYRef.current = window.scrollY;

    if (window.location.hash !== '#choose-role' && window.scrollY <= 4) return undefined;

    const roleWasTargeted = window.location.hash === '#choose-role';
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const sectionTop = section
      ? window.scrollY + section.getBoundingClientRect().top
      : 0;
    const sectionEnd =
      section && sticky
        ? sectionTop + section.offsetHeight - sticky.offsetHeight
        : Number.POSITIVE_INFINITY;
    const restoredBeyondStory = window.scrollY >= sectionEnd - 4;

    if (!roleWasTargeted && !restoredBeyondStory) {
      autoplayFinishedRef.current = true;
      setHasAutoplayFinished(true);
      setIsManuallyControlled(true);
      setIsScrollDriven(true);
      updateStoryStep(PROMISE_STEP_INDEX);
      scrollAnchorRef.current = {
        scrollY: window.scrollY,
        stepIndex: PROMISE_STEP_INDEX,
      };
      return undefined;
    }

    setIsManuallyControlled(true);
    updateStoryStep(FEATURE_START_INDEX);

    const frame = window.requestAnimationFrame(() => {
      completeStory(true);
      alignRoleSection();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [alignRoleSection, completeStory, updateStoryStep]);

  useEffect(() => {
    if (
      !canAutoplay ||
      !isPageVisible ||
      !isHeroVisible ||
      isPaused ||
      isManuallyControlled ||
      hasAutoplayFinished ||
      isStoryComplete
    ) {
      setIsAutoplaying(false);
      return undefined;
    }

    const storyStep = HERO_STORY_STEPS[storyStepIndex] ?? HERO_STORY_STEPS[0];
    setIsAutoplaying(true);

    const timer = window.setTimeout(() => {
      if (storyStepIndex >= HERO_STORY_STEPS.length - 1) {
        if (!autoplayFinishedRef.current) finishAutoplay();
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
    isStoryComplete,
    storyStepIndex,
    updateStoryStep,
  ]);

  useEffect(() => {
    if (!isDesktopStory || isStoryComplete) return undefined;

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) return;

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;

        const section = sectionRef.current;
        const sticky = stickyRef.current;
        if (!section || !sticky || storyCompleteRef.current) return;

        const currentScrollY = window.scrollY;
        const sectionTop = currentScrollY + section.getBoundingClientRect().top;
        const sectionEnd = sectionTop + section.offsetHeight - sticky.offsetHeight;
        const previousScrollY = lastScrollYRef.current;
        lastScrollYRef.current = currentScrollY;

        if (currentScrollY > sectionEnd + 4) {
          if (previousScrollY <= sectionEnd + 4) {
            completeStory(true);
            alignRoleSection();
          }
          return;
        }

        if (
          currentScrollY < sectionTop - 4 ||
          Math.abs(currentScrollY - previousScrollY) < 4
        ) {
          return;
        }

        if (!scrollAnchorRef.current) {
          scrollAnchorRef.current = {
            scrollY: previousScrollY,
            stepIndex: storyStepRef.current,
          };
          setIsManuallyControlled(true);
          setIsScrollDriven(true);
          setIsPaused(false);
          setIsAutoplaying(false);
        }

        const anchor = scrollAnchorRef.current;
        const stepDistance = Math.max(180, sticky.offsetHeight * HERO_STORY_SCROLL_RATIO);
        const distance = currentScrollY - anchor.scrollY;
        const stepDelta = Math.trunc(distance / stepDistance);
        const nextIndex = clampStoryIndex(anchor.stepIndex + stepDelta);

        if (nextIndex !== storyStepRef.current) updateStoryStep(nextIndex);

        const remainingSteps = HERO_STORY_STEPS.length - 1 - anchor.stepIndex;
        if (distance >= (remainingSteps + 1) * stepDistance) completeStory();
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [
    alignRoleSection,
    completeStory,
    isDesktopStory,
    isStoryComplete,
    updateStoryStep,
  ]);

  useEffect(() => {
    const storyGrid = storyGridRef.current;
    const assetMotion = assetMotionRef.current;
    if (!storyGrid || !assetMotion) return undefined;

    const measureAssetShift = () => {
      assetMotion.style.setProperty('--asset-stage-shift-x', `${-assetMotion.offsetLeft}px`);
    };

    measureAssetShift();
    window.addEventListener('resize', measureAssetShift);

    return () => window.removeEventListener('resize', measureAssetShift);
  }, [isDesktopStory, storyStepIndex]);

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
    completeStory();
  };

  const handleStoryFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-story-pause-control]')) return;

    claimManualControl();
  };

  const storyStep = HERO_STORY_STEPS[storyStepIndex] ?? HERO_STORY_STEPS[0];
  const storyMode =
    storyStepIndex < 2 ? 'opening' : storyStepIndex === 2 ? 'preview' : 'features';
  const storyStyle: StoryStyle | undefined =
    storyHeightPx === null
      ? undefined
      : { '--hero-story-height': `${storyHeightPx}px` };

  return (
    <section
      ref={sectionRef}
      className={styles.heroSection}
      aria-labelledby="home-hero-title"
      data-story-step={storyStep}
      data-story-mode={storyMode}
      data-story-complete={isStoryComplete ? 'true' : 'false'}
      data-scroll-driven={isScrollDriven ? 'true' : 'false'}
      data-autoplay-finished={hasAutoplayFinished ? 'true' : 'false'}
      data-active-question={activeQuestion}
      data-autoplay={
        isAutoplaying && storyStepIndex >= FEATURE_START_INDEX ? 'true' : 'false'
      }
    >
      <h1 id="home-hero-title" className={styles.heroA11yTitle}>
        Aim4price.com asset management software built for South Africa
      </h1>

      <div className={styles.heroStory} style={storyStyle}>
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
                    <span>Aim4price.com</span>
                    <span>Asset Management Software</span>
                    <span>built for South Africa.</span>
                  </p>
                </div>

                <div
                  className={[styles.storyCopyLayer, styles.heroPromiseCopy].join(' ')}
                  aria-hidden={storyStepIndex !== 1 && storyStepIndex !== 2}
                >
                  <p className={styles.heroPromiseTitle}>
                    <span>Know what you have.</span>
                    <span>Know what it’s worth.</span>
                    <span>Know what it really costs.</span>
                  </p>

                  <p className={styles.heroPromiseText}>
                    Aim4price gives every important asset one living record, connecting its
                    identity, indicative value, documents, maintenance, fuel and ownership costs.
                  </p>

                  <div className={styles.heroActions}>
                    <a
                      href="#choose-role"
                      className={styles.primaryCta}
                      onClick={handleRoleSkip}
                    >
                      See Aim4price in Action
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
                  className={styles.storyHeroLogoImage}
                  priority
                />
              </div>

              <div ref={assetMotionRef} className={styles.assetStageMotion}>
                <HomeAssetPreview
                  activeQuestion={activeQuestion}
                  onQuestionChange={handleQuestionChange}
                  onInteraction={handlePreviewInteraction}
                />
              </div>

              <aside
                className={styles.featureNarrative}
                aria-label="What Aim4price helps you do"
              >
                {HERO_STAGES.map((question, index) => {
                  const feature = FEATURE_STORIES[question];
                  const isActive = question === activeQuestion;

                  return (
                    <div
                      key={question}
                      className={styles.featureNarrativeLayer}
                      data-active={isActive ? 'true' : 'false'}
                      aria-hidden={!isActive || storyMode !== 'features'}
                    >
                      <p className={styles.featureNarrativeEyebrow}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        {feature.eyebrow}
                      </p>
                      <h2>{feature.title}</h2>
                      <p>{feature.body}</p>
                    </div>
                  );
                })}

                <p className={styles.featureNarrativeCount} aria-hidden="true">
                  <strong>{String(HERO_STAGES.indexOf(activeQuestion) + 1).padStart(2, '0')}</strong>
                  <span>/ 05</span>
                </p>
              </aside>

              <div className={styles.compactHeroActions}>
                <a
                  href="#choose-role"
                  className={styles.primaryCta}
                  onClick={handleRoleSkip}
                >
                  See Aim4price in Action
                </a>
                <Link href="/valuation" className={styles.secondaryCta}>
                  Get a Free Estimate
                </Link>
              </div>

              {!isStoryComplete &&
                isDesktopStory &&
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
        </div>
      </div>
    </section>
  );
}
