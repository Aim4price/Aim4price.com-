'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './FuelLocationModal.module.css';

export type FuelLocationCoordinates = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAtIso: string;
};

type LocationState = 'checking' | 'ready' | 'error';

type FuelLocationModalProps = {
  subject: string;
  recordLabel?: 'fuel record' | 'service';
  onReady: (coordinates: FuelLocationCoordinates) => void;
  onCancel: () => void;
};

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Turn on Location Services and allow Aim4price to use your location, then retry.';
  }

  if (error.code === error.TIMEOUT) {
    return 'Your location took too long to respond. Move to an open area and retry.';
  }

  return 'Your location is not available yet. Turn Location Services on and retry.';
}

export default function FuelLocationModal({
  subject,
  recordLabel = 'fuel record',
  onReady,
  onCancel,
}: FuelLocationModalProps) {
  const [locationState, setLocationState] = useState<LocationState>('checking');
  const [message, setMessage] = useState('Getting your current location…');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const attemptRef = useRef(0);
  const readyTimerRef = useRef<number | null>(null);

  const captureLocation = useCallback(() => {
    const attempt = ++attemptRef.current;
    setLocationState('checking');
    setMessage('Getting your current location…');
    setAccuracy(null);

    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationState('error');
      setMessage('Location is unavailable. Turn on Location Services, use a secure connection and retry.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (attempt !== attemptRef.current) return;

        const coordinates: FuelLocationCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null,
          capturedAtIso: new Date(position.timestamp || Date.now()).toISOString(),
        };

        setAccuracy(coordinates.accuracyMeters);
        setLocationState('ready');
        setMessage(`Location ready. Opening the ${recordLabel}…`);
        readyTimerRef.current = window.setTimeout(() => onReady(coordinates), 450);
      },
      (error) => {
        if (attempt !== attemptRef.current) return;
        setLocationState('error');
        setMessage(geolocationErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  }, [onReady, recordLabel]);

  useEffect(() => {
    captureLocation();

    return () => {
      attemptRef.current += 1;
      if (readyTimerRef.current !== null) window.clearTimeout(readyTimerRef.current);
    };
  }, [captureLocation]);

  return (
    <div className={styles.backdrop} data-website-overlay role="dialog" aria-modal="true" aria-labelledby="fuel-location-title">
      <section className={`${styles.card} ${locationState === 'error' ? styles.cardError : ''}`}>
        <div className={styles.header}>
          <div className={styles.icon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
              <circle cx="12" cy="10" r="2.25" />
            </svg>
          </div>
          <h2 id="fuel-location-title">Location required</h2>
        </div>

        <p className={styles.subject}>{subject}</p>
        <p className={styles.description}>Allow Aim4price to tag this {recordLabel} with your current location.</p>

        <div className={`${styles.status} ${styles[locationState]}`} role="status" aria-live="polite">
          <span aria-hidden="true" />
          <div>
            <strong>
              {locationState === 'error'
                ? 'Location not ready'
                : locationState === 'ready'
                  ? 'Location ready'
                  : 'Checking location'}
            </strong>
            <p>{message}</p>
            {locationState === 'ready' && accuracy !== null ? <small>Accuracy: about {accuracy} m</small> : null}
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.backButton} onClick={onCancel}>Back</button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={captureLocation}
            disabled={locationState !== 'error'}
          >
            {locationState === 'error'
              ? 'Retry'
              : locationState === 'ready'
                ? 'Opening…'
                : 'Getting location…'}
          </button>
        </div>
      </section>
    </div>
  );
}

