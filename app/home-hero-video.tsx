'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

export default function HomeHeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const player: HTMLVideoElement = video;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    player.defaultMuted = true;
    player.muted = true;

    async function startPlayback() {
      if (document.hidden) return;

      try {
        await player.play();
        setPlaybackBlocked(false);
      } catch {
        setPlaybackBlocked(true);
      }
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && player.paused) void startPlayback();
    };

    void startPlayback();
    player.addEventListener('canplay', startPlayback, { once: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      player.removeEventListener('canplay', startPlayback);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  async function playVideo() {
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;

    try {
      await video.play();
      setPlaybackBlocked(false);
    } catch {
      setPlaybackBlocked(true);
    }
  }

  return (
    <div className={styles.heroVideoStage}>
      <video
        ref={videoRef}
        className={styles.heroVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/brand/home-hero-poster.jpg"
        aria-hidden="true"
        onError={() => setPlaybackBlocked(true)}
      >
        <source src="/brand/AIM4PRICE.mp4" type="video/mp4" />
      </video>

      {playbackBlocked ? (
        <button
          type="button"
          className={styles.heroVideoPlay}
          onClick={() => void playVideo()}
        >
          <span aria-hidden="true">▶</span>
          Play video
        </button>
      ) : null}
    </div>
  );
}
