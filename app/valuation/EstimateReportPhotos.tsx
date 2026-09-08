'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';

import { MAX_ESTIMATE_REPORT_PHOTOS } from '../../lib/estimate-report-enhancement';
import styles from './estimate-report-photos.module.css';

const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;
const REPORT_PHOTO_LONG_EDGE = 1400;
const REPORT_PHOTO_FALLBACK_LONG_EDGE = 1100;
const REPORT_PHOTO_QUALITY = 0.82;
const REPORT_PHOTO_FALLBACK_QUALITY = 0.72;
const REPORT_PHOTO_SOFT_DATA_URL_LIMIT = 1_850_000;
const PDF_ACTION_SELECTOR = '[data-result-action="download-pdf"]';

type ReportPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

function photoId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function fitImage(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, maxEdge / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function renderImageToDataUrl(image: HTMLImageElement, maxEdge: number, quality: number): string {
  const size = fitImage(image.naturalWidth || image.width, image.naturalHeight || image.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image preparation is not available in this browser.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function compressReportPhoto(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`“${file.name}” could not be read as an image.`));
      image.src = objectUrl;
    });

    const firstPass = renderImageToDataUrl(image, REPORT_PHOTO_LONG_EDGE, REPORT_PHOTO_QUALITY);
    if (firstPass.length <= REPORT_PHOTO_SOFT_DATA_URL_LIMIT) return firstPass;
    return renderImageToDataUrl(image, REPORT_PHOTO_FALLBACK_LONG_EDGE, REPORT_PHOTO_FALLBACK_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function findReportPhotoHost(): HTMLElement | null {
  const pdfButton = document.querySelector<HTMLButtonElement>(PDF_ACTION_SELECTOR);
  return pdfButton?.parentElement ?? null;
}

function isEstimatePdfForm(form: HTMLFormElement): boolean {
  try {
    return new URL(form.action, window.location.href).pathname === '/api/valuation/report';
  } catch {
    return false;
  }
}

export default function EstimateReportPhotos() {
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<ReportPhoto[]>([]);
  const submittingRef = useRef(false);

  function replacePhotos(next: ReportPhoto[]) {
    photosRef.current = next;
    setPhotos(next);
  }

  function clearPhotos() {
    for (const photo of photosRef.current) URL.revokeObjectURL(photo.previewUrl);
    replacePhotos([]);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  useEffect(() => () => {
    for (const photo of photosRef.current) URL.revokeObjectURL(photo.previewUrl);
    photosRef.current = [];
  }, []);

  useLayoutEffect(() => {
    let previousHost: HTMLElement | null = null;

    const syncHost = () => {
      const nextHost = findReportPhotoHost();
      if (!nextHost && previousHost) clearPhotos();
      previousHost = nextHost;
      setPortalHost((current) => current === nextHost ? current : nextHost);
    };

    syncHost();
    const observer = new MutationObserver(syncHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const previousSubmit = HTMLFormElement.prototype.submit;
    const submitWithTemporaryPhotos = function submitWithTemporaryPhotos(this: HTMLFormElement) {
      if (!isEstimatePdfForm(this) || !photosRef.current.length) {
        return previousSubmit.call(this);
      }
      if (submittingRef.current) return;

      submittingRef.current = true;
      setPreparing(true);
      setError('');
      const form = this;
      const selectedPhotos = [...photosRef.current];

      void (async () => {
        let reattached = false;
        try {
          const payloadInput = form.querySelector<HTMLInputElement>('input[name="payload"]');
          if (!payloadInput?.value) throw new Error('The estimate report payload is unavailable.');

          const payload = JSON.parse(payloadInput.value) as Record<string, unknown>;
          const results = await Promise.allSettled(selectedPhotos.map((photo) => compressReportPhoto(photo.file)));
          const reportPhotos = results
            .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
            .map((result) => result.value)
            .slice(0, MAX_ESTIMATE_REPORT_PHOTOS);
          const failedCount = results.length - reportPhotos.length;

          if (reportPhotos.length) payload.reportPhotos = reportPhotos;
          payloadInput.value = JSON.stringify(payload);
          if (failedCount) {
            setError(`${failedCount} photo${failedCount === 1 ? '' : 's'} could not be prepared and will be left out of the report.`);
          }
        } catch (photoError) {
          setError(photoError instanceof Error ? `${photoError.message} The PDF will continue without temporary photos.` : 'Photos could not be prepared. The PDF will continue without them.');
        } finally {
          if (!form.isConnected) {
            form.style.display = 'none';
            document.body.appendChild(form);
            reattached = true;
          }

          try {
            previousSubmit.call(form);
          } finally {
            if (reattached) window.setTimeout(() => form.remove(), 0);
            submittingRef.current = false;
            setPreparing(false);
          }
        }
      })();
    };

    HTMLFormElement.prototype.submit = submitWithTemporaryPhotos;
    return () => {
      if (HTMLFormElement.prototype.submit === submitWithTemporaryPhotos) {
        HTMLFormElement.prototype.submit = previousSubmit;
      }
    };
  }, []);

  function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!incoming.length) return;

    const current = photosRef.current;
    const existingIds = new Set(current.map((photo) => photo.id));
    const accepted: ReportPhoto[] = [];
    const problems: string[] = [];

    for (const file of incoming) {
      if (current.length + accepted.length >= MAX_ESTIMATE_REPORT_PHOTOS) {
        problems.push(`Only ${MAX_ESTIMATE_REPORT_PHOTOS} photos can be added to one estimate report.`);
        break;
      }
      if (!isImageFile(file)) {
        problems.push(`“${file.name}” is not a supported image.`);
        continue;
      }
      if (file.size > MAX_SOURCE_PHOTO_BYTES) {
        problems.push(`“${file.name}” is larger than 20 MB.`);
        continue;
      }

      const id = photoId(file);
      if (existingIds.has(id) || accepted.some((photo) => photo.id === id)) continue;
      accepted.push({ id, file, previewUrl: URL.createObjectURL(file) });
    }

    if (accepted.length) replacePhotos([...current, ...accepted]);
    setError(problems[0] ?? '');
  }

  function removePhoto(id: string) {
    const current = photosRef.current;
    const target = current.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    replacePhotos(current.filter((photo) => photo.id !== id));
    setError('');
  }

  if (!portalHost) return null;

  return createPortal(
    <section className={styles.reportPhotoCard} data-estimate-report-photos aria-label="Estimate report photos">
      <div className={styles.reportPhotoHeader}>
        <div>
          <strong>Report photos</strong>
          <span>Optional · this estimate only · not saved to the Asset Register</span>
        </div>
        <button
          type="button"
          className={styles.addPhotoButton}
          onClick={() => inputRef.current?.click()}
          disabled={preparing || photos.length >= MAX_ESTIMATE_REPORT_PHOTOS}
        >
          {photos.length ? 'Add more' : 'Add photos'}
        </button>
      </div>

      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelection}
      />

      {photos.length ? (
        <>
          <div className={styles.photoGrid}>
            {photos.map((photo, index) => (
              <figure key={photo.id} className={styles.photoPreview}>
                <img src={photo.previewUrl} alt={`Report photo ${index + 1}`} />
                <button type="button" onClick={() => removePhoto(photo.id)} aria-label={`Remove report photo ${index + 1}`}>×</button>
              </figure>
            ))}
          </div>
          <div className={styles.photoFooter}>
            <span>{photos.length} of {MAX_ESTIMATE_REPORT_PHOTOS} photos will be included in the PDF.</span>
            <button type="button" onClick={clearPhotos} disabled={preparing}>Clear photos</button>
          </div>
        </>
      ) : (
        <p className={styles.emptyHint}>Add up to {MAX_ESTIMATE_REPORT_PHOTOS} photos. Aim4price compresses them for the report and does not store them.</p>
      )}

      {preparing ? <p className={styles.status}>Preparing report photos…</p> : null}
      {error ? <p className={styles.error} role="status">{error}</p> : null}
    </section>,
    portalHost,
  );
}
