'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
  };
};

export default function HomeHeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isPhone = window.matchMedia(
      '(max-width: 720px), (max-width: 900px) and (max-height: 560px)',
    ).matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as NavigatorWithConnection).connection?.saveData === true;

    if (isPhone || prefersReducedMotion || saveData) return;

    video.preload = 'metadata';
    video.load();
    void video.play().then(() => setIsPlaying(true)).catch(() => undefined);
  }, []);

  async function playVideo() {
    const video = videoRef.current;
    if (!video) return;

    video.preload = 'metadata';
    video.load();

    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }

  return (
    <div className={styles.heroVideoStage}>
      <video
        ref={videoRef}
        className={styles.heroVideo}
        muted
        loop
        playsInline
        preload="none"
        poster="/brand/Home-page.png"
        aria-hidden="true"
      >
        <source src="/brand/AIM4PRICE.mp4" type="video/mp4" />
      </video>

      {!isPlaying ? (
        <button
          type="button"
          className={styles.heroVideoPlay}
          aria-label="Play background video"
          onClick={() => void playVideo()}
        >
          <span aria-hidden="true">▶</span>
        </button>
      ) : null}
    </div>
  );
}
