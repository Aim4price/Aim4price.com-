"use client";
import { PageHelpHeading } from '../../../components/PageHelp';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "../../../components/WebsitePortal";
import ShareModalCloseButton from "../../../components/asset-register/ShareModalCloseButton";
import { useLeadDialog } from "../../../components/leads/useLeadDialog";
import {
  WorkspaceTitlePanel,
  workspaceStyles,
} from "../../../components/WorkspacePrimitives";

import type { PartDetailField } from "../../../lib/parts-network-csv";
import PartsImportForm from "../../../components/PartsImportForm";
import ListPagination, { type ListPageSize } from "../../../components/ListPagination";
import PartsShareFlow from "../../../components/PartsShareFlow";
import PartsChoice from "../../../components/PartsChoice";
import PartsDescription from "../../../components/PartsDescription";
import PartsTableRegion from "../../../components/PartsTableRegion";
import PartsInbox from "../../../components/PartsInbox";
import WorkspaceViewSwitch from "../../../components/WorkspaceViewSwitch";
import PartEditDialog from "../../../components/PartEditDialog";

import styles from "./parts.module.css";
import reportStyles from "../../../components/ReportDownload.module.css";
import { appRealmForPath } from "../../../lib/app-realm";
type Network = {
  owner_business_name?: string;
  owner_town?: string;
  owner_vat_included?: boolean;
  owner_uploaded_at?: string;
  owned: boolean;
  list_mode: boolean;
  part_count: number;
  last_updated: string;
  id: string;
  name: string;
  status: string;
  role: string;
  revision: number;
  visible: boolean;
  business_name: string;
  town: string;
  phone: string;
  email: string;
  vat_included: boolean;
};
type Row = {
  details?: Record<string,string>;
  dealer_id: string;
  part_number: string;
  quantity: number;
  price: string | null;
  brand?: string;
  description?: string;
  business_name: string;
  town: string;
  phone: string;
  email: string;
  vat_included: boolean;
  uploaded_at: string;
};
type Member = Network & { dealer_id: string; last_viewed_at?: string };
type Invite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
};
const date = (s: string) =>
  s
    ? new Date(s).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No parts added";
async function api(body?: Record<string, unknown>, query = "") {
  const url = new URL("/api/parts-network" + query, window.location.origin);
  const membership = new URLSearchParams(window.location.search).get("desktopMembershipId");
  if (membership) url.searchParams.set("desktopMembershipId",membership);
  const r = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-aim4price-client-realm": window.location.pathname.startsWith(
        "/dealer/",
      )
        ? "dealer"
        : "website",
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Please try again.");
  return d;
}
function Icon({
  kind,
}: {
  kind:
    | "back"
    | "message"
    | "link"
    | "building"
    | "search"
    | "upload"
    | "users"
    | "mail"
    | "phone"
    | "table"
    | "list"
    | "share"
    | "manage"
    | "plus"
    | "open"
    | "edit"
    | "delete"
    | "download"
    | "eye";
}) {
  const paths = {
    table: "M3 4h18v16H3z M3 9h18 M3 14h18 M9 4v16",
    download: "M12 3v13 M7 11l5 5 5-5 M3 17v4h18v-4",
    back: "M19 12H5 M11 6l-6 6 6 6",
    message: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z",
    link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    building: "M3 21V7l9-4 9 4v14 M1 21h22 M7 21V11h10v10 M8 7h8",
    share:
      "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M9 10l6-4 M9 14l6 4",
    manage:
      "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    open: "M8 10l4 4 4-4",
    edit: "M4 20l1-5L16 4l4 4L9 19Z M14 6l4 4",
    delete: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    plus: "M12 4v16 M4 12h16",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    upload: "M12 16V3 M7 8l5-5 5 5 M3 15v6h18v-6",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-4",
    mail: "M3 5h18v14H3Z M3 5l9 7 9-7",
    phone: "M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c-9 3-20-8-16-16Z",
    list: "M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1",
  };
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
function Modal({
  title,
  onClose,
  busy,
  subtitle,
  manage = false,
  entry = false,
  edit = false,
  enquiry = false,
  destructive = false,
  download = false,
  access = false,
  sharing = false,
  progress,
  children,
}: {
  title: string;
  subtitle?: string;
  manage?: boolean;
  entry?: boolean;
  edit?: boolean;
  enquiry?: boolean;
  destructive?: boolean;
  download?: boolean;
  access?: boolean;
  sharing?: boolean;
  progress?: { value: number; label: string };
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const ref = useLeadDialog(onClose, busy);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return createPortal(
    <div className={styles.backdrop} data-website-overlay>
      <section
        ref={ref}
        className={`${styles.modal} ${manage ? styles.manageModal : ""} ${entry ? styles.entryModal : ""} ${edit ? styles.partEditorModal : ""} ${enquiry ? styles.enquiryModal : ""} ${destructive ? styles.deleteModal : ""} ${download ? reportStyles.dialog : ""} ${access ? styles.accessModal : ""} ${sharing ? styles.partsShareModal : ""}`}
        data-download-dialog={download ? "true" : undefined}
        role="dialog"
        aria-describedby={destructive ? "delete-parts-copy" : undefined}
        aria-modal="true"
        aria-label={title}
      >
        {!download && <div className={styles.closeWrap}>
          <ShareModalCloseButton onClick={onClose} disabled={busy} />
        </div>}
        <header className={styles.dialogHeader} data-download-header={download ? "true" : undefined}>
          {download ? <div><h2>{title}</h2></div> : <h2>{title}</h2>}
          {download && <ShareModalCloseButton onClick={onClose} disabled={busy} />}
          {subtitle && <p>{subtitle}</p>}
          {progress && <div className={styles.partsProgress} role="progressbar" aria-label="Parts workflow" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.value} aria-valuetext={progress.label}>
            <span key={progress.label} style={{width: `${progress.value}%`}} />
          </div>}
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export default function PartsClient({
  website = false,
  listId = "",
}: {
  website?: boolean;
  listId?: string;
}) {
  const [networks, setNetworks] = useState<Network[]>([]),
    [network, setNetwork] = useState(listId),
    [staff, setStaff] = useState(true),
    [desktop, setDesktop] = useState(false),
    [contribute, setContribute] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState<ListPageSize>(6);
  const [partsPageSize, setPartsPageSize] = useState<20 | 40 | 60 | "all">(20);
  const [detailFields,setDetailFields] = useState<PartDetailField[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [view, setView] = useState("search"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<Row[]>([]),
    [total, setTotal] = useState(0),
    [members, setMembers] = useState<Member[]>([]),
    [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [downloadFormat, setDownloadFormat] = useState<"pdf" | "xlsx">("pdf");
  const [reportName, setReportName] = useState("");
  const [modal, setModal] = useState<
      | "download"
      | "access"
      | "upload"
      | "invite"
      | "create"
      | "manage"
      | "delete"
      | "rename"
      | "share"
      | null
    >(null),
    [contact, setContact] = useState<Row | null>(null),
    [confirm, setConfirm] = useState<{
      dealerId: string;
      role: string;
      status: string;
    } | null>(null);
  const [details, setDetails] = useState({
      businessName: "",
      town: "",
      phone: "",
      email: "",
      vatIncluded: false,
    }),
    [inviteEmail, setInviteEmail] = useState(""),
    [inviteRole, setInviteRole] = useState("viewer"),
    [channel, setChannel] = useState("direct"),
    [listSearch, setListSearch] = useState(""),
    [opened, setOpened] = useState(Boolean(listId)),
    [enquiry, setEnquiry] = useState(""),
    [inviteUrl, setInviteUrl] = useState(""),
    [name, setName] = useState("");
  const [recipients, setRecipients] = useState<{email:string;business_name:string;town_city:string;account_type?:string;can_contribute?:boolean}[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  useEffect(()=>{
    if(modal!== 'invite' || channel!== 'direct' || !network) return;
    let cancelled=false; setRecipientsLoading(true); setRecipients([]);
    const timer=setTimeout(()=>{void api(undefined,`?view=recipients&network=${encodeURIComponent(network)}&search=${encodeURIComponent(recipientSearch)}`).then(d=>{if(!cancelled)setRecipients(d.recipients||[]);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setRecipientsLoading(false);});},250);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[modal,channel,network,recipientSearch]);
  const [rowRevision, setRowRevision] = useState<number | null>(null);
  const [importStage, setImportStage] = useState("choose");
  const [editStep, setEditStep] = useState<"intent" | "add" | "edit" | "picker" | "sheet">("intent");
  const [stock, setStock] = useState<{rows: Row[]; revision: number; fields:PartDetailField[]} | null>(null);
  const [partQuery, setPartQuery] = useState("");
  const [fromPicker, setFromPicker] = useState(false);
  const [editingPart, setEditingPart] = useState<{originalPartNumber:string;partNumber:string;quantity:string;price:string;brand:string;description:string;revision:number;priceIncluded:boolean;storedVatIncluded:boolean;details:Record<string,string>;extraFields:PartDetailField[]} | null>(null);
  const [enquiryCompose, setEnquiryCompose] = useState(false);
  const [enquiryPage, setEnquiryPage] = useState(0);
  const [selectedParts, setSelectedParts] = useState<Row[]>([]);
  const [requestedParts, setRequestedParts] = useState<{partNumber:string;quantity:string}[]>([]);
  useEffect(() => { setSelectedParts([]); }, [network, view]);
  function startEnquiry(parts: Row[]) {
    if (desktop) return;
    if (!parts.length) return;
    setContact(parts[0]);
    setRequestedParts(parts.map(r=>({partNumber:r.part_number,quantity:'1'})));
    setEnquiryCompose(false);
    setEnquiryPage(0);
    setEnquiry('Please confirm price and availability for these parts.');
  }
  const enquiryValid = requestedParts.length > 0 && requestedParts.every(r=>/^\d+$/.test(r.quantity) && Number(r.quantity)>0 && Number(r.quantity)<=999999999);
  const enquiryText = requestedParts.map(r=>`${r.partNumber} — quantity ${r.quantity}`).join('\n') + '\n\n' + enquiry;
  const basePath = website ? "/parts" : "/dealer/parts";
  function openList(id: string) {
    window.location.assign(`${basePath}/${encodeURIComponent(id)}${window.location.search}`);
  }
  const current = networks.find((n) => n.id === network);
  const singleDealer = Boolean(current?.list_mode);
  const showBrand = rows.some((row) => row.brand?.trim());
  const dealerName = singleDealer ? current?.owner_business_name || (current?.owned ? current.business_name : "") : "";
  const dealerTown = singleDealer ? current?.owner_town || (current?.owned ? current.town : "") : "";
  const uploadedAt = singleDealer ? current?.owner_uploaded_at || (current?.owned ? current.last_updated : "") : current?.last_updated;
  const [displayVatPreference, setDisplayVatPreference] = useState<boolean | null>(null);
  useEffect(() => { setDisplayVatPreference(null); }, [network]);
  const displayVatIncluded = displayVatPreference ?? current?.owner_vat_included ?? current?.vat_included ?? false;
  function displayedPrice(row: Row) {
    const price = Number(row.price);
    return row.vat_included === displayVatIncluded ? price : displayVatIncluded ? price * 1.15 : price / 1.15;
  }
  const active = current?.status === "active";
  const admin =
    contribute && !staff &&
    current?.role === "admin" &&
    (!current.list_mode || current.owned);
  const canUpload =
    contribute &&
    current?.role !== "viewer" &&
    active &&
    (!current?.list_mode || current.owned);
  const filteredLists = networks.filter(n => n.name.toLowerCase().includes(listSearch.trim().toLowerCase()));
  const listPageCount = listPageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredLists.length / listPageSize));
  const visibleListPage = Math.min(listPage, listPageCount);
  const visibleLists = listPageSize === "all" ? filteredLists : filteredLists.slice((visibleListPage - 1) * listPageSize, visibleListPage * listPageSize);
  useEffect(() => { setListPage(1); }, [listSearch]);
  const latest = useRef(0);
  const initialViewSet = useRef(false);
  const loadNetworks = useCallback(async () => {
    const d = await api();
    setNetworks(d.networks);
    if (listId && !initialViewSet.current) {
      initialViewSet.current = true;
      setView(d.networks.find((n: Network) => n.id === listId)?.owned ? "mine" : "search");
    }
    setStaff(d.staff);
    setDesktop(Boolean(d.desktop));
    setContribute(d.canContribute);
    setNetwork((old) =>
      d.networks.some((n: Network) => n.id === old) ? old : "",
    );
    return d;
  }, [listId]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("list");
    if (requested && !listId) {
      window.location.replace(`${website ? "/parts" : "/dealer/parts"}/${encodeURIComponent(requested)}`);
      return;
    }
    if (new URLSearchParams(window.location.search).get("view") === "members") setModal("access");
    void loadNetworks()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadNetworks, listId, website]);
  useEffect(() => {
    const request = ++latest.current;
    setRows([]);
    if (!network || !active || !opened) {
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void api(
        undefined,
        `?network=${network}&view=${view}&search=${encodeURIComponent(search)}&page=${page}&pageSize=${partsPageSize}`,
      )
        .then((d) => {
          if (request !== latest.current) return;
          setRows(d.rows || []);
          setDetailFields(d.fields || []);
          setRowRevision(d.member?.revision ?? null);
          setTotal(d.total || 0);
          const lastPage = partsPageSize === "all" ? 0 : Math.max(0, Math.ceil((d.total || 0) / partsPageSize) - 1);
          if (page > lastPage) setPage(lastPage);
          setError("");
        })
        .catch((e) => {
          if (request === latest.current) setError(e.message);
        })
        .finally(() => {
          if (request === latest.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [network, active, view, search, page, partsPageSize, refresh, opened]);
  useEffect(() => {
    if (modal !== "access" || !network || !admin) return;
    let cancelled = false;
    setMembers([]); setInvites([]); setAccessLoading(true);
    void api(undefined, `?network=${encodeURIComponent(network)}&view=members`)
      .then(d => { if (!cancelled) { setMembers(d.members || []); setInvites(d.invites || []); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setAccessLoading(false); });
    return () => { cancelled = true; };
  }, [modal, network, admin, refresh]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function mutate(body: Record<string, unknown>) {
    await api({ ...body, network });
    await loadNetworks();
    setRefresh((n) => n + 1);
  }
  function startPartEdit(r: Row, revision: number, picker: boolean) {
    setError("");
    setFromPicker(picker);
    setModal(null);
    setEditingPart({details:r.details || {},extraFields:picker ? stock?.fields || detailFields : detailFields,originalPartNumber:r.part_number,partNumber:r.part_number,quantity:String(r.quantity),price:r.price === null ? "" : String(Number(r.price) / (r.vat_included ? 1.15 : 1)),priceIncluded:r.vat_included,storedVatIncluded:r.vat_included,brand:r.brand || "",description:r.description || "",revision:revision});
  }
  async function openStockEditor(step: "picker" | "sheet") {
    await run(async () => {
      const data = await api(undefined, `?network=${encodeURIComponent(network)}&view=mine&download=true`);
      if (!Number.isInteger(data.member?.revision) || !Array.isArray(data.rows) || data.total !== data.rows.length)
        throw new Error("Could not load the complete parts list. Try again.");
      setStock({rows: data.rows, revision: data.member.revision,fields:data.fields || []});
      setDetails({businessName: data.member.business_name, town: data.member.town, phone: data.member.phone, email: data.member.email, vatIncluded: data.member.vat_included});
      setPartQuery("");
      setEditStep(step);
    });
  }
  const matchingParts = (stock?.rows ?? []).filter(r =>
    [r.part_number, r.description, r.brand].some(v => v?.toLowerCase().includes(partQuery.trim().toLowerCase())));
  function openUpload() {
    setEditStep("intent");
    setStock(null);
    setDetails({
      businessName: current?.business_name || "",
      town: current?.town || "",
      phone: current?.phone || "",
      email: current?.email || "",
      vatIncluded: current?.vat_included || false,
    });
    setModal("upload");
    setError("");
  }
  function switchView(next: string) {
    setView(next);
    setPage(0);
    setSearch("");
    setError("");
  }
  function close() {
    if (!busy) {
      if (editingPart) setRefresh(n=>n+1);
      setModal(null);
      setContact(null);
      setEditingPart(null);
      setConfirm(null);
      setError("");
    }
  }
  function openDownload() {
    setReportName(current?.name || "Parts");
    setDownloadFormat("pdf");
    setError("");
    setModal("download");
  }
  const detailActions = (
    <div className={`${styles.actions} ${styles.detailActions} ${styles.registerActions}`} aria-label="Stocklist actions">
      {admin && (
        <button
          className={styles.shareAction}
          data-tooltip="Share this parts list with another dealer."
          data-tooltip-style="description"
          onClick={() => {
            setInviteEmail("");
            setInviteUrl("");
            setModal("share");
          }}
        >
          <Icon kind="share" />
          Share
        </button>
      )}
      {canUpload && (
        <button className={styles.addPartsAction} onClick={openUpload} data-tooltip="Add parts manually or import your stocklist." data-tooltip-style="description">
          <Icon kind="upload" />
          Add / edit parts
        </button>
      )}
      {admin && (
        <button
          className={styles.manageAction}
          data-tooltip="Rename the list, update parts or manage shared access."
          data-tooltip-style="description"
          onClick={() => {
            setName(current?.name || "");
            setNotice("");
            setModal("manage");
          }}
        >
          <Icon kind="manage" />
          Manage
        </button>
      )}
      <button className={styles.primary} onClick={openDownload}><Icon kind="download" />Download</button>
      {view === "members" && (
        <button
          onClick={() =>
            switchView(current?.owned ? "mine" : "search")
          }
        >
          View parts
        </button>
      )}
    </div>
  );
  const feedback = (
    <>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
    </>
  );
  return (
    <main className={`${styles.page} ${listId ? styles.detailPage : ""}`}>
      <div className={`${workspaceStyles.shell} ${styles.shell}`}>
        {!listId && <WorkspaceTitlePanel title="PARTS STOCKLISTS" helpTopic="partsStock" className={styles.title} />}
        {!opened && <div className={styles.listToolbar}>
            <div className={styles.search}>
              <Icon kind="search" />
              <input
                aria-label="Search parts lists"
                data-tooltip="Find a parts list by name."
                data-tooltip-style="description"
                placeholder="Search parts lists"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>
          {!staff && contribute && !listId && (
            <button
              className={styles.addButton}
              data-tooltip="Create a list to add and share your parts stock."
              data-tooltip-style="description"
              onClick={() => {
                setName("");
                setModal("create");
              }}
            >
              <Icon kind="plus" />
              Add parts list
            </button>
          )}
        </div>}
        {!opened && (
          <>
            {!desktop && <PartsInbox
              showShared={false}
              onAccepted={() => {
                void loadNetworks();
              }}
            />}
            <div className={styles.cards}>
              {visibleLists.map((n) => (
                  <article
                    key={n.id}
                    className={styles.card}
                    data-tooltip="Open this list to browse its parts stock."
                    data-tooltip-style="description"
                    onClick={(e) => {
                      if (
                        (e.target as HTMLElement).closest(
                          "button,a,input,select,textarea",
                        )
                      )
                        return;
                      openList(n.id);
                    }}
                  >
                    <div className={styles.cardContent}>
                      <h2>{n.name}</h2>
                      <p>{date(n.last_updated)}</p>
                      {n.status !== "active" && (
                        <p>
                          {n.status === "pending"
                            ? "Awaiting approval"
                            : "Access suspended"}
                        </p>
                      )}
                      <span className={styles.cardKind}>
                        <Icon kind="list" />
                        {n.owned ? "Your parts list" : "Shared parts list"}
                      </span>
                    </div>
                    <div className={styles.cardAside}>
                      <div className={styles.cardCount}>
                        <strong>{(n.part_count || 0).toLocaleString("en-ZA")}</strong>
                        <span>{n.part_count === 1 ? "Part" : "Parts"}</span>
                      </div>
                    <div className={styles.cardActions}>
                      {n.owned && !staff && contribute && (
                        <button
                          className={styles.shareAction}
                          data-tooltip="Share this parts list with another dealer."
                          data-tooltip-style="description"
                          onClick={() => {
                            setNetwork(n.id);
                            setInviteEmail("");
                            setInviteUrl("");
                            setInviteRole("viewer");
                            setModal("share");
                          }}
                        >
                          <Icon kind="share" />
                          Share
                        </button>
                      )}
                      <button
                        className={styles.openAction}
                        data-tooltip="Browse parts, quantities and prices in this list."
                        data-tooltip-style="description"
                        onClick={() => {
                          openList(n.id);
                        }}
                      >
                        <Icon kind="open" />
                        Open
                      </button>
                      {n.owned && !staff && contribute && (
                        <button
                          className={styles.manageAction}
                          data-tooltip="Rename the list, update parts or manage shared access."
                          data-tooltip-style="description"
                          onClick={() => {
                            setNetwork(n.id);
                            setName(n.name);
                            setNotice("");
                            setModal("manage");
                          }}
                        >
                          <Icon kind="manage" />
                          Manage
                        </button>
                      )}
                    </div>
                    </div>
                  </article>
                ))}
            </div>
            <ListPagination label="Stocklists pagination" page={visibleListPage} pageCount={listPageCount} pageSize={listPageSize} onPageChange={setListPage} onPageSizeChange={size => { setListPageSize(size); setListPage(1); }} />
            {!loading &&
              !networks.some((n) =>
                n.name.toLowerCase().includes(listSearch.trim().toLowerCase()),
              ) && (
                <div className={styles.empty}>
                  <h2>{listSearch ? "No matching lists" : "Parts lists"}</h2>
                  <p>
                    {contribute ? "Add a list or accept a dealer’s invitation to get started." : "Accept a parts invitation to see the lists shared with you."}
                  </p>
                </div>
              )}
          </>
        )}
        {!modal && !contact && !confirm && feedback}
        {opened &&
          (!network ? (
            <div className={styles.empty}>
              {loading
                ? "Loading…"
                : staff
                  ? "This parts list is unavailable. Contact your account owner."
                  : "This parts list is unavailable. Return to your parts lists."}
            </div>
          ) : !active ? (
            <div className={styles.empty}>
              <h2>
                {current?.status === "pending"
                  ? "Awaiting approval"
                  : "Access suspended"}
              </h2>
              <p>The list owner controls access to these parts.</p>
              <button
                onClick={() =>
                  void run(async () => {
                    await loadNetworks();
                  })
                }
              >
                Check status
              </button>
            </div>
          ) : (
            <>
              <div className={`${styles.toolbar} ${styles.detailHeader}`}>
                <div>
                  <section className={`${workspaceStyles.titlePanel} ${styles.title} ${styles.stocklistTitle}`}>
                    <div>
                      <PageHelpHeading topic="partsList"><h1>{current?.name || "Parts list"}</h1></PageHelpHeading>
                      <WorkspaceViewSwitch href={basePath + (typeof window !== "undefined" ? window.location.search : "")} label="Back to parts stocklists" />
                    </div>
                  </section>

                </div>
              </div>
              {current?.owned && detailActions}
              {view !== "members" && (
                <>
                  <div className={styles.partsPanel}>
                  <div className={styles.listContext}>
                    {dealerName && <div className={styles.listDealer}><span>{dealerName}{dealerTown && <span className={styles.listTown}> · {dealerTown}</span>}</span></div>}
                    <div className={styles.listStatus}>
                      <span aria-live="polite">{loading ? "Loading…" : `${total.toLocaleString()} ${search.trim() ? "matching " : ""}${total === 1 ? "part" : "parts"}`}</span>
                      {uploadedAt && <span>Updated {date(uploadedAt)}</span>}
                    </div>
                    <div className={styles.displayVatToggle} role="group" aria-label="Display prices with or without VAT">
                      <button type="button" aria-pressed={!displayVatIncluded} onClick={() => setDisplayVatPreference(false)}>Excl. VAT</button>
                      <button type="button" aria-pressed={displayVatIncluded} onClick={() => setDisplayVatPreference(true)}>Incl. VAT</button>
                    </div>
                  </div>
                  <div className={styles.tableToolbar}>
                  <div className={styles.search}>
                    <Icon kind="search" />
                    <input
                      aria-label="Search part number"
                      placeholder="Search part number, description or brand"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                  {!current?.owned && <button className={styles.primary} onClick={openDownload}><Icon kind="download" />Download</button>}
                  </div>
                  {!current?.owned && <div className={styles.selectionBar}>
                    <span>{selectedParts.length} selected · Choose up to 50 parts from one dealer</span>
                    <button disabled={desktop || !selectedParts.length} onClick={()=>startEnquiry(selectedParts)}>Enquire about selected</button>
                    {!!selectedParts.length && <button onClick={()=>setSelectedParts([])}>Clear selection</button>}
                  </div>}

                  <PartsTableRegion>
                    <table className={`${styles.stockTable} ${!singleDealer ? styles.multiDealerTable : ''}`}>
                      <thead>
                        <tr>
                          {!current?.owned && <th className={styles.selectColumn}>Select</th>}
                          <th scope="col" className={styles.partNumberColumn}>Part number</th>
                          <th scope="col" className={styles.descriptionColumn}>Description</th>
                          {showBrand && <th scope="col" className={styles.brandColumn}>Brand</th>}
                          <th className={`${styles.numeric} ${styles.quantityColumn}`}>Quantity</th>
                          <th className={`${styles.numeric} ${styles.priceColumn}`}>Unit price</th>
                          {!singleDealer && <><th className={styles.dealerColumn}>Dealer</th><th className={styles.updatedColumn}>Last updated</th></>}
                          <th className={styles.contactColumn}>{current?.owned && canUpload ? "Edit" : "Enquiry"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={`${r.part_number}-${i}`}>
                            {!current?.owned && <td data-label="Select"><input type="checkbox" aria-label={`Select ${r.part_number}`} checked={selectedParts.some(p=>p.dealer_id===r.dealer_id&&p.part_number===r.part_number)} disabled={selectedParts.length>0 && selectedParts[0].dealer_id!==r.dealer_id || selectedParts.length>=50 && !selectedParts.some(p=>p.dealer_id===r.dealer_id&&p.part_number===r.part_number)} onChange={e=>setSelectedParts(e.target.checked?[...selectedParts,r]:selectedParts.filter(p=>p.dealer_id!==r.dealer_id||p.part_number!==r.part_number))}/></td>}
                            <td data-label="Part number" className={styles.partIdentity}>
                              <strong title={r.part_number}>{r.part_number}</strong>
                            </td>
                            <td data-label="Description" className={styles.partDescription}><PartsDescription description={r.description} details={detailFields.map(f=>({...f,value:r.details?.[f.id] || ''}))}/></td>
                            {showBrand && <td data-label="Brand" className={styles.partBrand}>{r.brand || "—"}</td>}
                            <td data-label="Quantity" className={`${styles.numeric} ${styles.partQuantity}`}>{r.quantity}</td>
                            <td data-label="Unit price" className={styles.numeric}>
                              <span className={r.price === null ? styles.priceOnRequest : styles.partPrice}>
                                {r.price === null ? "Price on request" : displayedPrice(r).toLocaleString("en-ZA", {
                                  style: "currency",
                                  currency: "ZAR",
                                })}
                              </span>
                            </td>
                            {!singleDealer && <><td data-label="Dealer">
                              {r.business_name}
                              <small>{r.town}</small>
                            </td>
                            <td data-label="Last updated">
                              {date(r.uploaded_at)}
                              {Date.now() - new Date(r.uploaded_at).getTime() >
                                45 * 86400000 && <small>Update overdue</small>}
                            </td></>}
                            <td className={styles.partAction}>
                              {current?.owned && canUpload && view === "mine" ? <button className={styles.partContactButton} disabled={rowRevision === null}
                                title="Edit this part" aria-label={`Edit ${r.part_number}`}
                                onClick={() => startPartEdit(r, rowRevision!, false)}>
                                <Icon kind="edit" />Edit
                              </button> : <button
                                className={styles.partContactButton}
                                title="Enquire about this part"
                                aria-label={`Contact ${r.business_name} about ${r.part_number}`}
                                onClick={() => {
                                  startEnquiry([r]);
                                }}
                              >
                                <Icon kind="message" />
                                {current?.owned ? "Contact" : "Enquire"}
                              </button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!rows.length && (
                      <div className={styles.tableEmpty}>
                        <Icon kind={search.trim() ? "search" : "upload"} />
                        <strong>{loading ? "Loading parts…" : search.trim() ? "No matching parts" : !uploadedAt ? "No parts added yet" : "No parts available"}</strong>
                        {!loading && !search.trim() && canUpload && <p>Add parts manually or import your stocklist.</p>}
                        {!loading && search.trim() && <button onClick={() => { setSearch(""); setPage(0); }}>Clear search</button>}
                      </div>
                    )}
                  </PartsTableRegion>
                  </div>
                  <div className={styles.topline}>
                    <small>
                      Confirm availability and price with the dealer.
                    </small>
                  </div>
                  <ListPagination label="Parts pagination" page={page + 1} pageCount={partsPageSize === "all" ? 1 : Math.max(1, Math.ceil(total / partsPageSize))} pageSize={partsPageSize} pageSizeOptions={[20, 40, 60, "all"] as const} disabled={loading} onPageChange={next => setPage(next - 1)} onPageSizeChange={size => { setPartsPageSize(size); setPage(0); }} />
                </>
              )}

            </>
          ))}
              {modal === "access" && !confirm && admin && (
                <Modal access title="Sharing & access" subtitle={current?.name} onClose={close} busy={busy}>
                  <div className={styles.accessBody} aria-busy={accessLoading}>
                    <div className={styles.accessIntro}><Icon kind="users" /><p>Control who can open this list.<small>Verify each dealership before approving access. Each dealer manages their own staff permissions.</small></p></div>
                    {accessLoading ? <p className={styles.accessEmpty} role="status">Loading dealers and invitations…</p> : <>
                      <section aria-labelledby="parts-dealers-title" className={styles.accessSection}>
                        <div className={styles.accessHeading}><h3 id="parts-dealers-title">Dealer access</h3><span>{members.length} {members.length === 1 ? "dealer" : "dealers"}</span></div>
                        {members.length === 0 && <p className={styles.accessEmpty}>No dealers have access yet. Share this list to invite a dealer.</p>}
                        {members.map(m => {
                          const owner = Boolean(current?.list_mode && m.role === "admin");
                          const roleLabel = (role: string) => role === "admin" ? "Administrator" : role === "contributor" ? "Contributor" : "Viewer";
                          return <article key={m.dealer_id} className={styles.accessCard}>
                            <div className={styles.accessIdentity}><strong>{m.business_name || "Details pending"}</strong><span>{[m.town, m.email].filter(Boolean).join(" · ") || "Contact details pending"}</span></div>
                            <span className={styles.accessStatus} data-status={m.status}>{m.status === "active" ? "Active" : m.status === "pending" ? "Awaiting approval" : "Access removed"}</span>
                            <div className={styles.accessDetails}>
                              <div><span>Role</span>{current?.list_mode || m.status === "pending" ? <strong>{owner ? "List owner" : roleLabel(m.role)}</strong> : <select aria-label={`Role for ${m.email}`} value={m.role} disabled={busy} onChange={e=>setConfirm({dealerId:m.dealer_id,role:e.target.value,status:m.status})}>{["admin","contributor","viewer"].map(role=><option key={role} value={role}>{roleLabel(role)}</option>)}</select>}</div>
                              <div><span>Last opened</span><strong>{m.last_viewed_at ? new Intl.DateTimeFormat("en-ZA", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(m.last_viewed_at)) : "Not opened yet"}</strong></div>
                            </div>
                            <div className={styles.accessAction}>{owner ? <span className={styles.accessOwner}>Owner access stays active</span> : <button type="button" data-danger={m.status === "active" || undefined} disabled={busy} onClick={()=>setConfirm({dealerId:m.dealer_id,role:m.role,status:m.status === "active" ? "suspended" : "active"})}>{m.status === "pending" ? "Approve access" : m.status === "active" ? "Remove access" : "Restore access"}</button>}</div>
                          </article>;
                        })}
                      </section>
                      <section aria-labelledby="parts-invitations-title" className={styles.accessSection}>
                        <div className={styles.accessHeading}><h3 id="parts-invitations-title">Invitations</h3><span>{invites.length} {invites.length === 1 ? "invitation" : "invitations"}</span></div>
                        {invites.length === 0 ? <div className={styles.accessEmpty}><Icon kind="share" /><div><strong>No invitations yet</strong><p>Use Share list to invite a dealer by link or inside Aim4price.</p></div></div> : invites.map(i=>{
                          const status = i.consumed_at ? "Accepted" : i.revoked_at ? "Revoked" : new Date(i.expires_at).getTime() < Date.now() ? "Expired" : "Pending";
                          return <article key={i.id} className={styles.accessCard}>
                            <div className={styles.accessIdentity}><strong>{i.email || "Private invitation link"}</strong><span>{i.role === "admin" ? "Administrator" : i.role === "contributor" ? "Contributor" : "Viewer"} · Expires {date(i.expires_at)}</span></div>
                            <span className={styles.accessStatus} data-status={status === "Accepted" ? "active" : status === "Pending" ? "pending" : "suspended"}>{status}</span>
                            {status === "Pending" && <div className={styles.accessAction}><button type="button" data-danger disabled={busy} onClick={()=>void run(async()=>{await mutate({action:"revoke",id:i.id});})}>Revoke invitation</button></div>}
                          </article>;
                        })}
                      </section>
                    </>}
                    {feedback}
                  </div>
                  <footer className={styles.accessFooter}><button type="button" disabled={busy} onClick={close}>Done</button><button type="button" className={styles.primary} disabled={busy} onClick={()=>setModal("share")}><Icon kind="share" />Share list</button></footer>
                </Modal>
              )}
        {modal === "manage" && (
          <Modal
            manage
            title={current?.name || "Parts list"}
            subtitle={`${current?.part_count || 0} ${current?.part_count === 1 ? "part" : "parts"} · ${date(current?.last_updated || "")}`}
            onClose={close}
            busy={busy}
          >
            <div className={styles.manageGrid}>
              <button onClick={() => setModal("rename")}>
                <Icon kind="edit" />
                <span>
                  <strong>Rename list</strong>
                  <small>Change this list’s name.</small>
                </span>
              </button>
              {canUpload && (
                <button
                  data-tone="blue"
                  onClick={() => {
                    openUpload();
                  }}
                >
                  <Icon kind="upload" />
                  <span>
                    <strong>Add / edit parts</strong>
                    <small>Enter parts or import a stocklist.</small>
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  setModal("access");
                }}
              >
                <Icon kind="users" />
                <span>
                  <strong>Sharing &amp; access</strong>
                  <small>Manage invitations and access.</small>
                </span>
              </button>
              <button type="button" data-tone="amber" onClick={() => setModal("share")}>
                <Icon kind="share" />
                <span>
                  <strong>Share</strong>
                  <small>Share this parts list.</small>
                </span>
              </button>
              {canUpload && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await mutate({
                        action: "visibility",
                        visible: !current?.visible,
                      });
                    })
                  }
                >
                  <Icon kind="eye" />
                  <span>
                    <strong>
                      {current?.visible ? "Hide my list" : "Show my list"}
                    </strong>
                    <small>
                      {current?.visible
                        ? "Pause visibility for other dealers."
                        : "Show parts to approved dealers."}
                    </small>
                  </span>
                </button>
              )}
              <button data-tone="green" onClick={openDownload}>
                <Icon kind="download" /><span><strong>Download</strong><small>Export this list as PDF or Excel.</small></span>
              </button>
              <button
                className={styles.deleteAction}
                onClick={() => setModal("delete")}
              >
                <Icon kind="delete" />
                <span>
                  <strong>Delete list</strong>
                  <small>Delete list and shared access.</small>
                </span>
              </button>
            </div>
            {feedback}
          </Modal>
        )}
        {modal === "rename" && (
          <Modal title="Rename parts list" onClose={close} busy={busy}>
            <label>
              List name
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className={styles.modalFooter}>
              <button onClick={() => setModal("manage")}>Back</button>
              <button
                className={styles.primary}
                disabled={busy || !name.trim()}
                onClick={() =>
                  void run(async () => {
                    await mutate({ action: "rename", name });
                    setModal(null);
                  })
                }
              >
                Save name
              </button>
            </div>
            {feedback}
          </Modal>
        )}
        {modal === "delete" && (
          <Modal destructive title="Delete this parts list?" onClose={close} busy={busy}>
            <p id="delete-parts-copy" className={styles.deleteCopy}>
              This removes the list from Parts Stock and stops shared access.
              Your master stock records and cost ledger stay unchanged.
            </p>
            <div className={styles.deleteSummary}>
              <span>Selected parts list</span>
              <strong>{current?.name || "Parts list"}</strong>
              {current?.part_count != null && <small>{current.part_count.toLocaleString()} {current.part_count === 1 ? "part" : "parts"}</small>}
            </div>
            {feedback}
            <div className={styles.deleteFooter}>
              <button type="button" disabled={busy} onClick={() => setModal("manage")}>Cancel</button>
              <button
                type="button"
                className={styles.deleteConfirm}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await mutate({ action: "archive" });
                    if (listId) window.location.assign(basePath);
                    else { setOpened(false); setNetwork(""); setModal(null); }
                  })
                }
              >
                {busy ? "Deleting…" : "Yes, delete parts list"}
              </button>
            </div>
          </Modal>
        )}
        {modal === "create" && (
          <Modal title="Add parts list" onClose={close} busy={busy}>
            <label>
              List name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </label>
            <p>
              For example: Landini parts, John Deere parts or Second-hand parts.
            </p>
            {feedback}
            <div className={styles.modalFooter}>
              <button disabled={busy} onClick={close}>
                Cancel
              </button>
              <button
                className={styles.primary}
                disabled={busy || !name.trim()}
                onClick={() =>
                  void run(async () => {
                    const d = await api({ action: "create", name });
                    await loadNetworks();
                    openList(d.id);
                  })
                }
              >
                <Icon kind="plus" />
                Create list
              </button>
            </div>
          </Modal>
        )}
        {modal === "share" && current?.list_mode && <PartsShareFlow name={current.name} count={current.part_count || 0} network={network} api={api} onClose={close}/> }
        {modal === "share" && !current?.list_mode && (
          <Modal
            title={current?.name || "Parts list"}
            subtitle={`${current?.part_count || 0} ${current?.part_count === 1 ? "part" : "parts"} · Private dealer sharing`}
            onClose={close}
            busy={busy}
          >
            <div className={styles.shareChoices}>
              <button
                data-tone="amber"
                onClick={() => {
                  setChannel("link"); setInviteEmail(""); setInviteRole("viewer");
                  setModal("invite");
                }}
              >
                <Icon kind="link" />
                <span>
                  <strong>Send link</strong>
                  <small>Create a private invitation link</small>
                </span>
              </button>
              <button
                onClick={() => {
                  setChannel("direct"); setInviteEmail(""); setInviteRole("viewer"); setRecipientSearch("");
                  setModal("invite");
                }}
              >
                <Icon kind="building" />
                <span>
                  <strong>Inside Aim4price</strong>
                  <small>Share with an Aim4price dealer</small>
                </span>
              </button>
            </div>
            <div className={styles.shareHistory}>
              <button
                onClick={() => {
                  setModal("access");
                }}
              >
                <Icon kind="users" />
                <strong>Sharing &amp; access</strong>
                <span>Manage invitations and dealers</span>
                <Icon kind="open" />
              </button>
            </div>
          </Modal>
        )}
        {modal === "invite" && (
          <Modal
            sharing
            title={channel === "link" ? "Send link" : "Choose a dealer or business"}
            subtitle={current?.name}
            onClose={close}
            busy={busy}
          >
            {inviteUrl ? (
              <>
                <p>
                  Send this private link to <strong>{inviteEmail}</strong>. Only
                  that email can accept it. The link expires in seven days.
                </p>
                <label>
                  Invitation link
                  <input
                    readOnly
                    value={inviteUrl}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(inviteUrl);
                      setNotice("Link copied.");
                    })
                  }
                >
                  Copy link
                </button>
              </>
            ) : (
              <>
                <div className={styles.shareRecipientSection}>
                  {channel === 'direct' ? <>
                    <label className={styles.shareSearch}>Find a dealer or business<input aria-label="Find sharing recipient" value={recipientSearch} onChange={e=>{setRecipientSearch(e.target.value);setInviteEmail("");setInviteRole("viewer");}} placeholder="Search business name, email or town"/></label>
                    <div className={styles.shareRecipientResults} aria-label="Sharing recipients" aria-busy={recipientsLoading}>
                      <p role="status">{recipientsLoading ? "Searching accounts…" : `${recipients.length}${recipients.length === 50 ? "+" : ""} ${recipients.length === 1 ? "account" : "accounts"}`}</p>
                      {!recipientsLoading && recipients.map(r=><button type="button" key={r.email} className={styles.shareRecipientCard} aria-pressed={inviteEmail===r.email} onClick={()=>{setInviteEmail(r.email);setInviteRole("viewer");}}>
                        <span className={styles.shareAccountIcon} aria-hidden="true"><Icon kind="share"/></span>
                        <span><strong>{r.business_name || r.email}</strong><small>{r.email}</small></span>
                        <span><strong>{r.town_city || "Location not provided"}</strong><small>{r.account_type === "business" ? "Business account" : "Dealer account"}</small></span>
                        <span className={styles.shareSelectBadge}>{inviteEmail===r.email ? "Selected" : "Select"}</span>
                      </button>)}
                      {!recipientsLoading && !recipients.length && <p>No matching dealer or business accounts. Try another name or town, or use Send link.</p>}
                    </div>
                  </> : <label>Recipient email<input type="email" autoComplete="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="name@business.co.za"/></label>}
                  <PartsChoice label="Their access" value={inviteRole} onChange={setInviteRole} options={[
                    {value:"viewer",label:"View and enquire",hint:"View and download parts, and send enquiries. Cannot edit parts or manage sharing."},
                    ...(!current?.list_mode ? [
                      {value:"contributor",label:"View and contribute",hint:"View, enquire and update their own dealership’s parts. Cannot manage sharing.",disabled:channel==='direct' && !recipients.find(r=>r.email===inviteEmail)?.can_contribute},
                      {value:"admin",label:"View, contribute and manage sharing",hint:"Also invite accounts, approve access and manage network members.",disabled:channel==='direct' && !recipients.find(r=>r.email===inviteEmail)?.can_contribute}
                    ] : [])
                  ]}/>
                  {current?.list_mode && <p className={styles.shareAccessNote}>Editing this stocklist and managing its sharing stay with the owner.</p>}
                </div>
                <p>
                  {channel === "direct"
                    ? "Only this account can accept the share inside Aim4price."
                    : "Only this email can accept the link. They sign in, verify their email and wait for your approval."}
                </p>

              </>
            )}
            <div className={styles.modalFooter}>
              <button
                disabled={busy}
                onClick={() => {
                  setInviteUrl("");
                  setError("");
                  setNotice("");
                  setModal("share");
                }}
              >
                Back
              </button>
              {!inviteUrl && (<button
                  className={styles.primary}
                  disabled={busy || !inviteEmail}
                  onClick={() =>
                    void run(async () => {
                      const d = await api({
                        action: "invite",
                        network,
                        email: inviteEmail,
                        role: inviteRole,
                        channel,
                      });
                      if (channel === "link") setInviteUrl(d.url);
                      else {
                        setModal(null);
                        setNotice(
                          "Shared inside Aim4price. The recipient can accept it in Parts Stock or Leads.",
                        );
                      }
                      setRefresh((n) => n + 1);
                    })
                  }
                >
                  {channel === "link"
                    ? "Create sharing link"
                    : "Share inside Aim4price"}
                </button>)}
            </div>
            {feedback}
          </Modal>
        )}
        {modal === "upload" && (
          <Modal entry progress={editStep === "add" && importStage.startsWith("import-") ? undefined : {value: editStep === "intent" ? 20 : editStep === "edit" ? 40 : editStep === "picker" ? 60 : importStage === "review" ? 100 : importStage === "settings" ? 80 : editStep === "add" && (importStage === "choose" || importStage === "example") ? 40 : 60, label: editStep === "intent" ? "Choose add or edit" : editStep === "edit" ? "Choose how to edit" : editStep === "picker" ? "Choose a specific part" : importStage === "review" ? "Review parts before saving" : importStage === "settings" ? "Parts settings" : importStage === "choose" && editStep === "add" ? "Choose how to add parts" : importStage === "file" ? "Upload or paste parts" : importStage === "mapping" ? "Match file columns" : "Enter or edit parts"}} title={editStep === "add" && importStage.startsWith("import-") ? "Import parts" : {intent:"Add / edit parts",add:"Add parts",edit:"Edit parts",picker:"Choose part",sheet:"Edit in a sheet"}[editStep]} subtitle={current?.name} onClose={close} busy={busy}>
            {(editStep === "intent" || editStep === "edit") && <>
              <div className={`${styles.shareChoices} ${styles.entryMethods} ${styles.partsIntent}`}>
                {editStep === "intent" ? <>
                  <button data-tone="blue" disabled={busy} onClick={() => setEditStep("add")}><Icon kind="plus"/><span><strong>Add parts</strong><small>Enter or import new parts</small></span></button>
                  <button data-tone="green" disabled={busy} onClick={() => setEditStep("edit")}><Icon kind="edit"/><span><strong>Edit parts</strong><small>Change parts already on this list</small></span></button>
                </> : <>
                  <button data-tone="blue" disabled={busy} onClick={() => void openStockEditor("picker")}><Icon kind="edit"/><span><strong>Edit a specific part</strong><small>Search and select a specific part</small></span></button>
                  <button data-tone="green" disabled={busy} onClick={() => void openStockEditor("sheet")}><Icon kind="table"/><span><strong>Edit in a sheet</strong><small>Change multiple parts together</small></span></button>
                </>}
              </div>
              {feedback}
              {editStep === "edit" && <div className={styles.entryFooter}><button disabled={busy} onClick={() => {setError("");setEditStep("intent");}}>Back</button></div>}
            </>}
            {editStep === "picker" && stock && <>
              <div className={styles.partPickerSearch}><Icon kind="search"/>
                <input aria-label="Search parts to edit" placeholder="Search part number, description or brand" value={partQuery} onChange={e => {setPartQuery(e.target.value);}} />
                <button disabled={!partQuery} onClick={() => {setPartQuery("");}}>Clear</button>
              </div>
              <p className={styles.partPickerCount} role="status">
                {matchingParts.length.toLocaleString()} {partQuery.trim() ? "matching " : ""}{matchingParts.length === 1 ? "part" : "parts"}
              </p>
              <div key={partQuery} className={styles.partPickerResults} role="region" aria-label="Parts to edit" tabIndex={0}>
                {matchingParts.map(r => (
                  <button key={r.part_number} onClick={() => startPartEdit(r, stock.revision, true)}>
                    <span><strong>{r.part_number}</strong>{r.description && <small>{r.description}</small>}<small>{[r.brand, `Quantity: ${r.quantity}`].filter(Boolean).join(" · ")}</small></span>
                    <span className={styles.partPickerEdit}><Icon kind="edit"/>Edit part</span>
                  </button>
                ))}
                {!matchingParts.length && <p>{partQuery.trim() ? "No matching parts." : "There are no parts to edit yet."}</p>}
              </div>
              <div className={`${styles.actions} ${styles.partEditFooter}`}><button onClick={() => setEditStep("edit")}>Back</button><button onClick={close}>Cancel</button></div>
            </>}
            {(editStep === "add" || (editStep === "sheet" && stock)) && <PartsImportForm
              listName={current?.name}
              onStageChange={setImportStage}
              initialDetails={details}
              initialFields={editStep === "sheet" ? stock?.fields || detailFields : detailFields}
              editSnapshot={editStep === "sheet" && stock ? {revision: stock.revision, rows: stock.rows.map(r => [r.part_number, r.description ?? "", String(r.quantity), r.price ?? "", r.brand ?? "", ...stock.fields.map(f=>r.details?.[f.id] || "")])} : undefined}
              onBack={() => setEditStep(editStep === "sheet" ? "edit" : "intent")}
              request={body => api({ ...body, network })}
              onBusyChange={setBusy}
              onComplete={async (addAnother) => {
                await loadNetworks();
                setRefresh(n => n + 1);
                if (!addAnother) setModal(null);
                switchView("mine");
                setNotice("Parts list updated successfully.");
              }}
            />}
          </Modal>
        )}
        {modal === "download" && <Modal title="Download parts" onClose={close} busy={busy} download>
          <div data-download-body="true">
            <label className={styles.downloadName}>PARTS LIST / REPORT NAME<input maxLength={150} value={reportName} disabled={busy} onChange={e=>setReportName(e.target.value)} /></label>
            <div data-download-grid="true" aria-label="Parts download format">
              {(["pdf", "xlsx"] as const).map(format=><button key={format} type="button" data-download-option="true" aria-pressed={downloadFormat === format} disabled={busy} onClick={()=>setDownloadFormat(format)}>
                <span data-download-icon="true"><img src={format === "pdf" ? "/brand/pdf.png" : "/brand/sheet.png"} alt="" /></span>
                <span data-download-copy="true"><strong>{format === "pdf" ? "PDF report" : "XLSX workbook"}</strong><small>{format === "pdf" ? "Printable parts stock list." : "Parts records in Excel."}</small></span>
              </button>)}
            </div>
            <p className={styles.downloadScope}>{search.trim() ? `Matching parts for “${search.trim()}”` : "Complete parts list"} · {displayVatIncluded ? "Incl. VAT" : "Excl. VAT"}</p>
          </div>
          {feedback}
          <footer data-download-footer="true">
            <button type="button" disabled={busy} onClick={close}>Cancel</button>
            <button type="button" data-download-primary="true" disabled={busy || !reportName.trim()} onClick={()=>void run(async()=>{
              const { buildPartsWorkbook } = await import("../../../lib/parts-network-report");
              const vatLabel = displayVatIncluded ? "Incl. VAT" : "Excl. VAT";
              const fileName = reportName.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\.+$/g, "") || "Parts";
              let blob: Blob;
              if (downloadFormat === "pdf") {
                const query = new URLSearchParams({network,view:current?.owned ? "mine" : "search",search,format:"pdf",vat:displayVatIncluded ? "incl" : "excl",title:reportName.trim()});
                const membership = new URLSearchParams(window.location.search).get("desktopMembershipId");
                if (membership) query.set("desktopMembershipId", membership);
                const response = await fetch(`/api/parts-network?${query}`, {
                  credentials:"same-origin", cache:"no-store", signal:AbortSignal.timeout(90000),
                  headers:{"x-aim4price-client-realm":appRealmForPath(window.location.pathname) ?? "website"},
                });
                if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("The PDF could not be prepared. Please try again.");
                blob = await response.blob();
              } else {
                const data=await api(undefined,`?network=${network}&view=${current?.owned ? "mine" : "search"}&search=${encodeURIComponent(search)}&download=true`);
                const exportRows = (data.rows as Row[]).map(r=>({details:Object.fromEntries((data.fields as PartDetailField[] || []).filter(f=>r.details?.[f.id]).map(f=>[f.label+(f.private ? " (private)" : ""),r.details![f.id]])),part:r.part_number,description:r.description || "",brand:r.brand || "",quantity:r.quantity,price:r.price === null ? null : Number(displayedPrice(r).toFixed(2)),vat:vatLabel,dealer:r.business_name,town:r.town || ""}));
                const book = await buildPartsWorkbook(exportRows);
                blob = new Blob([new Uint8Array(await book.xlsx.writeBuffer())], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
              }
              const url=URL.createObjectURL(blob);
              const link=document.createElement("a");link.href=url;link.download=fileName+"."+downloadFormat;
              document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
              setModal(null);setNotice("Parts download ready.");
            })}>{busy ? "Preparing…" : `Download ${downloadFormat === "pdf" ? "PDF" : "Excel"}`}</button>
          </footer>
        </Modal>}
        {editingPart && <PartEditDialog value={editingPart} onChange={setEditingPart} subtitle={current?.name} busy={busy} feedback={feedback} onClose={close}
          backLabel={fromPicker ? "Back" : "Cancel"} onBack={fromPicker ? () => {setEditingPart(null);setError("");setModal("upload");} : close}
          onSave={()=>void run(async()=>{
            await api({action:"edit-part",network,...editingPart,price:editingPart.price.trim() ? (Number(editingPart.price) * (editingPart.storedVatIncluded ? 1.15 : 1)).toFixed(2) : ""});
            setEditingPart(null);setRefresh(n=>n+1);await loadNetworks();setNotice("Part updated successfully.");
          })}/>}
        {contact && (
          <Modal enquiry title="Parts enquiry" subtitle={current?.name} onClose={close} busy={busy}>
            <div className={styles.enquiryBody}>
              <section className={styles.enquiryDealer} aria-label="Dealer details">
                <div><h3>{contact.business_name}</h3>{contact.town && <p>{contact.town}</p>}</div>
                {contact.uploaded_at && <span>Stocklist updated<br /><strong>{date(contact.uploaded_at)}</strong></span>}
              </section>
              <section className={styles.enquiryItems} aria-label="Requested parts">
                <div className={styles.enquirySectionHeading}><h3>Requested parts</h3><span>{requestedParts.length} {requestedParts.length === 1 ? "part" : "parts"}</span></div>
                <div className={styles.enquiryTableWrap}>
                  <table className={styles.enquiryTable}>
                    <thead><tr><th scope="col">Part number</th><th scope="col">Quantity</th></tr></thead>
                    <tbody>{requestedParts.slice(enquiryPage * 2, enquiryPage * 2 + 2).map((r,i)=>{
                      const valid = /^\d+$/.test(r.quantity) && Number(r.quantity)>0 && Number(r.quantity)<=999999999;
                      return <tr key={r.partNumber}>
                        <td><strong>{r.partNumber}</strong>{requestedParts.length === 1 && contact.description && <small>{contact.description}</small>}</td>
                        <td><input aria-label={`Requested quantity for ${r.partNumber}`} aria-invalid={!valid} aria-describedby={!valid ? "parts-enquiry-quantity-error" : undefined} inputMode="numeric" value={r.quantity} onChange={e=>setRequestedParts(requestedParts.map((p,n)=>n===enquiryPage * 2 + i?{...p,quantity:e.target.value}:p))}/></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
                {requestedParts.length > 2 && <nav className={styles.enquiryPagination} aria-label="Requested parts pages">
                  <button disabled={enquiryPage === 0} onClick={()=>setEnquiryPage(p=>p-1)}>Previous</button>
                  <span>{enquiryPage + 1} / {Math.ceil(requestedParts.length / 2)}</span>
                  <button disabled={(enquiryPage + 1) * 2 >= requestedParts.length} onClick={()=>setEnquiryPage(p=>p+1)}>Next</button>
                </nav>}
                {!enquiryValid && <p id="parts-enquiry-quantity-error" role="alert" className={styles.error}>Enter a positive whole quantity for each part.</p>}
              </section>
              {enquiryCompose && !current?.owned && <label className={styles.enquiryMessage}>
                Message to dealer
                <textarea value={enquiry} maxLength={2000} rows={3} onChange={e=>setEnquiry(e.target.value)} />
              </label>}
              {!enquiryCompose && <section className={styles.enquiryChannels} aria-label="Contact dealer">
                <div className={styles.enquirySectionHeading}><h3>Contact dealer</h3></div>
                <div className={styles.enquiryContactGrid}>
                  <button type="button" className={styles.enquiryContact} data-tone="green" disabled={Boolean(current?.owned) || desktop}
                    onClick={()=>setEnquiryCompose(true)}>
                    <span className={styles.enquiryContactIcon}><Icon kind="message" /></span><span><strong>Aim4price</strong><small>{current?.owned ? "For other dealers" : desktop ? "Account holder only" : "Send to dealer’s Leads"}</small></span>
                  </button>
                  {contact.phone && <a className={styles.enquiryContact} href={"tel:" + contact.phone.replace(/[^+0-9]/g, "")}>
                    <span className={styles.enquiryContactIcon}><Icon kind="phone" /></span><span><strong>Call</strong><small>{contact.phone}</small></span>
                  </a>}
                  {contact.email && <a className={styles.enquiryContact} data-tone="blue" onClick={e=>{if(!enquiryValid)e.preventDefault();}} aria-disabled={!enquiryValid}
                    href={`mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent("Parts enquiry: " + current?.name)}&body=${encodeURIComponent(enquiryText)}`}>
                    <span className={styles.enquiryContactIcon}><Icon kind="mail" /></span><span><strong>Email</strong><small>{contact.email}</small></span>
                  </a>}
                  {contact.phone && <a className={styles.enquiryContact} data-tone="green" target="_blank" rel="noopener noreferrer" onClick={e=>{if(!enquiryValid)e.preventDefault();}} aria-disabled={!enquiryValid}
                    href={"https://wa.me/" + contact.phone.replace(/\D/g, "").replace(/^0/, "27") + "?text=" + encodeURIComponent(enquiryText)}>
                    <span className={styles.enquiryContactIcon}><Icon kind="message" /></span><span><strong>WhatsApp</strong><small>Message dealer</small></span>
                  </a>}
                </div>
                <p className={styles.enquiryHint}>Confirm availability and price with the dealer.</p>
              </section>}
              {feedback}
            </div>
            {(!current?.owned || (contribute && website)) && <footer className={styles.enquiryFooter}>
              {contribute && website && <a className={styles.enquiryLedger} href="/dealer-costs">Open client cost ledger <span aria-hidden="true">→</span></a>}
              {enquiryCompose && <button disabled={busy} onClick={()=>setEnquiryCompose(false)}>Back</button>}
              {enquiryCompose && !current?.owned && <button className={styles.primary} disabled={desktop || busy || !enquiry.trim() || !enquiryValid} onClick={()=>void run(async()=>{
                await api({action:"enquire",network,dealerId:contact.dealer_id,items:requestedParts.map(r=>({partNumber:r.partNumber,quantity:Number(r.quantity)})),message:enquiry});
                setContact(null);setSelectedParts([]);setNotice("Enquiry sent. The dealer can find it in Leads.");
              })}><Icon kind="message" />{busy ? "Sending…" : "Send via Aim4price"}</button>}
            </footer>}
          </Modal>
        )}
        {confirm && (
          <Modal title="Update member access" onClose={() => { if (!busy) { setConfirm(null); setError(""); } }} busy={busy}>
            <p>
              {confirm.status === "active"
                ? "Confirm that you have verified this dealership and approve its access."
                : "This stops the dealership and its staff accessing this parts list and hides its contributions."}
            </p>
            <p>Role: {confirm.role}</p>
            {feedback}
            <button
              className={styles.primary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await mutate({ action: "member", ...confirm });
                  setConfirm(null);
                })
              }
            >
              Confirm
            </button>
          </Modal>
        )}
      </div>
    </main>
  );
}
