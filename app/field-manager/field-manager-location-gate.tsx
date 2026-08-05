'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveFieldManagerServiceLocation } from '../../lib/field-manager-location-session';
import styles from './page.module.css';

type LocationState = 'checking' | 'ready' | 'error';

type FieldManagerLocationGateProps = {
  assetTitle: string;
  assetId: string;
  publicAssetCode: string;
  redirectTo: string;
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

export default function FieldManagerLocationGate({
  assetTitle,
  assetId,
  publicAssetCode,
  redirectTo,
  onCancel,
}: FieldManagerLocationGateProps) {
  const [locationState, setLocationState] = useState<LocationState>('checking');
  const [message, setMessage] = useState('Getting your current location…');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const hasRequestedRef = useRef(false);
  const attemptRef = useRef(0);
  const redirectTimerRef = useRef<number | null>(null);

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

        const capturedAtIso = new Date(position.timestamp || Date.now()).toISOString();
        const accuracyMeters = Number.isFinite(position.coords.accuracy)
          ? Math.round(position.coords.accuracy)
          : null;
        const saved = saveFieldManagerServiceLocation({
          publicAssetCode,
          assetId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters,
          capturedAtIso,
        });

        if (!saved) {
          setLocationState('error');
          setMessage('Your location was found but could not be prepared for this service. Please retry.');
          return;
        }

        setAccuracy(accuracyMeters);
        setLocationState('ready');
        setMessage('Location ready. Opening the service…');
        redirectTimerRef.current = window.setTimeout(() => {
          window.location.assign(redirectTo);
        }, 450);
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
  }, [assetId, publicAssetCode, redirectTo]);

  useEffect(() => {
    if (!hasRequestedRef.current) {
      hasRequestedRef.current = true;
      captureLocation();
    }

    return () => {
      attemptRef.current += 1;
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, [captureLocation]);

  return (
    <div className={styles.locationGatePage} role="dialog" aria-modal="true" aria-labelledby="location-gate-title">
      <section
        className={`${styles.locationGateCard} ${locationState === 'error' ? styles.locationGateCardError : ''}`}
      >
        <div className={styles.locationGateHeader}>
          <div className={styles.locationGateIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
              <circle cx="12" cy="10" r="2.25" />
            </svg>
          </div>
          <div className={styles.locationGateCopy}>
            <p className={styles.locationGateEyebrow}>Location required</p>
            <h2 id="location-gate-title">Ready to start service?</h2>
          </div>
        </div>

        <p className={styles.locationGateAsset}>{assetTitle}</p>
        <p className={styles.locationGateDescription}>
          Allow Aim4price to tag this service with your current location.
        </p>

        <div
          className={`${styles.locationGateStatus} ${styles[
            locationState === 'error'
              ? 'locationGateStatusError'
              : locationState === 'ready'
                ? 'locationGateStatusReady'
                : 'locationGateStatusChecking'
          ]}`}
          role="status"
          aria-live="polite"
        >
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
            {locationState === 'ready' && accuracy !== null ? (
              <small>Accuracy: about {accuracy} m</small>
            ) : null}
          </div>
        </div>

        <div className={styles.locationGateActions}>
          <button type="button" className={styles.locationGateBack} onClick={onCancel}>
            Back
          </button>
          <button
            type="button"
            className={styles.locationGatePrimary}
            onClick={captureLocation}
            disabled={locationState !== 'error'}
          >
            {locationState === 'error'
              ? 'Retry location'
              : locationState === 'ready'
                ? 'Opening service…'
                : 'Getting location…'}
          </button>
        </div>
      </section>
    </div>
  );
}
