'use client';

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
const CINEMATIC_STORY_QUERY =
  '(min-width: 1181px) and (min-height: 700px) and (hover: hover) and (pointer: fine)';
const FEATURE_START_INDEX = 3;

export const HERO_FEATURE_DURATION_MS = 4800;

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

type FeatureStory = {
  title: string;
  body: string;
};

type StoryViewportAnchor =
  | {
      kind: 'hero';
      step: number;
      viewportOffset: number;
      wasAtTop: boolean;
    }
  | {
      kind: 'role';
      viewportOffset: number;
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
    title: 'One complete record for every asset.',
    body:
      'Keep its identity, serial or VIN, specifications, photos, documents, condition and last-known location together, so you always know what belongs where.',
  },
  worth: {
    title: 'Understand what it’s worth.',
    body:
      'Create an indicative estimate from year, usage, condition and replacement context, then keep valuation changes and depreciation history visible.',
  },
  cost: {
    title: 'See what it really costs.',
    body:
      'Connect invoices, repairs, parts, fuel and recurring commitments to the asset that caused them, with budgets and supporting evidence.',
  },
  manage: {
    title: 'Manage its entire working life.',
    body:
      'Update details, plan maintenance, capture work and usage, organise documents and carry the same record through listing, disposal or transfer.',
  },
  attention: {
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
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  // CSS capability queries choose the visible first-paint layout. Starting with
  // the attribute present prevents an eligible desktop flashing the static stack.
  const [isCinematicStory, setIsCinematicStory] = useState(true);
  const [isManuallyControlled, setIsManuallyControlled] = useState(false);
  const [hasAutoplayFinished, setHasAutoplayFinished] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const storyStepRef = useRef(0);
  const autoplayFinishedRef = useRef(false);
  const manualControlRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const scrollClaimRef = useRef(false);
  const storyCapabilityRef = useRef<boolean | null>(null);
  const viewportAnchorRef = useRef<StoryViewportAnchor | null>(null);
  const anchorFrameRef = useRef<number | null>(null);
  const capabilityRestoreRef = useRef(false);
  const capabilityFrameOneRef = useRef<number | null>(null);
  const capabilityFrameTwoRef = useRef<number | null>(null);
  const capabilityReleaseTimerRef = useRef<number | null>(null);

  const updateStoryStep = useCallback((nextIndex: number) => {
    const safeIndex = clampStoryIndex(nextIndex);
    storyStepRef.current = safeIndex;
    setStoryStepIndex(safeIndex);

    const viewportAnchor = viewportAnchorRef.current;
    if (viewportAnchor?.kind === 'hero') {
      viewportAnchorRef.current = { ...viewportAnchor, step: safeIndex };
    }

    if (safeIndex >= FEATURE_START_INDEX) {
      const questionIndex = safeIndex - FEATURE_START_INDEX;
      setActiveQuestion(HERO_STAGES[questionIndex] ?? 'have');
    } else {
      setActiveQuestion('have');
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
    manualControlRef.current = true;
    setIsManuallyControlled(true);
    setIsAutoplaying(false);
    setIsPaused(false);
  }, []);

  const captureViewportAnchor = useCallback(() => {
    if (capabilityRestoreRef.current) return;

    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return;

    const roleSection = document.getElementById('choose-role');
    const rootFontSize = Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize,
    ) || 16;
    const headerHeightValue = window
      .getComputedStyle(section)
      .getPropertyValue('--app-header-height')
      .trim();
    const parsedHeaderHeight = Number.parseFloat(headerHeightValue) || 0;
    const headerHeight = headerHeightValue.endsWith('rem')
      ? parsedHeaderHeight * rootFontSize
      : parsedHeaderHeight;
    const roleRect = roleSection?.getBoundingClientRect();

    if (roleRect && roleRect.top < window.innerHeight) {
      viewportAnchorRef.current = {
        kind: 'role',
        viewportOffset: roleRect.top,
      };
      return;
    }

    viewportAnchorRef.current = {
      kind: 'hero',
      step: storyStepRef.current,
      viewportOffset: Math.max(
        headerHeight,
        sticky.getBoundingClientRect().top,
      ),
      wasAtTop: window.scrollY <= 4,
    };
  }, []);

  const scheduleCapabilityRestore = useCallback((
    supportsStory: boolean,
    anchor: StoryViewportAnchor,
  ) => {
    if (capabilityFrameOneRef.current !== null) {
      window.cancelAnimationFrame(capabilityFrameOneRef.current);
    }
    if (capabilityFrameTwoRef.current !== null) {
      window.cancelAnimationFrame(capabilityFrameTwoRef.current);
    }
    if (capabilityReleaseTimerRef.current !== null) {
      window.clearTimeout(capabilityReleaseTimerRef.current);
    }

    capabilityRestoreRef.current = true;
    capabilityFrameOneRef.current = window.requestAnimationFrame(() => {
      capabilityFrameOneRef.current = null;
      capabilityFrameTwoRef.current = window.requestAnimationFrame(() => {
        capabilityFrameTwoRef.current = null;

        const section = sectionRef.current;
        const sticky = stickyRef.current;
        if (!section || !sticky) {
          capabilityRestoreRef.current = false;
          return;
        }

        const scrollInstantly = (operation: () => void) => {
          const root = document.documentElement;
          const previousInlineBehavior = root.style.scrollBehavior;
          root.style.scrollBehavior = 'auto';

          try {
            operation();
          } finally {
            root.style.scrollBehavior = previousInlineBehavior;
          }
        };

        if (anchor.kind === 'role') {
          const roleSection = document.getElementById('choose-role');
          if (roleSection) {
            const delta = roleSection.getBoundingClientRect().top - anchor.viewportOffset;
            if (Math.abs(delta) > 1) {
              scrollInstantly(() => {
                window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
              });
            }
          }
        } else if (anchor.wasAtTop) {
          updateStoryStep(0);
          scrollInstantly(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          });
        } else if (supportsStory) {
          updateStoryStep(anchor.step);
          const sectionTop = window.scrollY + section.getBoundingClientRect().top;
          const stickyTop =
            Number.parseFloat(window.getComputedStyle(sticky).top) || 0;
          const trackStart = sectionTop - stickyTop;
          const trackTravel = Math.max(1, section.offsetHeight - sticky.offsetHeight);
          const stepProgress = (clampStoryIndex(anchor.step) + 0.5) /
            HERO_STORY_STEPS.length;

          scrollInstantly(() => {
            window.scrollTo({
              top: trackStart + stepProgress * trackTravel,
              left: 0,
              behavior: 'auto',
            });
          });
        } else {
          updateStoryStep(anchor.step);
          const selector = anchor.step >= FEATURE_START_INDEX
            ? '[data-story-narrative]'
            : anchor.step === 2
              ? '[data-story-preview]'
              : '[data-story-opening]';
          const target = section.querySelector<HTMLElement>(selector);

          if (target) {
            const delta = target.getBoundingClientRect().top - anchor.viewportOffset;
            if (Math.abs(delta) > 1) {
              scrollInstantly(() => {
                window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
              });
            }
          }
        }

        capabilityReleaseTimerRef.current = window.setTimeout(() => {
          capabilityReleaseTimerRef.current = null;
          capabilityRestoreRef.current = false;
          captureViewportAnchor();
        }, 48);
      });
    });
  }, [captureViewportAnchor, updateStoryStep]);

  useEffect(() => {
    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const cinematicStoryMedia = window.matchMedia(CINEMATIC_STORY_QUERY);

    const syncStoryCapability = () => {
      const supportsStory = cinematicStoryMedia.matches && !reducedMotionMedia.matches;
      const previousCapability = storyCapabilityRef.current;
      const savedAnchor = viewportAnchorRef.current;
      storyCapabilityRef.current = supportsStory;
      setCanAutoplay(supportsStory);
      setIsCinematicStory(supportsStory);

      if (!supportsStory) {
        setIsAutoplaying(false);
        if (!manualControlRef.current) updateStoryStep(FEATURE_START_INDEX);
      } else if (!manualControlRef.current) {
        updateStoryStep(0);
      }

      if (
        previousCapability !== null &&
        previousCapability !== supportsStory &&
        savedAnchor
      ) {
        scheduleCapabilityRestore(supportsStory, savedAnchor);
      }
    };

    syncStoryCapability();
    reducedMotionMedia.addEventListener('change', syncStoryCapability);
    cinematicStoryMedia.addEventListener('change', syncStoryCapability);

    return () => {
      reducedMotionMedia.removeEventListener('change', syncStoryCapability);
      cinematicStoryMedia.removeEventListener('change', syncStoryCapability);
      if (capabilityFrameOneRef.current !== null) {
        window.cancelAnimationFrame(capabilityFrameOneRef.current);
      }
      if (capabilityFrameTwoRef.current !== null) {
        window.cancelAnimationFrame(capabilityFrameTwoRef.current);
      }
      if (capabilityReleaseTimerRef.current !== null) {
        window.clearTimeout(capabilityReleaseTimerRef.current);
      }
      capabilityRestoreRef.current = false;
    };
  }, [scheduleCapabilityRestore, updateStoryStep]);

  useEffect(() => {
    const scheduleAnchorCapture = () => {
      if (capabilityRestoreRef.current || anchorFrameRef.current !== null) return;

      anchorFrameRef.current = window.requestAnimationFrame(() => {
        anchorFrameRef.current = null;
        captureViewportAnchor();
      });
    };

    captureViewportAnchor();
    window.addEventListener('scroll', scheduleAnchorCapture, { passive: true });
    window.addEventListener('pageshow', scheduleAnchorCapture);

    return () => {
      window.removeEventListener('scroll', scheduleAnchorCapture);
      window.removeEventListener('pageshow', scheduleAnchorCapture);
      if (anchorFrameRef.current !== null) {
        window.cancelAnimationFrame(anchorFrameRef.current);
        anchorFrameRef.current = null;
      }
    };
  }, [captureViewportAnchor]);

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
      isPreviewHovered ||
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
    isPreviewHovered,
    storyStepIndex,
    updateStoryStep,
  ]);

  useEffect(() => {
    if (!isCinematicStory) return undefined;

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
        const sectionTop = currentScrollY + section.getBoundingClientRect().top;
        const stickyTop =
          Number.parseFloat(window.getComputedStyle(sticky).top) || 0;
        const trackStart = sectionTop - stickyTop;
        const trackTravel = Math.max(
          1,
          section.offsetHeight - sticky.offsetHeight,
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
          manualControlRef.current = true;
          setHasAutoplayFinished(true);
          setIsManuallyControlled(true);
          setIsPaused(false);
          setIsAutoplaying(false);
        }
      });
    };

    const handleScroll = () => {
      if (capabilityRestoreRef.current) return;
      scheduleStorySync(true);
    };
    const handleResize = () => {
      if (capabilityRestoreRef.current) return;
      if (autoplayFinishedRef.current || window.scrollY > 4) {
        scheduleStorySync(window.scrollY > 4);
      }
    };
    const handlePageShow = () => scheduleStorySync(window.scrollY > 4);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('pageshow', handlePageShow);

    if (window.scrollY > 4 && !capabilityRestoreRef.current) {
      scheduleStorySync(true);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pageshow', handlePageShow);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      scrollClaimRef.current = false;
    };
  }, [isCinematicStory, updateStoryStep]);

  const handleQuestionChange = (question: QuestionKey, index: number) => {
    claimManualControl();
    setActiveQuestion(question);
    updateStoryStep(FEATURE_START_INDEX + index);
  };

  const handlePreviewInteraction = (
    source: 'pointer-enter' | 'pointer-leave' | 'focus',
  ) => {
    if (source === 'focus') {
      setIsPreviewHovered(false);
      claimManualControl();
      return;
    }

    setIsPreviewHovered(source === 'pointer-enter');
  };

  const handleRoleSkip = () => {
    claimManualControl();
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
      data-story-mode={storyMode}
      data-story-capability={isCinematicStory ? 'cinematic' : 'static'}
      data-active-question={activeQuestion}
      data-autoplay={
        isAutoplaying && storyStepIndex >= FEATURE_START_INDEX ? 'true' : 'false'
      }
    >
      <h1 id="home-hero-title" className={styles.heroA11yTitle} tabIndex={-1}>
        Aim4price.com asset management software built for South Africa
      </h1>

      <div className={styles.heroStory}>
        <div
          ref={stickyRef}
          className={[styles.heroMedia, styles.heroSticky].join(' ')}
        >
          <div className={styles.shell}>
            <div className={styles.storyHeroGrid} onFocusCapture={handleStoryFocus}>
              <div className={styles.heroCopyDeck} data-story-opening>
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
                  unoptimized
                  className={styles.storyHeroLogoImage}
                  priority
                />
              </div>

              <div className={styles.assetStageMotion} data-story-preview>
                <HomeAssetPreview
                  activeQuestion={activeQuestion}
                  onQuestionChange={handleQuestionChange}
                  onInteraction={handlePreviewInteraction}
                />
              </div>

              <aside
                className={styles.featureNarrative}
                aria-label="What Aim4price helps you do"
                data-story-narrative
              >
                {HERO_STAGES.map((question) => {
                  const feature = FEATURE_STORIES[question];
                  const isActive = question === activeQuestion;

                  return (
                    <div
                      key={question}
                      className={styles.featureNarrativeLayer}
                      data-active={isActive ? 'true' : 'false'}
                    >
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

              {isCinematicStory &&
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
