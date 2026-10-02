"use client";
import {useEffect, type ChangeEvent, type DragEvent} from 'react';
import {useLeadDialog} from './useLeadDialog';
import assetStyles from '../../app/asset-register/page.module.css';
import styles from '../../app/leads/page.module.css';
import dialogStyles from '../AccountDialog.module.css';
const formatByteSize=(n:number)=>n>=1024*1024?`${Math.round(n/1024/1024)} MB`:`${Math.ceil(n/1024)} KB`;
function CloseIcon({className}:{className?:string}){return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>}
function PdfIcon({className}:{className?:string}){return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg>}
export default function LeadNoteDialog({assetTitle,noteDraft,setNoteDraft,noteAttachmentFile,setNoteAttachmentFile,isSavingNote,isNoteAttachmentDragging,setIsNoteAttachmentDragging,handleLeadNoteAttachmentDrop,handleLeadNoteAttachmentChange,closeNoteModal,onSend,error,lockScroll=true}: {
 assetTitle:string;noteDraft:string;setNoteDraft:(v:string)=>void;noteAttachmentFile:File|null;setNoteAttachmentFile:(v:File|null)=>void;isSavingNote:boolean;isNoteAttachmentDragging:boolean;setIsNoteAttachmentDragging:(v:boolean)=>void;handleLeadNoteAttachmentDrop:(e:DragEvent<HTMLLabelElement>)=>void;handleLeadNoteAttachmentChange:(e:ChangeEvent<HTMLInputElement>)=>void;closeNoteModal:()=>void;onSend:()=>void;error?:string;lockScroll?:boolean;
}) {
 const dialogRef=useLeadDialog(closeNoteModal,isSavingNote);
 useEffect(()=>{if(!lockScroll)return;const b=document.body.style.overflow,h=document.documentElement.style.overflow;document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';return()=>{document.body.style.overflow=b;document.documentElement.style.overflow=h;};},[lockScroll]);
 return (
<div className={`${assetStyles.modalOverlay} ${styles.leadNoteOverlay}`} data-website-overlay>
          <div className={assetStyles.modalBackdrop} data-website-overlay onClick={closeNoteModal} />

          <section className={`${assetStyles.modalCard} ${assetStyles.sharedNoteModal} ${styles.leadNoteModal} ${dialogStyles.surface} ${dialogStyles.flush}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="lead-note-title">
            <div className={`${assetStyles.modalHeader} ${dialogStyles.header} ${styles.leadNoteHeader}`}>
              <div className={`${assetStyles.modalHeaderText} ${styles.leadModalTitleGroup}`}>
                <h3 id="lead-note-title">Send note or quote</h3>
                <p>{assetTitle}</p>
              </div>

              <button type="button" className={`${assetStyles.modalCloseButton} ${dialogStyles.close}`} onClick={closeNoteModal} aria-label="Close note modal" disabled={isSavingNote}>
                <CloseIcon className={assetStyles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.leadNoteBody} ${dialogStyles.body}`}>
              {error && <p role="alert">{error}</p>}
              <label className={`${assetStyles.field} ${assetStyles.sharedNoteField}`}>
                <span>Note to asset owner</span>
                <textarea
                  maxLength={4000}
                  className={assetStyles.sharedNoteTextarea}
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Example: Please find the attached quote PDF for this asset."
                  autoFocus
                />
              </label>

              <label
                className={`${styles.leadNoteAttachmentDropzone} ${isNoteAttachmentDragging ? styles.leadNoteAttachmentDropzoneDragging : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsNoteAttachmentDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsNoteAttachmentDragging(true);
                }}
                onDragLeave={() => setIsNoteAttachmentDragging(false)}
                onDrop={handleLeadNoteAttachmentDrop}
              >
                <input
                  className={styles.leadNoteAttachmentInput}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleLeadNoteAttachmentChange}
                  disabled={isSavingNote}
                />
                <PdfIcon className={styles.leadNoteAttachmentIcon} />
                <span className={styles.leadNoteAttachmentEyebrow}>Attach quote PDF — optional</span>
                <strong>Drop quote PDF here or click to upload</strong>
                <small>PDF only · maximum {formatByteSize(12 * 1024 * 1024)}.</small>
              </label>

              {noteAttachmentFile ? (
                <div className={styles.leadNoteAttachmentPreview}>
                  <div>
                    <strong>{noteAttachmentFile.name}</strong>
                    <span>{formatByteSize(noteAttachmentFile.size)}</span>
                  </div>
                  <button type="button" onClick={() => setNoteAttachmentFile(null)} disabled={isSavingNote}>
                    Remove PDF
                  </button>
                </div>
              ) : null}

              <p className={styles.leadNoteDeliveryHint}>This note and any attached quote will appear in the owner&apos;s Asset Register.</p>
            </div>

            <div className={`${assetStyles.formActions} ${assetStyles.sharedNoteActions} ${styles.leadNoteActions} ${dialogStyles.footer}`}>
              <button type="button" className={`${assetStyles.secondaryButton} ${styles.leadModalCancelButton}`} onClick={closeNoteModal} disabled={isSavingNote}>
                Cancel
              </button>
              <button type="button" className={assetStyles.primaryButton} onClick={() => onSend()} disabled={isSavingNote}>
                {isSavingNote ? 'Sending...' : 'Send note'}
              </button>
            </div>
          </section>
        </div>
 );
}
