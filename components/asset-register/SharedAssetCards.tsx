"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { PublicAssetShare } from "../../lib/asset-share-links";
import SharedProblems from "../leads/SharedProblems";
import ExternalLeadActions, { type ExternalLeadActionData } from "./ExternalLeadActions";
import LeadManageDialog from "../leads/LeadManageDialog";
import BusinessAcceptanceForm from "../business-network/BusinessAcceptanceForm";
import { createPortal } from "../WebsitePortal";
import LeadCardSummary from "../leads/LeadCardSummary";
import SharedAssetSend from "./SharedAssetSend";
import LeadManageButton from "../leads/LeadManageButton";
import LeadAssetCard from "../leads/LeadAssetCard";
import { useOutsideCardDismiss } from "../leads/useOutsideCardDismiss";
import LeadAssetDetails from "../leads/LeadAssetDetails";
import LeadAssetFacts from "../leads/LeadAssetFacts";
import LeadPhotoViewerModal from "../LeadPhotoViewerModal";
import assetStyles from "../../app/asset-register/page.module.css";
import leadStyles from "../../app/leads/page.module.css";
import styles from "./SharedAssetCards.module.css";

const money = (value: number | null) =>
  value != null && Number.isFinite(value) && value > 0
    ? `R ${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`
    : "Not saved";

export default function SharedAssetCards({
  share,
  request,
  actions,
  enquiry,
  example = false,
  senderName = "",
  allowBusinessDetails = false,
}: {
  example?: boolean;
  share: PublicAssetShare | null;
  request?: ReactNode;
  actions?: ReactNode;
  enquiry?: ExternalLeadActionData;
  senderName?: string;
  allowBusinessDetails?: boolean;
}) {
  const [opened, setOpened] = useState<number | null>(null);
  const openedCardRef = useOutsideCardDismiss(opened !== null, () => setOpened(null));
  const [managed, setManaged] = useState<number | null>(null);
  const [photoIndexes, setPhotoIndexes] = useState<Record<number, number>>({});
  const [photoViewer, setPhotoViewer] = useState<{
    assetIndex: number;
    photoIndex: number;
  } | null>(null);
  const selectionKey=share?.assets.map(asset=>asset.assetId||asset.title).join('|')||'';
  useEffect(()=>{setOpened(null);setManaged(null);setPhotoViewer(null);},[selectionKey]);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const photoTrigger = useRef<HTMLElement | null>(null);
  const panelPrefix = useId();
  const asset = managed == null ? null : share?.assets[managed];
  const viewedAsset = photoViewer
    ? share?.assets[photoViewer.assetIndex]
    : null;
  const date = share
    ? new Date(share.createdAt).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Johannesburg",
      })
    : "";
  return (
    <main
      className={`${assetStyles.page} ${leadStyles.leadsPage} ${leadStyles.dealerOwnerParity} ${leadStyles.dealerDesktopLeads} ${styles.page}`}
    >
      <section className={assetStyles.shell}>
      {!share ? (
        <section className={styles.empty}>
          <h1>This link is no longer available</h1>
          <p>Ask the sender for a new asset link.</p>
        </section>
      ) : (
        <>
          <div className={styles.intro}>
            <h1>
              {example
                ? "Example enquiry"
                : senderName
                  ? `Enquiry from ${senderName}`
                  : "Your asset enquiry"}
            </h1>
            <span>
              {example
                ? "Fictional assets for illustration."
                : `${share.assets.length} ${share.assets.length === 1 ? "asset" : "assets"} shared on ${date}.`}
            </span>
          </div>
          {request}
          <div className={`${leadStyles.leadStack} ${styles.assets}`}>
            {share.assets.map((item, index) => {
              const isOpen = opened === index;
              const photoIndex = photoIndexes[index] ?? 0;
              return (
                <article
                  key={item.assetId || index}
                  ref={isOpen ? openedCardRef : null}
                  className={`${leadStyles.leadThread} ${leadStyles.leadThreadTracking} ${isOpen ? leadStyles.leadThreadOpen : ""}`}
                >
                  <LeadCardSummary
                    identity={
                      <>
                        <div className={leadStyles.leadCardTitleRow}>
                          <h3>{item.title}</h3>
                        </div>
                        <div className={leadStyles.leadAssetContext}>
                          {senderName && (
                            <strong className={leadStyles.leadAssetName}>
                              {senderName}
                            </strong>
                          )}
                          {item.serialNumber && (
                            <span className={leadStyles.leadAssetIdentifier}>
                              Serial {item.serialNumber}
                            </span>
                          )}
                        </div>
                        <span className={leadStyles.clientKicker}>
                          Asset enquiry · Shared {date}
                        </span>
                      </>
                    }
                    actions={
                      <div className={leadStyles.clientActionRow}>
                        <button
                          type="button"
                          className={`${isOpen ? assetStyles.secondaryButton : assetStyles.primaryButton} ${isOpen ? leadStyles.closeLeadButton : leadStyles.openLeadButton}`}
                          aria-expanded={isOpen}
                          aria-controls={`${panelPrefix}-${index}`}
                          aria-label={`${isOpen ? "Close" : "Open"} ${item.title}`}
                          onClick={() => setOpened(isOpen ? null : index)}
                        >
                          {isOpen ? "Close" : "Open"}
                        </button>
                      </div>
                    }
                  />
                  {isOpen && (
                    <LeadAssetCard
                      identity={
                        <>
                          <h2>{item.title}</h2>
                          <p>
                            Year Model: {item.yearModel || "Not saved"} · Usage:{" "}
                            {item.usage || "Not saved"} · Condition:{" "}
                            {item.condition || "Not saved"}
                          </p>
                          <div className={assetStyles.assetMetaRow}>
                            <span className={assetStyles.assetValueMethodLabel}>
                              Saved estimate
                            </span>
                            <span className={assetStyles.assetSavedDateLabel}>
                              Shared {date}
                            </span>
                          </div>
                        </>
                      }
                      aside={
                        <>
                          <div
                            className={`${assetStyles.valueBlock} ${leadStyles.leadValueBlock}`}
                          >
                            <strong>{money(item.valueExVat)}</strong>
                            <span>Excl. VAT</span>
                          </div>
                          <div
                            className={`${assetStyles.assetHeaderActions} ${leadStyles.leadAssetHeaderActions}`}
                          >
                            {enquiry && item.assetId && <SharedAssetSend enquiry={enquiry} assetId={item.assetId} assetTitle={`${item.title}${senderName ? ` · ${senderName}` : ""}`}/>}
                            <LeadManageButton
                              label={`Manage ${item.title}`}
                              onClick={(event) => {
                                trigger.current = event.currentTarget;
                                setManaged(index);
                              }}
                            />
                          </div>
                        </>
                      }
                    >
                      <LeadAssetDetails
                        id={`${panelPrefix}-${index}`}
                        title={item.title}
                        photos={item.photoUrls}
                        photoIndex={photoIndex}
                        onPhotoIndexChange={(next) =>
                          setPhotoIndexes((current) => ({
                            ...current,
                            [index]: next,
                          }))
                        }
                        onOpenPhoto={(next) => {
                          photoTrigger.current =
                            document.activeElement as HTMLElement;
                          setPhotoViewer({
                            assetIndex: index,
                            photoIndex: next,
                          });
                        }}
                        details={<>
                          {enquiry && item.assetId && (enquiry.permissions.loggedProblems || enquiry.access === 'owner') && ['owner','active','read-only'].includes(enquiry.access) && <SharedProblems endpoint={`/api/asset-share-links/${enquiry.token}/assets/${item.assetId}/problems`} assetTitle={item.title} notesOnly canWrite={enquiry.access !== 'read-only'}/>}

                          <LeadAssetFacts
                            rows={[
                              {
                                label: "Serial",
                                value: item.serialNumber || "Not saved",
                              },
                              {
                                label: "Year",
                                value: item.yearModel || "Not saved",
                              },
                              {
                                label: "Usage",
                                value: item.usage || "Not saved",
                              },
                              {
                                label: "Condition",
                                value: item.condition || "Not saved",
                              },
                            ]}
                            statuses={
                              <>
                                {["Financed", "Insured", "Licensed"].map(
                                  (label) => (
                                    <div
                                      key={label}
                                      className={assetStyles.assetStatusRow}
                                    >
                                      <span>{label}</span>
                                      <strong
                                        className={`${assetStyles.assetStatusMark} ${assetStyles.statusMarkUnknown}`}
                                        aria-label={`${label}: not shared`}
                                        title="Not shared"
                                      >
                                        ?
                                      </strong>
                                    </div>
                                  ),
                                )}
                              </>
                            }
                          />
                        </>}
                      >
                        <div
                          className={assetStyles.assetReplacementPriceBubble}
                        >
                          <span>Replacement Price</span>
                          <strong>{money(item.replacementPriceExVat)}</strong>
                          <small>Excl. VAT</small>
                        </div>
                      </LeadAssetDetails>
                    </LeadAssetCard>
                  )}
                </article>
              );
            })}
          </div>
          {allowBusinessDetails && (
            <details className={styles.businessDetails}>
              <summary>Add your business details</summary>
              <BusinessAcceptanceForm embedded />
            </details>
          )}
          <p className={styles.note}>
            Only the details selected by the sender are shared. Values are saved
            estimates and remain subject to inspection.
          </p>
        </>
      )}
      </section>
      {viewedAsset && photoViewer && (
        <LeadPhotoViewerModal
          assetKey={`${panelPrefix}-${photoViewer.assetIndex}`}
          title={viewedAsset.title}
          urls={viewedAsset.photoUrls}
          initialIndex={photoViewer.photoIndex}
          onClose={() => {
            setPhotoViewer(null);
            photoTrigger.current?.focus();
          }}
        />
      )}
      {asset &&
        createPortal(
          <LeadManageDialog title={asset.title} description={`Year Model: ${asset.yearModel || "Not saved"} • Usage: ${asset.usage || "Not saved"} • Condition: ${asset.condition || "Not saved"}`} onClose={() => { setManaged(null); trigger.current?.focus(); }}>
              {enquiry ? <ExternalLeadActions key={asset.assetId||managed} {...enquiry} assetTitle={asset.title} assetIndex={managed!} assetId={asset.assetId} serialNumber={asset.serialNumber||''} replacementPrice={asset.replacementPriceExVat}/> : actions ? (
                <section aria-label="Enquiry actions">
                  <p className={styles.note}>
                    These actions apply to the shared enquiry.
                  </p>
                  {actions}
                </section>
              ) : (
                <p className={styles.note}>
                  The sender has shared asset details only. No reports or reply
                  actions were included.
                </p>
              )}
          </LeadManageDialog>,
          document.body,
        )}
    </main>
  );
}
