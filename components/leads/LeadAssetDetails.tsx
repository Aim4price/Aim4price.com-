import type { ReactNode } from "react";
import assetStyles from "../../app/asset-register/page.module.css";
import styles from "../../app/leads/page.module.css";

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LeadAssetDetails({
  id,
  title,
  photos,
  photoIndex,
  familyLabel = "Asset",
  onPhotoIndexChange,
  onOpenPhoto,
  details,
  children,
}: {
  id: string;
  title: string;
  photos: string[];
  photoIndex: number;
  familyLabel?: string;
  onPhotoIndexChange: (index: number) => void;
  onOpenPhoto: (index: number) => void;
  details: ReactNode;
  children?: ReactNode;
}) {
  const photo = photos[photoIndex] ?? "";
  const hasMultiplePhotos = photos.length > 1;
  return (
    <div className={`${assetStyles.assetBody} ${styles.leadAssetBody}`} id={id}>
      <div className={`${assetStyles.previewWrap} ${styles.leadPreviewWrap}`}>
        <div
          className={`${assetStyles.previewStage} ${styles.leadPreviewStage}`}
        >
          {photo ? (
            <>
              <button
                type="button"
                className={styles.leadPreviewOpenButton}
                onClick={() => onOpenPhoto(photoIndex)}
                aria-label={`Open ${title} photo ${photoIndex + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={`${title} photo ${photoIndex + 1}`}
                  className={`${assetStyles.previewImage} ${styles.leadPreviewImage}`}
                />
                <span className={styles.leadPreviewOpenLabel}>Open photo</span>
              </button>

              {hasMultiplePhotos ? (
                <>
                  <button
                    type="button"
                    className={`${assetStyles.previewNavButton} ${assetStyles.previewNavPrev}`}
                    onClick={() =>
                      onPhotoIndexChange(
                        (photoIndex - 1 + photos.length) % photos.length,
                      )
                    }
                    aria-label="Show previous photo"
                  >
                    <ChevronLeftIcon className={assetStyles.buttonIcon} />
                  </button>

                  <button
                    type="button"
                    className={`${assetStyles.previewNavButton} ${assetStyles.previewNavNext}`}
                    onClick={() =>
                      onPhotoIndexChange((photoIndex + 1) % photos.length)
                    }
                    aria-label="Show next photo"
                  >
                    <ChevronRightIcon className={assetStyles.buttonIcon} />
                  </button>

                  <div className={assetStyles.previewCounter}>
                    {photoIndex + 1} / {photos.length}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div
              className={`${assetStyles.previewPlaceholder} ${styles.leadPreviewPlaceholder}`}
            >
              <div className={assetStyles.previewPlaceholderBadges}>
                <span
                  className={`${assetStyles.badge} ${assetStyles.badgeNeutral} ${assetStyles.previewPlaceholderBadge}`}
                >
                  {familyLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {hasMultiplePhotos ? (
          <div
            className={`${assetStyles.previewThumbRow} ${styles.leadPreviewThumbRow}`}
          >
            {photos.map((thumbnail, index) => {
              const isActivePhoto = index === photoIndex;

              return (
                <button
                  type="button"
                  key={`${id}-lead-photo-${index}`}
                  className={`${assetStyles.previewThumbButton} ${styles.leadPreviewThumbButton} ${isActivePhoto ? assetStyles.previewThumbButtonActive : ""}`}
                  onClick={() => {
                    onPhotoIndexChange(index);
                    onOpenPhoto(index);
                  }}
                  aria-label={`Open photo ${index + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnail}
                    alt={`${title} thumbnail ${index + 1}`}
                    className={`${assetStyles.previewThumbImage} ${styles.leadPreviewThumbImage}`}
                  />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className={assetStyles.assetDetailDivider} aria-hidden="true" />

      <div className={assetStyles.assetDetailsPanel}>
        {details}
        {children}
      </div>
    </div>
  );
}
