"use client";
import { creditAction,CreditNotice } from '../BusinessCreditControls';
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { PublicAssetShare } from "../../lib/asset-share-links";
import SharedAssetValueDialog from "../leads/SharedAssetValueDialog";
import SharedCardValue from "../leads/SharedCardValue";
import SharedProblems from "../leads/SharedProblems";
import ExternalLeadActions, { type ExternalLeadActionData } from "./ExternalLeadActions";
import LeadManageDialog from "../leads/LeadManageDialog";
import BusinessAcceptanceForm from "../business-network/BusinessAcceptanceForm";
import { createPortal } from "../WebsitePortal";
import RecipientAssetSummary from "../leads/RecipientAssetSummary";
import sharedStyles from "../../app/leads/shared-assets.module.css";
import SharedAssetExport from "../leads/SharedAssetExport";
import SharedAssetSend from "./SharedAssetSend";
import LeadManageButton from "../leads/LeadManageButton";
import LeadAssetCard from "../leads/LeadAssetCard";
import { useOutsideCardDismiss } from "../leads/useOutsideCardDismiss";
import LeadAssetDetails from "../leads/LeadAssetDetails";
import SharedAssetFacts, {factStatusMark as statusMark} from "../leads/SharedAssetFacts";
import {useRouter} from "next/navigation";
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
  guestReturnTo, creditToken, shareToken, initialAssetId, trackViews,
}: {
  example?: boolean;
  share: PublicAssetShare | null;
  request?: ReactNode;
  actions?: ReactNode;
  enquiry?: ExternalLeadActionData;
  senderName?: string;
  allowBusinessDetails?: boolean;
  initialAssetId?: string; trackViews?: boolean;
  guestReturnTo?: string; creditToken?: string; shareToken?: string;
}) {
  const router=useRouter();
  const openAttempt = useRef(0);
  function availabilityUrl(assetId?: string, includeReports = false) {
    if (!shareToken || !assetId) return undefined;
    const query = new URLSearchParams({asset:assetId});
    if (includeReports && enquiry?.permissions.reports) {
      for (const report of enquiry.reports) query.append('report', report.id);
    }
    return `/api/asset-share-links/${shareToken}/activity?${query}`;
  }
  async function openAsset(index: number, assetId?: string) {
    const attempt = ++openAttempt.current;
    const url = availabilityUrl(assetId);
    if (url && !await fetch(url, {method:'HEAD', cache:'no-store'}).then(r => r.ok).catch(() => false)) {
      router.refresh();
      return;
    }
    if (attempt === openAttempt.current) setOpened(index);
  }
  const [creditError,setCreditError]=useState('');
  const manageBusy=useRef(false);
  const visit=useRef<{token:string;assetKey:string;requestId:string}|null>(null);
  const attempt=useRef<{assetKey:string;requestId:string}|null>(null);
  function closeVisit(){
    const current=visit.current;
    visit.current=null;attempt.current=null;
    if(current) void creditAction(current,'manage','close',current.requestId).catch(()=>{});
  }
  useEffect(()=>{
    window.addEventListener('pagehide',closeVisit);
    return ()=>{window.removeEventListener('pagehide',closeVisit);closeVisit();};
  },[creditToken]);
  async function openManage(index:number){
    if(!creditToken){setManaged(index);return;}
    if(manageBusy.current || visit.current)return;
    manageBusy.current=true;
    const assetKey=share?.assets[index]?.assetId||String(index);
    if(attempt.current?.assetKey!==assetKey)attempt.current={assetKey,requestId:crypto.randomUUID()};
    const current={token:creditToken,...attempt.current};
    try{
      await creditAction(current,'manage','complete',current.requestId);
      visit.current=current;setManaged(index);
    }catch(e){setCreditError(e instanceof Error?e.message:'Could not open Manage.');}
    finally{manageBusy.current=false;}
  }
  const [manageSuspended, setManageSuspended] = useState(false);
  const [valueAsset,setValueAsset]=useState<{id:string;title:string}|null>(null);
  const [vatIncluded,setVatIncluded]=useState<Record<string,boolean>>({});
  const [opened, setOpened] = useState<number | null>(null);
  const openedCardRef = useOutsideCardDismiss(opened !== null, () => setOpened(null));
  const [managed, setManaged] = useState<number | null>(null);
  const [photoIndexes, setPhotoIndexes] = useState<Record<number, number>>({});
  const [photoViewer, setPhotoViewer] = useState<{
    assetIndex: number;
    photoIndex: number;
  } | null>(null);
  const selectionKey=share?.assets.map(asset=>asset.assetId||asset.title).join('|')||'';
  useEffect(()=>{
    closeVisit();
    const index = initialAssetId ? share?.assets.findIndex(asset => asset.assetId === initialAssetId) : -1;
    setOpened(index != null && index >= 0 ? index : null);
    setManaged(null);
    setPhotoViewer(null);
  },[selectionKey, initialAssetId]);
  const viewedId = opened === null ? undefined : share?.assets[opened]?.assetId;
  useEffect(()=>{
    if (viewedId && viewedId === initialAssetId) document.getElementById('asset-'+viewedId)?.scrollIntoView({block:'center'});
  },[viewedId,initialAssetId]);
  useEffect(()=>{
    if (trackViews && viewedId && shareToken) {
      void fetch(`/api/asset-share-links/${shareToken}/activity?asset=${encodeURIComponent(viewedId)}`, {method:'POST', keepalive:true}).catch(()=>{});
    }
  },[trackViews,shareToken,viewedId]);
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
      {creditError&&<CreditNotice message={creditError} onClose={()=>setCreditError('')}/>}
      {valueAsset&&enquiry&&createPortal(<SharedAssetValueDialog endpoint={`/api/asset-share-links/${enquiry.token}/assets/${valueAsset.id}`} assetTitle={valueAsset.title} field="current" onClose={()=>setValueAsset(null)} onSaved={()=>router.refresh()}/>,document.body)}
      <section className={assetStyles.shell}>
      {!share ? (
        <section className={styles.empty}>
          <h1>This link is no longer available</h1>
          <p>Ask the sender for a new asset link.</p>
        </section>
      ) : (
        <>
          <header className={styles.shareHeader}>
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
          </header>
          <div className={`${leadStyles.leadStack} ${styles.assets}`}>
            {share.assets.map((item, index) => {
              const isOpen = opened === index;
              const photoIndex = photoIndexes[index] ?? 0;
              return (
                <article
                  key={item.assetId || index}
                  id={item.assetId ? `asset-${item.assetId}` : undefined}
                  ref={isOpen ? openedCardRef : null}
                  className={sharedStyles.frame}
                >
                  {isOpen ? (
                    <div className={sharedStyles.detailActions}>
                      <button type="button" className={`${sharedStyles.toggle} ${sharedStyles.secondary}`} aria-expanded={true}
                        aria-controls={`${panelPrefix}-${index}`} aria-label={`Close ${item.title}`} onClick={() => setOpened(null)}>Close</button>
                    </div>
                  ) : (
                  <RecipientAssetSummary
                    title={item.title}
                    sender={senderName || share.senderName}
                    date={date}
                    pills={item.serialNumber ? ["Shared asset", `Serial / VIN ${item.serialNumber}`] : ["Shared asset"]}
                    action={
                      <button
                        type="button"
                        className={sharedStyles.toggle}
                        aria-expanded={false}
                        aria-controls={`${panelPrefix}-${index}`}
                        aria-label={`Open ${item.title}`}
                        onClick={() => void openAsset(index, item.assetId)}
                      >
                        Open
                      </button>
                    }
                  />
                  )}
                  {isOpen && (
                    <LeadAssetCard
                      identity={
                        <>
                          <h2>{item.title}</h2>
                          {item.serialNumber && <p className={sharedStyles.detailIdentity}>Serial / VIN {item.serialNumber}</p>}
                          {(example || !senderName) && (senderName || share.senderName) && <p className={sharedStyles.detailIdentity}>{senderName || share.senderName}</p>}
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
                          <SharedCardValue onOpen={enquiry&&item.assetId&&(enquiry.access==='owner'||(enquiry.access==='active'&&enquiry.permissions.suggestValue))?()=>setValueAsset({id:item.assetId!,title:item.title}):undefined} value={item.valueExVat} included={!!vatIncluded[item.assetId||String(index)]} onToggle={()=>setVatIncluded(current=>({...current,[item.assetId||String(index)]:!current[item.assetId||String(index)]}))}/>
                          <div
                            className={`${assetStyles.assetHeaderActions} ${leadStyles.leadAssetHeaderActions} ${leadStyles.exportHeaderActions}`}
                          >
                            <SharedAssetExport availabilityUrl={availabilityUrl(item.assetId, true)} creditTarget={creditToken?{token:creditToken,assetKey:item.assetId||String(index)}:undefined} signInReturnTo={guestReturnTo} title={item.title} photos={item.photoUrls} asset={item} attachments={enquiry && enquiry.permissions.reports && ['owner','active','read-only'].includes(enquiry.access) ? enquiry.reports.map(report => ({name:report.label, url:`/api/asset-share-links/${enquiry.token}/reports/${report.id}`})) : []}/>
                            {enquiry && item.assetId && <SharedAssetSend creditTarget={creditToken?{token:creditToken,assetKey:item.assetId}:undefined} enquiry={enquiry} assetId={item.assetId} assetTitle={`${item.title}${senderName ? ` · ${senderName}` : ""}`}/>}
                            <LeadManageButton
                              label={`Manage ${item.title}`}
                              onClick={(event) => {
                                trigger.current = event.currentTarget;
                                void openManage(index);
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

                          <SharedAssetFacts vatIncluded={!!vatIncluded[item.assetId||String(index)]} assetTitle={item.title} serial={item.serialNumber} year={item.yearModel} usage={item.usage} condition={item.condition} replacementPrice={item.replacementPriceExVat} marketAssessment={item.marketAssessment}
                            statuses={{finance:statusMark(item.financeStatus),insurance:statusMark(item.insuranceStatus),license:statusMark(item.licenseStatus),location:statusMark(item.mapped===undefined?'unknown':item.mapped?'yes':'no')}}
                            permissions={enquiry && item.assetId && ['active','owner'].includes(enquiry.access) ? {
                              serial:enquiry.access==='owner'||enquiry.permissions.serialNumber,
                              replacement:enquiry.access==='owner'||enquiry.permissions.replacementPrice,
                              market:enquiry.access==='owner'||enquiry.permissions.marketPrice,
                              year:enquiry.access==='owner'||enquiry.permissions.updateDetails||enquiry.permissions.yearModel,
                              usage:enquiry.access==='owner'||enquiry.permissions.updateDetails||enquiry.permissions.usage,
                              condition:enquiry.access==='owner'||enquiry.permissions.updateDetails||enquiry.permissions.condition,
                              finance:enquiry.access==='owner'||enquiry.permissions.updateDetails,
                              insurance:enquiry.access==='owner'||enquiry.permissions.updateDetails,
                              license:enquiry.access==='owner'||enquiry.permissions.updateDetails,
                              location:enquiry.access==='owner'||enquiry.permissions.location,
                            } : {}}
                            endpoint={`/api/asset-share-links/${enquiry?.token}/assets/${item.assetId}`} sourceId={`${enquiry?.token}:${item.assetId}`} externalShare={enquiry && item.assetId ? {token:enquiry.token,assetId:item.assetId}:undefined} directUpdates={enquiry?.access==='owner'||enquiry?.permissions.directUpdates} onSaved={()=>router.refresh()}/>
                        </>}
                      >
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
          <LeadManageDialog suspended={manageSuspended} title={asset.title} description={`Year Model: ${asset.yearModel || "Not saved"} • Usage: ${asset.usage || "Not saved"} • Condition: ${asset.condition || "Not saved"}`} onClose={() => { closeVisit(); setManaged(null); trigger.current?.focus(); }}>
              {visit.current && <div className={assetStyles.assetHeaderActions}>
                {enquiry?.reply && asset.assetId && <SharedAssetSend enquiry={enquiry} assetId={asset.assetId} assetTitle={asset.title} creditTarget={{...visit.current,visitId:visit.current.requestId}} onDialogChange={setManageSuspended}/>}
                <SharedAssetExport availabilityUrl={availabilityUrl(asset.assetId, true)} title={asset.title} asset={asset} photos={asset.photoUrls} attachments={enquiry?.permissions.reports?enquiry.reports.map(report=>({name:report.label,url:`/api/asset-share-links/${enquiry.token}/reports/${report.id}` })):[]} creditTarget={{...visit.current,visitId:visit.current.requestId}} onDialogChange={setManageSuspended}/>
              </div>}
              {enquiry ? <ExternalLeadActions creditVisit={visit.current||undefined} key={asset.assetId||managed} {...enquiry} onDialogChange={setManageSuspended} assetSubtitle={`Year Model: ${asset.yearModel || "Not saved"} • Usage: ${asset.usage || "Not saved"} • Condition: ${asset.condition || "Not saved"}`} assetTitle={asset.title} assetIndex={managed!} assetId={asset.assetId} serialNumber={asset.serialNumber||''} replacementPrice={asset.replacementPriceExVat}/> : actions ? (
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
