'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import styles from './page.module.css';

const ESTIMATE_BUBBLES = [
  {
    key: 'agriculture',
    label: 'Agriculture',
    src: '/brand/valuation/previews/agriculture-home-preview.mp4',
    positionClass: styles.heroBubbleAgriculture,
  },
  {
    key: 'construction',
    label: 'Construction',
    src: '/brand/valuation/previews/construction-home-preview.mp4',
    positionClass: styles.heroBubbleConstruction,
  },
  {
    key: 'industrial',
    label: 'Industrial',
    src: '/brand/valuation/previews/industrial-home-preview.mp4',
    positionClass: styles.heroBubbleIndustrial,
  },
  {
    key: 'motor',
    label: 'Motor',
    src: '/brand/valuation/previews/motor-home-preview.mp4',
    positionClass: styles.heroBubbleMotor,
  },
] as const;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const ANY_HOVER_QUERY = '(any-hover: hover)';
let previewRequestSequence = 0;

function resetVideo(video: HTMLVideoElement) {
  delete video.dataset.previewRequestId;
  video.pause();

  try {
    video.currentTime = 0;
  } catch {
    // The video may not have loaded metadata yet.
  }
}

function resetSiblingPreviews(anchor: HTMLAnchorElement, activeVideo: HTMLVideoElement) {
  anchor.parentElement
    ?.querySelectorAll<HTMLVideoElement>('video')
    .forEach((video) => {
      if (video === activeVideo) return;

      const siblingAnchor = video.closest<HTMLAnchorElement>('a');
      if (siblingAnchor) delete siblingAnchor.dataset.previewActive;
      resetVideo(video);
    });
}

function playBubblePreview(anchor: HTMLAnchorElement) {
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

  const video = anchor.querySelector<HTMLVideoElement>('video');
  if (!video || (anchor.dataset.previewActive === 'true' && !video.paused)) return;

  resetSiblingPreviews(anchor, video);

  const requestId = String(++previewRequestSequence);
  video.dataset.previewRequestId = requestId;
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
      if (video.dataset.previewRequestId === requestId) {
        anchor.dataset.previewActive = 'true';
        return;
      }

      if (!video.dataset.previewRequestId) resetVideo(video);
    })
    .catch(() => {
      if (video.dataset.previewRequestId !== requestId) return;

      delete anchor.dataset.previewActive;
      resetVideo(video);
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
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (
      connection?.saveData ||
      window.matchMedia(REDUCED_MOTION_QUERY).matches ||
      !window.matchMedia(ANY_HOVER_QUERY).matches
    ) {
      return;
    }

    groupRef.current?.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
      if (video.dataset.previewRequestId || !video.paused) return;

      video.preload = 'auto';
      video.load();
    });
  }, []);

  return (
    <div
      ref={groupRef}
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
          onMouseEnter={(event) => {
            if (window.matchMedia(ANY_HOVER_QUERY).matches) {
              playBubblePreview(event.currentTarget);
            }
          }}
          onMouseLeave={(event) => resetBubblePreview(event.currentTarget)}
          onFocus={(event) => {
            if (event.currentTarget.matches(':focus-visible')) {
              playBubblePreview(event.currentTarget);
            }
          }}
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
          <span className={styles.heroBubbleTouchLabel} aria-hidden="true">
            {bubble.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
