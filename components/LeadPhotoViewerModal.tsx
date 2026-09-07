'use client';

import { useEffect, useState } from 'react';
import { createPortal } from './WebsitePortal';
import assetStyles from '../app/asset-register/page.module.css';
import leadStyles from '../app/leads/page.module.css';
import { workspaceStyles } from './WorkspacePrimitives';

type LeadPhotoViewerModalProps = {
  assetKey: string;
  title: string;
  urls: string[];
  initialIndex: number;
  onClose: () => void;
  closeButtonClassName?: string;
};

function ChevronLeftIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function LeadPhotoViewerModal({
  assetKey,
  title,
  urls,
  initialIndex,
  onClose,
  closeButtonClassName = '',
}: LeadPhotoViewerModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(urls.length - 1, 0)),
  );

  useEffect(() => {
    setSelectedIndex(
      Math.min(Math.max(initialIndex, 0), Math.max(urls.length - 1, 0)),
    );
  }, [assetKey, initialIndex, urls.length]);

  useEffect(() => {
    if (!urls.length) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (
        urls.length > 1 &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      ) {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        setSelectedIndex(
          (current) => (current + direction + urls.length) % urls.length,
        );
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, urls.length]);

  if (typeof document === 'undefined' || !urls.length) return null;

  const safeIndex = Math.min(
    Math.max(selectedIndex, 0),
    Math.max(urls.length - 1, 0),
  );
  const activeUrl = urls[safeIndex];
  if (!activeUrl) return null;

  const hasMultiplePhotos = urls.length > 1;
  const cyclePhoto = (direction: -1 | 1) => {
    setSelectedIndex(
      (current) => (current + direction + urls.length) % urls.length,
    );
  };

  return createPortal(
    <div
      className={`${assetStyles.modalOverlay} ${workspaceStyles.modalOverlay} ${leadStyles.leadPhotoModalOverlay} ${leadStyles.assetPhotoModalOverlay}`} data-website-overlay
    >
      <div className={assetStyles.modalBackdrop} data-website-overlay onClick={onClose} />

      <div
        className={`${leadStyles.leadPhotoModal} ${leadStyles.assetPhotoModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${assetKey}-photo-modal-title`}
      >
        <div className={leadStyles.leadPhotoModalHeader}>
          <div>
            <strong id={`${assetKey}-photo-modal-title`}>Asset photos</strong>
            <span>
              {title} · {safeIndex + 1} of {urls.length}
            </span>
          </div>

          <button
            type="button"
            className={`${leadStyles.leadPhotoModalCloseButton} ${closeButtonClassName}`}
            onClick={onClose}
            aria-label="Close asset photos"
          >
            <CloseIcon className={assetStyles.buttonIcon} />
          </button>
        </div>

        <div className={leadStyles.leadPhotoModalBody}>
          <div className={leadStyles.leadPhotoModalFrame}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeUrl} alt={`${title} asset photo ${safeIndex + 1}`} />

            {hasMultiplePhotos ? (
              <>
                <button
                  type="button"
                  className={`${leadStyles.leadPhotoModalNavButton} ${leadStyles.leadPhotoModalNavPrevious}`}
                  onClick={() => cyclePhoto(-1)}
                  aria-label="Show previous asset photo"
                >
                  <ChevronLeftIcon className={assetStyles.buttonIcon} />
                </button>

                <button
                  type="button"
                  className={`${leadStyles.leadPhotoModalNavButton} ${leadStyles.leadPhotoModalNavNext}`}
                  onClick={() => cyclePhoto(1)}
                  aria-label="Show next asset photo"
                >
                  <ChevronRightIcon className={assetStyles.buttonIcon} />
                </button>
              </>
            ) : null}
          </div>

          {hasMultiplePhotos ? (
            <div
              className={leadStyles.leadPhotoModalThumbRow}
              aria-label="Asset photo thumbnails"
            >
              {urls.map((url, index) => (
                <button
                  type="button"
                  key={`${assetKey}-modal-photo-${index}`}
                  className={`${leadStyles.leadPhotoModalThumbButton} ${index === safeIndex ? leadStyles.leadPhotoModalThumbButtonActive : ''}`}
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`Show asset photo ${index + 1}`}
                  aria-current={index === safeIndex ? 'true' : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

