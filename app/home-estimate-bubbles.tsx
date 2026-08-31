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

function resetBubbleGroup(group: HTMLDivElement) {
  group
    .querySelectorAll<HTMLAnchorElement>('[data-estimate-bubble]')
    .forEach((anchor) => resetBubblePreview(anchor));
}

function playClosestBubblePreview(group: HTMLDivElement, clientX: number, clientY: number) {
  if (!window.matchMedia(ANY_HOVER_QUERY).matches) return;

  let closestAnchor: HTMLAnchorElement | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  const anchors = group.querySelectorAll<HTMLAnchorElement>('[data-estimate-bubble]');

  for (const anchor of anchors) {
    const bounds = anchor.getBoundingClientRect();
    const distance = Math.hypot(
      clientX - (bounds.left + bounds.width / 2),
      clientY - (bounds.top + bounds.height / 2),
    );

    if (distance >= closestDistance) continue;

    closestAnchor = anchor;
    closestDistance = distance;
  }

  if (closestAnchor) playBubblePreview(closestAnchor);
}

export default function HomeEstimateBubbles() {
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const videos = Array.from(
      groupRef.current?.querySelectorAll<HTMLVideoElement>('video') ?? [],
    );
    const cleanup = () => {
      videos.forEach((video) => {
        const anchor = video.closest<HTMLAnchorElement>('a');
        if (anchor) delete anchor.dataset.previewActive;

        resetVideo(video);
        video.preload = 'none';
        video.load();
      });
    };

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (
      connection?.saveData ||
      window.matchMedia(REDUCED_MOTION_QUERY).matches ||
      !window.matchMedia(ANY_HOVER_QUERY).matches
    ) {
      return cleanup;
    }

    videos.forEach((video) => {
      if (video.dataset.previewRequestId || !video.paused) return;

      video.preload = 'auto';
      video.load();
    });

    return cleanup;
  }, []);

  return (
    <div
      ref={groupRef}
      className={styles.heroBubbles}
      role="group"
      aria-label="Explore Get Estimate videos"
      onMouseEnter={(event) =>
        playClosestBubblePreview(event.currentTarget, event.clientX, event.clientY)
      }
      onMouseMove={(event) =>
        playClosestBubblePreview(event.currentTarget, event.clientX, event.clientY)
      }
      onMouseLeave={(event) => resetBubbleGroup(event.currentTarget)}
    >
      {ESTIMATE_BUBBLES.map((bubble) => (
        <Link
          key={bubble.key}
          href="/valuation"
          className={`${styles.heroBubble} ${bubble.positionClass}`}
          aria-label={`Open Get Estimate for ${bubble.label.toLowerCase()} assets`}
          data-estimate-bubble={bubble.key}
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
