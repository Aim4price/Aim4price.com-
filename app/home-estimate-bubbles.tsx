'use client';

import Link from 'next/link';
import styles from './page.module.css';

const ESTIMATE_BUBBLES = [
  {
    key: 'agriculture',
    label: 'Agriculture',
    src: '/brand/valuation/Agriculture.mp4',
    positionClass: styles.heroBubbleAgriculture,
  },
  {
    key: 'construction',
    label: 'Construction',
    src: '/brand/valuation/Construction.mp4',
    positionClass: styles.heroBubbleConstruction,
  },
  {
    key: 'industrial',
    label: 'Industrial',
    src: '/brand/valuation/Industrial.mp4',
    positionClass: styles.heroBubbleIndustrial,
  },
  {
    key: 'motor',
    label: 'Motor',
    src: '/brand/valuation/Motor.mp4',
    positionClass: styles.heroBubbleMotor,
  },
] as const;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const COARSE_POINTER_QUERY = '(hover: none), (pointer: coarse)';

function resetVideo(video: HTMLVideoElement) {
  video.dataset.previewRequested = 'false';
  video.pause();

  try {
    video.currentTime = 0;
  } catch {
    // The video may not have loaded metadata yet.
  }
}

function playBubblePreview(anchor: HTMLAnchorElement) {
  if (
    window.matchMedia(REDUCED_MOTION_QUERY).matches ||
    window.matchMedia(COARSE_POINTER_QUERY).matches
  ) {
    return;
  }

  const video = anchor.querySelector<HTMLVideoElement>('video');
  if (!video) return;

  video.dataset.previewRequested = 'true';
  video.defaultMuted = true;
  video.muted = true;

  try {
    video.currentTime = 0;
  } catch {
    // Playback will still begin from the start once metadata is available.
  }

  void video
    .play()
    .then(() => {
      if (video.dataset.previewRequested === 'true') {
        anchor.dataset.previewActive = 'true';
        return;
      }

      resetVideo(video);
    })
    .catch(() => {
      delete anchor.dataset.previewActive;
      video.dataset.previewRequested = 'false';
    });
}

function resetBubblePreview(anchor: HTMLAnchorElement) {
  if (anchor.matches(':hover') || document.activeElement === anchor) return;

  const video = anchor.querySelector<HTMLVideoElement>('video');
  if (!video) return;

  delete anchor.dataset.previewActive;
  resetVideo(video);
}

export default function HomeEstimateBubbles() {
  return (
    <div
      className={styles.heroBubbles}
      role="group"
      aria-label="Explore Get Estimate videos"
    >
      {ESTIMATE_BUBBLES.map((bubble) => (
        <Link
          key={bubble.key}
          href="/valuation"
          className={`${styles.heroBubble} ${bubble.positionClass}`}
          aria-label={`Open Get Estimate for ${bubble.label.toLowerCase()} assets`}
          onMouseEnter={(event) => playBubblePreview(event.currentTarget)}
          onMouseLeave={(event) => resetBubblePreview(event.currentTarget)}
          onFocus={(event) => playBubblePreview(event.currentTarget)}
          onBlur={(event) => resetBubblePreview(event.currentTarget)}
        >
          <video
            className={styles.heroBubbleVideo}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          >
            <source src={bubble.src} type="video/mp4" />
          </video>
          <span className={styles.heroBubbleSurface} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
