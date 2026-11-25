'use client';

import { useEffect, useId, useRef, useState } from 'react';
import AssetActionIcon from './AssetActionIcon';
import css from './AssetMediaPanel.module.css';

type Upload = { label: string; count: number; limit?: number; disabled?: boolean; open: () => void };
type DocumentItem = { key: string; name: string; detail?: string; href?: string; open?: () => void; remove?: () => void };
type Photo = { key: string; src: string; label: string; main: boolean; pending?: boolean; makeMain?: () => void; remove?: () => void };
type Kind = 'documents' | 'photos';
const PHOTOS_PER_PAGE = 6;

type Props = {
  initialPhotoUrl?: string | null;
  documents: DocumentItem[];
  photos: Photo[];
  documentUpload?: Upload;
  photoUpload?: Upload;
};

function UploadButton({ kind, upload, onChoose }: { kind: Kind; upload: Upload; onChoose: () => void }) {
  return (
    <button type="button" className={css.upload} disabled={upload.disabled} onClick={onChoose}>
      <span className={css.icon}><AssetActionIcon action={kind === 'photos' ? 'addPhotos' : 'documents'} /></span>
      <strong>{upload.label}</strong>
      <span className={css.count} aria-label={`${upload.count} ${kind}${upload.limit ? ' of ' + upload.limit : ''}`}>
        {upload.count}{upload.limit ? ` / ${upload.limit}` : ''}
      </span>
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={css.remove} aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />
      </svg>
    </button>
  );
}

export default function AssetMediaPanel({ documents, photos, documentUpload, photoUpload, initialPhotoUrl }: Props) {
  const listId = useId();
  const [selection, setSelection] = useState<Kind>('photos');
  const [page, setPage] = useState(() => {
    const index = photos.findIndex(photo => photo.src === initialPhotoUrl);
    return Math.floor(Math.max(0, index) / PHOTOS_PER_PAGE);
  });
  const entryPhoto = useRef<HTMLLIElement>(null);
  useEffect(() => {
    entryPhoto.current?.focus();
  }, [initialPhotoUrl]);
  const hasBoth = documents.length > 0 && photos.length > 0;
  const kind = hasBoth ? selection : documents.length ? 'documents' : 'photos';
  const count = kind === 'photos' ? photos.length : documents.length;
  const size = kind === 'photos' ? PHOTOS_PER_PAGE : 4;
  const lastPage = Math.max(0, Math.ceil(count / size) - 1);
  const current = Math.min(page, lastPage);
  // Keep neighbouring photos visible when the last page is only partly filled.
  const start = kind === 'photos' ? Math.min(current * size, Math.max(0, count - size)) : current * size;
  const end = Math.min(start + size, count);
  const sectionTitle = kind === 'photos' ? 'Photos' : 'Documents';

  function show(next: Kind) {
    setSelection(next);
    setPage(0);
  }

  return (
    <section className={css.panel} aria-label="Documents and photos" data-asset-media>
      <div className={css.uploads}>
        {documentUpload && <UploadButton kind="documents" upload={documentUpload} onChoose={() => { show('documents'); documentUpload.open(); }} />}
        {photoUpload && <UploadButton kind="photos" upload={photoUpload} onChoose={() => { show('photos'); photoUpload.open(); }} />}
      </div>
      {count > 0 ? <>
        <div className={css.collectionHeader}>
          {hasBoth ? (
            <div className={css.switcher} role="group" aria-label="Show attachments">
              <button type="button" aria-pressed={kind === 'documents'} onClick={() => show('documents')}>Documents</button>
              <button type="button" aria-pressed={kind === 'photos'} onClick={() => show('photos')}>Photos</button>
            </div>
          ) : <h4>{sectionTitle}</h4>}
          {lastPage > 0 && (
            <nav className={css.pager} aria-label={`${sectionTitle} pages`}>
              <span className={css.range} role="status" aria-atomic="true">
                Showing {start + 1}{end > start + 1 && `–${end}`} of {count}
              </span>
              <button type="button" aria-controls={listId} aria-label={`Back to previous ${kind}`}
                disabled={current === 0} onClick={() => setPage(current - 1)}>
                <span className={css.previous} aria-hidden="true" /> Back
              </button>
              <button type="button" aria-controls={listId} aria-label={`Next ${kind}`}
                disabled={current === lastPage} onClick={() => setPage(current + 1)}>
                Next <span className={css.next} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
        {kind === 'photos' ? (
          <ul id={listId} className={css.gallery} aria-label="Asset photos">
            {photos.slice(start, start + size).map(photo => (
              <li key={photo.key} className={css.photo} data-main={photo.main}
                ref={photo.src === initialPhotoUrl ? entryPhoto : undefined}
                tabIndex={-1} aria-label={photo.label}>
                <div className={css.preview}>
                  <img src={photo.src} alt={photo.label} />
                  {photo.pending && <span>Ready to upload</span>}
                </div>
                {(photo.makeMain || photo.remove || photo.main) && <div className={css.photoActions}>
                  {photo.makeMain ? (
                    <button type="button" className={css.mainAction} aria-disabled={photo.main} tabIndex={photo.main ? -1 : 0}
                      aria-label={photo.main ? `Main photo: ${photo.label}` : `Set ${photo.label} as main photo`}
                      onClick={() => { if (!photo.main) { photo.makeMain?.(); setPage(0); } }}>
                      {photo.main && <span aria-hidden="true" className={css.check} />}
                      {photo.main ? 'Main photo' : 'Make main'}
                    </button>
                  ) : photo.main && <span className={css.mainLabel}><span aria-hidden="true" className={css.check} />Main photo</span>}
                  {photo.remove && <RemoveButton label={`Remove ${photo.label}`} onClick={photo.remove} />}
                </div>}
              </li>
            ))}
          </ul>
        ) : (
          <ul id={listId} className={css.documentList} aria-label="Asset documents">
            {documents.slice(start, start + size).map(doc => (
              <li key={doc.key} className={css.document}>
                <span className={css.icon}><AssetActionIcon action="documents" /></span>
                <div className={css.documentInfo}><strong>{doc.name}</strong>{doc.detail && <small>{doc.detail}</small>}</div>
                {doc.href ? <a className={css.open} href={doc.href} target="_blank" rel="noreferrer" aria-label={`Open ${doc.name}`}>Open</a> :
                  doc.open && <button type="button" className={css.open} onClick={doc.open} aria-label={`Open ${doc.name}`}>Open</button>}
                {doc.remove && <RemoveButton label={`Remove ${doc.name}`} onClick={doc.remove} />}
              </li>
            ))}
          </ul>
        )}
      </> : <p className={css.empty}>No documents or photos yet.</p>}
    </section>
  );
}
