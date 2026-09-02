'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import HomeAssetPreview, { type QuestionKey } from './home-asset-preview';
import styles from './page.module.css';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const HOME_INTRO_COOKIE = 'a4p_home_intro';
export const HOME_INTRO_HOLD_MS = 1650;
export const HOME_INTRO_EXIT_MS = 700;
export const HERO_AUTOPLAY_DELAY_MS = 2500;
export const HERO_AUTOPLAY_AFTER_INTRO_MS = 700;
export const HERO_STAGE_DURATION_MS = 2800;

type IntroPhase = 'visible' | 'exiting' | 'complete';

type HomeHeroExperienceProps = {
  showIntro?: boolean;
};

export const HERO_STAGES: readonly QuestionKey[] = [
  'have',
  'worth',
  'cost',
  'manage',
  'attention',
];

export default function HomeHeroExperience({ showIntro = false }: HomeHeroExperienceProps) {
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey>('have');
  const [canAutoplay, setCanAutoplay] = useState(true);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [introPhase, setIntroPhase] = useState<IntroPhase>(
    showIntro ? 'visible' : 'complete',
  );
  const hasAutoStarted = useRef(false);
  const introWasShown = useRef(showIntro);
  const introSessionClaimed = useRef(false);
  const introLogoRef = useRef<HTMLDivElement | null>(null);

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
    if (!showIntro) {
      setIntroPhase('complete');
      return undefined;
    }

    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const secureCookie = window.location.protocol === 'https:' ? '; Secure' : '';
    const introCookieExists = document.cookie
      .split(';')
      .some((cookie) => cookie.trim() === `${HOME_INTRO_COOKIE}=v1`);
    const introWasAlreadySeen = introCookieExists && !introSessionClaimed.current;

    if (!introCookieExists) {
      document.cookie = `${HOME_INTRO_COOKIE}=v1; Path=/; SameSite=Lax${secureCookie}`;
      introSessionClaimed.current = true;
    }

    let exitTimer: number | undefined;
    let completeTimer: number | undefined;
    let isExiting = false;
    let isFinished = false;
    let removeIntroListeners = () => {};

    const clearIntroTimers = () => {
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
      if (completeTimer !== undefined) window.clearTimeout(completeTimer);
    };

    const setLogoDestination = () => {
      const source = introLogoRef.current;
      const target = document.querySelector<HTMLImageElement>(
        '[data-aim4price-header-mark]',
      );

      if (!source || !target) return;

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (!sourceRect.width || !targetRect.width) return;

      const shiftX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
      const shiftY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
      const scale = Math.max(0.28, Math.min(1, targetRect.width / sourceRect.width));

      source.style.setProperty('--home-intro-logo-x', `${shiftX}px`);
      source.style.setProperty('--home-intro-logo-y', `${shiftY}px`);
      source.style.setProperty('--home-intro-logo-scale', String(scale));
    };

    const finishIntro = () => {
      if (isFinished) return;

      isFinished = true;
      clearIntroTimers();
      removeIntroListeners();
      setIntroPhase('complete');
    };

    const beginIntroExit = () => {
      if (isFinished || isExiting) return;

      isExiting = true;
      setLogoDestination();
      setIntroPhase('exiting');
    };

    const skipIntro = () => {
      if (isFinished || isExiting) return;

      clearIntroTimers();
      beginIntroExit();
      completeTimer = window.setTimeout(finishIntro, HOME_INTRO_EXIT_MS);
    };

    const skipIntroOnWheel = (event: WheelEvent) => {
      event.preventDefault();
      skipIntro();
    };

    const skipIntroOnKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') finishIntro();
    };

    const stopIntroForReducedMotion = () => {
      if (reducedMotionMedia.matches) finishIntro();
    };

    removeIntroListeners = () => {
      window.removeEventListener('pointerdown', skipIntro);
      window.removeEventListener('click', skipIntro);
      window.removeEventListener('wheel', skipIntroOnWheel);
      window.removeEventListener('keydown', skipIntroOnKeydown);
      reducedMotionMedia.removeEventListener('change', stopIntroForReducedMotion);
    };

    if (
      introWasAlreadySeen ||
      reducedMotionMedia.matches ||
      document.hidden ||
      window.location.hash === '#choose-role' ||
      window.scrollY > 4
    ) {
      introWasShown.current = false;
      finishIntro();
    } else {
      exitTimer = window.setTimeout(beginIntroExit, HOME_INTRO_HOLD_MS);
      completeTimer = window.setTimeout(
        finishIntro,
        HOME_INTRO_HOLD_MS + HOME_INTRO_EXIT_MS,
      );
      window.addEventListener('pointerdown', skipIntro);
      window.addEventListener('click', skipIntro);
      window.addEventListener('wheel', skipIntroOnWheel, { passive: false });
      window.addEventListener('keydown', skipIntroOnKeydown);
      reducedMotionMedia.addEventListener('change', stopIntroForReducedMotion);
    }

    return () => {
      clearIntroTimers();
      removeIntroListeners();
    };
  }, [showIntro]);

  const introIsActive = introPhase !== 'complete';

  useEffect(() => {
    if (!introIsActive) return undefined;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [introIsActive]);

  useEffect(() => {
    if (!canAutoplay || introIsActive || hasAutoStarted.current) return undefined;

    const autoplayDelay = introWasShown.current
      ? HERO_AUTOPLAY_AFTER_INTRO_MS
      : HERO_AUTOPLAY_DELAY_MS;

    const startTimer = window.setTimeout(() => {
      if (hasAutoStarted.current) return;

      hasAutoStarted.current = true;
      setActiveQuestion('have');
      setIsAutoplaying(true);
    }, autoplayDelay);

    return () => window.clearTimeout(startTimer);
  }, [canAutoplay, introIsActive]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (!document.hidden) return;

      hasAutoStarted.current = true;
      setIsAutoplaying(false);
    };

    document.addEventListener('visibilitychange', pauseWhenHidden);
    pauseWhenHidden();

    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

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
  }, [activeQuestion, canAutoplay, isAutoplaying]);

  const handleQuestionChange = (question: QuestionKey, _index: number) => {
    hasAutoStarted.current = true;
    setIsAutoplaying(false);
    setActiveQuestion(question);
  };

  const handlePreviewInteraction = (_source: 'pointer' | 'focus') => {
    hasAutoStarted.current = true;

    if (!isAutoplaying) return;

    setIsAutoplaying(false);
  };

  return (
    <>
      {introIsActive ? (
        <div
          className={styles.homeIntro}
          data-phase={introPhase}
          aria-hidden="true"
        >
          <div className={styles.homeIntroCurtain} />

          <div className={styles.homeIntroContent}>
            <div ref={introLogoRef} className={styles.homeIntroLogoStage}>
              <Image
                src="/brand/aim4price-mark-black.png"
                alt=""
                width={660}
                height={515}
                className={styles.homeIntroLogo}
                priority
              />
            </div>

            <div className={styles.homeIntroCopy}>
              <p className={styles.homeIntroBrand}>Aim4price</p>
              <p className={styles.homeIntroTitle}>
                <span>Every asset.</span>
                <span>One living record.</span>
              </p>
              <p className={styles.homeIntroText}>
                Aim4price connects identity, value, documents, maintenance and ownership costs
                throughout an asset’s working life.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section
        className={styles.heroSection}
        aria-labelledby="home-hero-title"
        data-active-question={activeQuestion}
        data-autoplay={isAutoplaying ? 'true' : 'false'}
        data-intro-phase={introPhase}
      >
        <div className={styles.heroStory}>
          <div className={[styles.heroMedia, styles.heroSticky].join(' ')}>
            <div className={styles.shell}>
              <div className={styles.heroGrid}>
                <div className={styles.heroCopy}>
                  <div className={styles.heroCopyState}>
                    <h1 id="home-hero-title" className={styles.heroTitle}>
                      <span className={styles.heroTitleLine}>Know what you have.</span>
                      <span className={styles.heroTitleLine}>Know what it’s worth.</span>
                      <span className={styles.heroTitleLine}>Know what it really costs.</span>
                    </h1>

                    <p className={styles.heroText}>
                      Aim4price keeps each asset’s identity, indicative value, documents,
                      maintenance, fuel and ownership costs connected in one living record.
                    </p>
                  </div>

                  <div className={styles.heroSupport}>
                    <div className={styles.heroActions}>
                      <a href="#choose-role" className={styles.primaryCta}>
                        See Aim4price in Action
                      </a>
                      <Link href="/valuation" className={styles.secondaryCta}>
                        Get a Free Estimate
                      </Link>
                    </div>
                  </div>
                </div>

                <HomeAssetPreview
                  activeQuestion={activeQuestion}
                  onQuestionChange={handleQuestionChange}
                  onInteraction={handlePreviewInteraction}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
