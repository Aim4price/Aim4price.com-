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
import PartsImportForm from "../../../components/PartsImportForm";
import PartsInbox from "../../../components/PartsInbox";
import WorkspaceViewSwitch from "../../../components/WorkspaceViewSwitch";
import VatPriceInput from "../../../components/VatPriceInput";
import priceStyles from "../../../components/asset-register/AssetDisposal.module.css";
import styles from "./parts.module.css";
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
  enquiry = false,
  destructive = false,
  children,
}: {
  title: string;
  subtitle?: string;
  manage?: boolean;
  entry?: boolean;
  enquiry?: boolean;
  destructive?: boolean;
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
    <div className={styles.backdrop}>
      <section
        ref={ref}
        className={`${styles.modal} ${manage ? styles.manageModal : ""} ${entry ? styles.entryModal : ""} ${enquiry ? styles.enquiryModal : ""} ${destructive ? styles.deleteModal : ""}`}
        role="dialog"
        aria-describedby={destructive ? "delete-parts-copy" : undefined}
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.closeWrap}>
          <ShareModalCloseButton onClick={onClose} disabled={busy} />
        </div>
        <header className={styles.dialogHeader}>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
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
  const [recipients, setRecipients] = useState<{email:string;business_name:string;town_city:string}[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  useEffect(()=>{
    if(modal!== 'invite' || channel!== 'direct' || !network) return;
    let cancelled=false; setRecipientsLoading(true); setRecipients([]);
    const timer=setTimeout(()=>{void api(undefined,`?view=recipients&network=${encodeURIComponent(network)}&search=${encodeURIComponent(recipientSearch)}`).then(d=>{if(!cancelled)setRecipients(d.recipients||[]);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setRecipientsLoading(false);});},250);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[modal,channel,network,recipientSearch]);
  const [rowRevision, setRowRevision] = useState<number | null>(null);
  const [editingPart, setEditingPart] = useState<{originalPartNumber:string;partNumber:string;quantity:string;price:string;brand:string;description:string;revision:number;priceIncluded:boolean;storedVatIncluded:boolean} | null>(null);
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
  const tableMinWidth = 1000 + (showBrand ? 160 : 0) + (!current?.owned ? 70 : 0) + (!singleDealer ? 420 : 0);
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
    setTotal(0);
    if (!network || !active || !opened) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void api(
        undefined,
        `?network=${network}&view=${view}&search=${encodeURIComponent(search)}&page=${page}`,
      )
        .then((d) => {
          if (request !== latest.current) return;
          setRows(d.rows || []);
          setRowRevision(d.member?.revision ?? null);
          setTotal(d.total || 0);
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
  }, [network, active, view, search, page, refresh, opened]);
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
  function openUpload() {
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
          Add / update parts
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
      <button className={styles.primary} onClick={()=>setModal("download")}><Icon kind="download" />Download</button>
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
              {networks
                .filter((n) =>
                  n.name
                    .toLowerCase()
                    .includes(listSearch.trim().toLowerCase()),
                )
                .map((n) => (
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
              {detailActions}
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
                  </div>
                  {!current?.owned && <div className={styles.selectionBar}>
                    <span>{selectedParts.length} selected · Choose up to 50 parts from one dealer</span>
                    <button disabled={desktop || !selectedParts.length} onClick={()=>startEnquiry(selectedParts)}>Enquire about selected</button>
                    {!!selectedParts.length && <button onClick={()=>setSelectedParts([])}>Clear selection</button>}
                  </div>}

                  <div
                    className={`${styles.tableWrap} ${styles.stockTableScroll}`}
                    tabIndex={0}
                    role="region"
                    aria-label="Parts results"
                  >
                    <table className={styles.stockTable} style={{ minWidth: tableMinWidth }}>
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
                            {!current?.owned && <td><input type="checkbox" aria-label={`Select ${r.part_number}`} checked={selectedParts.some(p=>p.dealer_id===r.dealer_id&&p.part_number===r.part_number)} disabled={selectedParts.length>0 && selectedParts[0].dealer_id!==r.dealer_id || selectedParts.length>=50 && !selectedParts.some(p=>p.dealer_id===r.dealer_id&&p.part_number===r.part_number)} onChange={e=>setSelectedParts(e.target.checked?[...selectedParts,r]:selectedParts.filter(p=>p.dealer_id!==r.dealer_id||p.part_number!==r.part_number))}/></td>}
                            <td className={styles.partIdentity}>
                              <strong>{r.part_number}</strong>
                            </td>
                            <td className={styles.partDescription}>{r.description || "—"}</td>
                            {showBrand && <td className={styles.partBrand}>{r.brand || "—"}</td>}
                            <td className={styles.numeric}>{r.quantity}</td>
                            <td className={styles.numeric}>
                              <span className={r.price === null ? styles.priceOnRequest : styles.partPrice}>
                                {r.price === null ? "Price on request" : displayedPrice(r).toLocaleString("en-ZA", {
                                  style: "currency",
                                  currency: "ZAR",
                                })}
                              </span>
                            </td>
                            {!singleDealer && <><td>
                              {r.business_name}
                              <small>{r.town}</small>
                            </td>
                            <td>
                              {date(r.uploaded_at)}
                              {Date.now() - new Date(r.uploaded_at).getTime() >
                                45 * 86400000 && <small>Update overdue</small>}
                            </td></>}
                            <td>
                              {current?.owned && canUpload && view === "mine" ? <button className={styles.partContactButton} disabled={rowRevision === null}
                                title="Edit this part" aria-label={`Edit ${r.part_number}`}
                                onClick={()=>{setError("");setEditingPart({originalPartNumber:r.part_number,partNumber:r.part_number,quantity:String(r.quantity),price:r.price === null ? "" : String(Number(r.price) / (r.vat_included ? 1.15 : 1)),priceIncluded:r.vat_included,storedVatIncluded:r.vat_included,brand:r.brand || "",description:r.description || "",revision:rowRevision!});}}>
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
                  </div>
                  </div>
                  <div className={styles.topline}>
                    <small>
                      Confirm availability and price with the dealer.
                    </small>
                    {total > 50 && <div className={styles.actions}>
                      <button
                        disabled={loading || page === 0}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <span>Page {page + 1}</span>
                      <button
                        disabled={loading || (page + 1) * 50 >= total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>}
                  </div>
                </>
              )}

            </>
          ))}
              {modal === "access" && !confirm && admin && (
                <Modal title="Sharing & access" subtitle={current?.name} onClose={close} busy={busy}>
                  {accessLoading && <p role="status">Loading access…</p>}
                  <p>
                    Verify the dealership independently before approving access.
                    Staff permissions remain controlled by each dealership
                    owner.
                  </p>
                  <div className={styles.tableWrap}>

                    <table>
                      <thead>
                        <tr>
                          <th>Dealership</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Last opened</th>
                          <th>Access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.dealer_id}>
                            <td>
                              {m.business_name || "Details pending"}
                              <small>{m.town}</small>
                            </td>
                            <td>{m.email}</td>
                            <td>
                              <select
                                aria-label={`Role for ${m.email}`}
                                value={m.role}
                                disabled={
                                  busy ||
                                  m.status === "pending" ||
                                  current?.list_mode
                                }
                                onChange={(e) =>
                                  setConfirm({
                                    dealerId: m.dealer_id,
                                    role: e.target.value,
                                    status: m.status,
                                  })
                                }
                              >
                                {(current?.list_mode
                                  ? [m.role]
                                  : ["admin", "contributor", "viewer"]
                                ).map((r) => (
                                  <option key={r}>{r}</option>
                                ))}
                              </select>
                            </td>
                            <td>{m.status}</td>
                            <td>{m.last_viewed_at ? new Date(m.last_viewed_at).toLocaleString("en-ZA") : "Not opened yet"}</td>
                            <td>
                              <button
                                disabled={
                                  busy ||
                                  (current?.list_mode && m.role === "admin")
                                }
                                onClick={() =>
                                  setConfirm({
                                    dealerId: m.dealer_id,
                                    role: m.role,
                                    status:
                                      m.status === "active"
                                        ? "suspended"
                                        : "active",
                                  })
                                }
                              >
                                {m.status === "pending"
                                  ? "Approve"
                                  : m.status === "active"
                                    ? "Remove access"
                                    : "Restore"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3 className={styles.accessSectionTitle}>Invitations</h3>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Expires</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!accessLoading && invites.length === 0 && <tr><td colSpan={4}>No invitations yet.</td></tr>}
                        {invites.map((i) => (
                          <tr key={i.id}>
                            <td>{i.email}</td>
                            <td>{i.role}</td>
                            <td>{date(i.expires_at)}</td>
                            <td>
                              {i.consumed_at ? (
                                "Accepted"
                              ) : i.revoked_at ? (
                                "Revoked"
                              ) : new Date(i.expires_at).getTime() <
                                Date.now() ? (
                                "Expired"
                              ) : (
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void run(async () => {
                                      await mutate({
                                        action: "revoke",
                                        id: i.id,
                                      });
                                    })
                                  }
                                >
                                  Revoke
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {feedback}
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
                    <strong>Add / update parts</strong>
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
        {modal === "share" && (
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
                  setChannel("link"); setInviteEmail("");
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
                  setChannel("direct"); setInviteEmail(""); setRecipientSearch("");
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
            title={channel === "link" ? "Send link" : "Inside Aim4price"}
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
                <div className={styles.grid}>
                  {channel==='direct' ? <div>
                    <label>Find a dealer or business<input aria-label="Find sharing recipient" value={recipientSearch} onChange={e=>setRecipientSearch(e.target.value)} placeholder="Business name or email"/></label>
                    <label>Paid Aim4price account<select aria-label="Sharing recipient" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}><option value="">{recipientsLoading?'Loading accounts…':'Choose an account'}</option>{inviteEmail&&!recipients.some(r=>r.email===inviteEmail)&&<option value={inviteEmail}>{inviteEmail}</option>}{recipients.map(r=><option key={r.email} value={r.email}>{r.business_name||r.email}{r.town_city?` · ${r.town_city}`:''} — {r.email}</option>)}</select></label>
                    {!recipientsLoading&&!recipients.length&&<small>No matching paid accounts. Use a private link for other recipients.</small>}
                  </div> : <label>Recipient email<input type="email" autoComplete="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label>}
                  <label>
                    Access
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      {!current?.list_mode && (
                        <option value="contributor">Contribute parts</option>
                      )}
                      <option value="viewer">View parts and enquire</option>
                      {!current?.list_mode && (
                        <option value="admin">Manage sharing</option>
                      )}
                    </select>
                  </label>
                </div>
                <p>
                  {channel === "direct"
                    ? "Only this account can accept the share inside Aim4price."
                    : "Only this email can accept the link. They sign in, verify their email and wait for your approval."}
                </p>
                <button
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
                </button>
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
            </div>
            {feedback}
          </Modal>
        )}
        {modal === "upload" && (
          <Modal entry title="Add / update parts" subtitle={current?.name} onClose={close} busy={busy}>
            <PartsImportForm initialDetails={details}
              request={body => api({ ...body, network })}
              onBusyChange={setBusy}
              onComplete={async (addAnother) => {
                await loadNetworks();
                setRefresh(n => n + 1);
                if (!addAnother) setModal(null);
                switchView("mine");
                setNotice("Parts list updated successfully.");
              }}
            />
          </Modal>
        )}
        {modal === "download" && <Modal title="Download parts" subtitle={current?.name} onClose={close} busy={busy}>
          <p>Download {search.trim() ? "all matching parts" : "the complete stocklist"}, including description, brand, quantity, unit price and VAT basis.</p>
          <div className={styles.actions}>
            {(["xlsx", "csv"] as const).map(format=><button key={format} disabled={busy} onClick={()=>void run(async()=>{
              const data=await api(undefined,`?network=${network}&view=${current?.owned ? "mine" : "search"}&search=${encodeURIComponent(search)}&download=true`);
              const Excel=await import("exceljs");
              const book=new Excel.Workbook();const sheet=book.addWorksheet("Parts");
              sheet.columns=[{header:"Part number",key:"part",width:24},{header:"Description",key:"description",width:48},{header:"Brand",key:"brand",width:22},{header:"Quantity",key:"quantity",width:14},{header:"Unit price (ZAR)",key:"price",width:22},{header:"VAT basis",key:"vat",width:18},{header:"Dealer",key:"dealer",width:32},{header:"Town",key:"town",width:24}];
              const safe=(value:string)=>format === "csv" && /^[\s]*[=+@-]/.test(value) ? "'"+value : value;
              (data.rows as Row[]).forEach(r=>sheet.addRow({part:safe(r.part_number),description:safe(r.description||""),brand:safe(r.brand||""),quantity:r.quantity,price:r.price===null?null:Number(displayedPrice(r).toFixed(2)),vat:displayVatIncluded?"Incl. VAT":"Excl. VAT",dealer:safe(r.business_name),town:safe(r.town||"")}));
              sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];sheet.getColumn("part").numFmt="@";sheet.getColumn("price").numFmt='"R" #,##0.00';
              const buffer=format==="xlsx"?await book.xlsx.writeBuffer():await book.csv.writeBuffer();
              const url=URL.createObjectURL(new Blob([new Uint8Array(buffer)],{type:format==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"text/csv;charset=utf-8"}));
              const a=document.createElement("a");a.href=url;a.download=(current?.name||"Parts").replace(/[^a-zA-Z0-9 _-]/g,"")+"."+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
              setModal(null);setNotice("Parts download ready.");
            })}><Icon kind="download" />{format==="xlsx"?"Excel":"CSV"}</button>)}
          </div>{feedback}
        </Modal>}
        {editingPart && <Modal title="Edit part" subtitle={current?.name} onClose={close} busy={busy}>
          <form onSubmit={e=>{e.preventDefault();void run(async()=>{
            await api({action:"edit-part",network,...editingPart,price:editingPart.price.trim() ? (Number(editingPart.price) * (editingPart.storedVatIncluded ? 1.15 : 1)).toFixed(2) : ""});
            setEditingPart(null);setRefresh(n=>n+1);await loadNetworks();setNotice("Part updated successfully.");
          });}}>
            <div className={styles.partEditFields}>
              <label>Part number<input required maxLength={100} value={editingPart.partNumber} onChange={e=>setEditingPart({...editingPart,partNumber:e.target.value})}/></label>
              <label>Brand<input maxLength={100} value={editingPart.brand} onChange={e=>setEditingPart({...editingPart,brand:e.target.value})}/></label>
              <label className={styles.partEditDescription}>Description<input maxLength={500} value={editingPart.description} onChange={e=>setEditingPart({...editingPart,description:e.target.value})}/></label>
              <label>Quantity<input required type="number" min="0" max="999999999" step="1" value={editingPart.quantity} onChange={e=>setEditingPart({...editingPart,quantity:e.target.value})}/></label>
              <div className={styles.partEditPrice}>
                <label htmlFor="part-edit-price">Unit price <small>Optional, {editingPart.priceIncluded ? "incl." : "excl."} VAT</small></label>
                <div className={`${priceStyles.amountControl} ${styles.partEditPriceControl}`}>
                  <VatPriceInput id="part-edit-price" valueExVat={editingPart.price} included={editingPart.priceIncluded} vatRate={0.15} onValueChange={price=>setEditingPart({...editingPart,price})} placeholder="0" aria-label={`Unit price, ${editingPart.priceIncluded ? "including" : "excluding"} VAT`} />
                  <div className={priceStyles.amountVatToggle} role="group" aria-label="Unit price VAT basis">
                    <button type="button" aria-label="Including VAT" aria-pressed={editingPart.priceIncluded} onClick={()=>setEditingPart({...editingPart,priceIncluded:true})}>Incl</button>
                    <button type="button" aria-label="Excluding VAT" aria-pressed={!editingPart.priceIncluded} onClick={()=>setEditingPart({...editingPart,priceIncluded:false})}>Excl</button>
                  </div>
                </div>
                <small>Leave blank for price on request.</small>
              </div>
            </div>
            {feedback}
            <div className={`${styles.actions} ${styles.partEditFooter}`}><button type="button" disabled={busy} onClick={close}>Cancel</button><button className={styles.primary} disabled={busy} type="submit">{busy ? "Saving…" : "Save changes"}</button></div>
          </form>
        </Modal>}
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
