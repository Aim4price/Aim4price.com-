"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import type { PublicAssetShare } from "../../lib/asset-share-links";
import ShareModalCloseButton from "./ShareModalCloseButton";
import BusinessAcceptanceForm from "../business-network/BusinessAcceptanceForm";
import { createPortal } from "../WebsitePortal";
import LeadCardSummary from "../leads/LeadCardSummary";
import LeadManageButton from "../leads/LeadManageButton";
import LeadAssetCard from "../leads/LeadAssetCard";
import LeadAssetDetails from "../leads/LeadAssetDetails";
import LeadAssetFacts from "../leads/LeadAssetFacts";
import LeadPhotoViewerModal from "../LeadPhotoViewerModal";
import assetStyles from "../../app/asset-register/page.module.css";
import leadStyles from "../../app/leads/page.module.css";
import dialogStyles from "../AccountDialog.module.css";
import styles from "./SharedAssetCards.module.css";

const money = (value: number | null) =>
  value != null && Number.isFinite(value) && value > 0
    ? `R ${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`
    : "Not saved";

export default function SharedAssetCards({
  share,
  request,
  actions,
  example = false,
  senderName = "",
  allowBusinessDetails = false,
}: {
  example?: boolean;
  share: PublicAssetShare | null;
  request?: ReactNode;
  actions?: ReactNode;
  senderName?: string;
  allowBusinessDetails?: boolean;
}) {
  const [opened, setOpened] = useState<number | null>(null);
  const [managed, setManaged] = useState<number | null>(null);
  const [photoIndexes, setPhotoIndexes] = useState<Record<number, number>>({});
  const [photoViewer, setPhotoViewer] = useState<{
    assetIndex: number;
    photoIndex: number;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const photoTrigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
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
      <header className={styles.header}>
        <span className={styles.brand}>
          Aim4price<span>.</span>
        </span>
        <span>
          {example ? "Example enquiry · fictional details" : "Asset enquiry"}
        </span>
      </header>
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
                  key={index}
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
                        details={
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
                        }
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
          <dialog
            ref={(node) => {
              dialog.current = node;
              if (node && !node.open) node.showModal();
            }}
            className={`${dialogStyles.surface} ${styles.manageDialog}`}
            aria-labelledby={titleId}
            onClose={() => {
              setManaged(null);
              trigger.current?.focus();
            }}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              const rect = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
              )
                dialog.current?.close();
            }}
          >
            <header className={dialogStyles.header}>
              <div>
                <h2 id={titleId}>{asset.title}</h2>
                <p>Manage enquiry</p>
              </div>
              <ShareModalCloseButton
                aria-label="Close enquiry management"
                onClick={() => dialog.current?.close()}
              />
            </header>
            <div className={dialogStyles.body}>
              {actions ? (
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
            </div>
          </dialog>,
          document.body,
        )}
    </main>
  );
}
