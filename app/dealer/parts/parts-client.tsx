"use client";
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
import {
  guessPartColumns,
  readPartsCsv,
  MAX_PARTS_CSV_BYTES,
  type PartColumns,
} from "../../../lib/parts-network-csv";
import PartsInbox from "../../../components/PartsInbox";
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
  price: string;
  business_name: string;
  town: string;
  phone: string;
  email: string;
  vat_included: boolean;
  uploaded_at: string;
};
type Member = Network & { dealer_id: string };
type Invite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
};
type Preview = {
  revision: number;
  summary: { added: number; updated: number; removed: number; total: number };
};
const date = (s: string) =>
  s
    ? new Date(s).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not uploaded";
async function api(body?: Record<string, unknown>, query = "") {
  const r = await fetch("/api/parts-network" + query, {
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
    | "phone"
    | "list"
    | "share"
    | "manage"
    | "plus"
    | "open"
    | "edit"
    | "delete"
    | "eye";
}) {
  const paths = {
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
  children,
}: {
  title: string;
  subtitle?: string;
  manage?: boolean;
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
        className={`${styles.modal} ${manage ? styles.manageModal : ""}`}
        role="dialog"
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
    [contribute, setContribute] = useState(false);
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
  const [csv, setCsv] = useState(""),
    [headers, setHeaders] = useState<string[]>([]),
    [columns, setColumns] = useState<PartColumns>({
      partNumber: -1,
      quantity: -1,
      price: -1,
    }),
    [preview, setPreview] = useState<Preview | null>(null);
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
  const basePath = website ? "/parts" : "/dealer/parts";
  function openList(id: string, members = false) {
    window.location.assign(`${basePath}/${encodeURIComponent(id)}${members ? "?view=members" : ""}`);
  }
  const current = networks.find((n) => n.id === network);
  const singleDealer = Boolean(current?.list_mode);
  const dealerName = singleDealer ? current?.owner_business_name || (current?.owned ? current.business_name : "") : "";
  const dealerTown = singleDealer ? current?.owner_town || (current?.owned ? current.town : "") : "";
  const uploadedAt = singleDealer ? current?.owner_uploaded_at || (current?.owned ? current.last_updated : "") : current?.last_updated;
  const vatIncluded = current?.owner_vat_included ?? current?.vat_included;
  const active = current?.status === "active";
  const admin =
    !staff &&
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
    if (listId && !initialViewSet.current && new URLSearchParams(window.location.search).get("view") !== "members") {
      initialViewSet.current = true;
      setView(d.networks.find((n: Network) => n.id === listId)?.owned ? "mine" : "search");
    }
    setStaff(d.staff);
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
    if (new URLSearchParams(window.location.search).get("view") === "members") setView("members");
    void loadNetworks()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadNetworks, listId, website]);
  useEffect(() => {
    const request = ++latest.current;
    setRows([]);
    setMembers([]);
    setInvites([]);
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
          setTotal(d.total || 0);
          setMembers(d.members || []);
          setInvites(d.invites || []);
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
    setCsv("");
    setHeaders([]);
    setPreview(null);
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
      setModal(null);
      setContact(null);
      setConfirm(null);
      setError("");
    }
  }
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
        {!listId && <WorkspaceTitlePanel title="Parts Management System" className={styles.title} />}
        <div className={styles.listToolbar}>
          {opened ? (
            <button
              className={styles.backButton}
              onClick={() => {
                window.location.assign(basePath);
              }}
            >
              <Icon kind="back" />
              Back to Parts
            </button>
          ) : (
            <div className={styles.search}>
              <Icon kind="search" />
              <input
                aria-label="Search parts lists"
                placeholder="Search parts lists"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>
          )}
          {!staff && !listId && (
            <button
              className={styles.addButton}
              onClick={() => {
                setName("");
                setModal("create");
              }}
            >
              <Icon kind="plus" />
              Add parts list
            </button>
          )}
        </div>
        {!opened && (
          <>
            <PartsInbox
              showShared={false}
              onAccepted={() => {
                void loadNetworks();
              }}
            />
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
                      <p>
                        {n.part_count || 0}{" "}
                        {n.part_count === 1 ? "part" : "parts"} ·{" "}
                        {date(n.last_updated)}
                      </p>
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
                    <div className={styles.cardActions}>
                      {n.owned && !staff && (
                        <button
                          className={styles.shareAction}
                          data-tooltip="Share parts list"
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
                        data-tooltip="Open parts list"
                        onClick={() => {
                          openList(n.id);
                        }}
                      >
                        <Icon kind="open" />
                        Open
                      </button>
                      {n.owned && !staff && (
                        <button
                          className={styles.manageAction}
                          data-tooltip="Manage parts list"
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
                    Add a list or accept a dealer’s invitation to get started.
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
                  <h1 className={styles.listTitle}>{current?.name}</h1>
                  {dealerName && <p className={styles.dealerSubtitle}>{dealerName}{dealerTown ? ` · ${dealerTown}` : ""}</p>}
                  <p className={styles.eyebrow}>
                    {view === "members"
                      ? "Sharing history and access"
                      : `${uploadedAt ? `Updated ${date(uploadedAt)}` : "Not uploaded"}${singleDealer && uploadedAt ? ` · Prices ${vatIncluded ? "incl." : "excl."} VAT` : ""}`}
                  </p>
                </div>
                <div className={`${styles.actions} ${styles.detailActions}`}>
                  {canUpload && (
                    <button className={styles.primary} onClick={openUpload}>
                      <Icon kind="upload" />
                      Upload CSV
                    </button>
                  )}
                  {admin && (
                    <button
                      className={styles.shareAction}
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
                  {admin && (
                    <button
                      className={styles.manageAction}
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
              </div>
              {view !== "members" && (
                <>
                  <div className={styles.partsPanel}>
                  <div className={styles.tableToolbar}>
                  <div className={styles.search}>
                    <Icon kind="search" />
                    <input
                      aria-label="Search part number"
                      placeholder="Search part number"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                  <span className={styles.resultCount} aria-live="polite">{loading ? "Loading…" : `${total.toLocaleString()} ${search.trim() ? "matching " : ""}${total === 1 ? "part" : "parts"}`}</span>
                  </div>
                  <div
                    className={styles.tableWrap}
                    tabIndex={0}
                    role="region"
                    aria-label="Parts results"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Part number</th>
                          <th className={styles.numeric}>Quantity</th>
                          <th className={styles.numeric}>Unit price</th>
                          {!singleDealer && <><th>Dealer</th><th>Last updated</th></>}
                          <th>
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={`${r.part_number}-${i}`}>
                            <td>
                              <strong>{r.part_number}</strong>
                            </td>
                            <td className={styles.numeric}>{r.quantity}</td>
                            <td className={styles.numeric}>
                              <strong>
                                {Number(r.price).toLocaleString("en-ZA", {
                                  style: "currency",
                                  currency: "ZAR",
                                })}
                              </strong>
                              {!singleDealer && <small>{r.vat_included ? "Incl. VAT" : "Excl. VAT"}</small>}
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
                              <button
                                aria-label={`Contact ${r.business_name} about ${r.part_number}`}
                                onClick={() => {
                                  setContact(r);
                                  setEnquiry(
                                    `Please confirm price and availability for part ${r.part_number}.`,
                                  );
                                }}
                              >
                                <Icon kind={current?.owned ? "phone" : "message"} />
                                {current?.owned ? "Contact" : "Enquire"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!rows.length && (
                      <div className={styles.tableEmpty}>
                        <Icon kind={search.trim() ? "search" : "upload"} />
                        <strong>{loading ? "Loading parts…" : search.trim() ? "No matching parts" : !uploadedAt ? "No parts uploaded yet" : "No parts available"}</strong>
                        {!loading && !search.trim() && canUpload && <button className={styles.primary} onClick={openUpload}><Icon kind="upload" />Upload CSV</button>}
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
              {view === "members" && (
                <>
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
                                    ? "Suspend"
                                    : "Restore"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h2>Invitations</h2>
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
                </>
              )}
            </>
          ))}
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
                  <small>Change the name of this parts list.</small>
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
                    <strong>Update CSV</strong>
                    <small>Replace parts with your latest stocklist.</small>
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  if (!listId) openList(network, true);
                  else { switchView("members"); setModal(null); }
                }}
              >
                <Icon kind="users" />
                <span>
                  <strong>Sharing &amp; access</strong>
                  <small>Review invitations and dealer access.</small>
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
                        : "Make your parts visible to approved dealers."}
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
                  <small>Remove this list and stop shared access.</small>
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
          <Modal title="Delete parts list?" onClose={close} busy={busy}>
            <p>
              This removes {current?.name} from Parts and stops shared access.
              Your master stock records and cost ledger stay unchanged.
            </p>
            <div className={styles.actions}>
              <button onClick={() => setModal("manage")}>Cancel</button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await mutate({ action: "archive" });
                    if (listId) window.location.assign(basePath);
                    else { setOpened(false); setNetwork(""); setModal(null); }
                  })
                }
              >
                Delete list
              </button>
            </div>
            {feedback}
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
                  setChannel("link");
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
                  setChannel("direct");
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
                  if (!listId) openList(network, true);
                  else { switchView("members"); setModal(null); }
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
                  <label>
                    Recipient email
                    <input
                      type="email"
                      autoComplete="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </label>
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
                          "Shared inside Aim4price. The recipient can accept it in Parts or Leads.",
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
          <Modal
            title={preview ? "Review parts list" : "Upload parts list"}
            onClose={close}
            busy={busy}
          >
            {!preview ? (
              <>
                <p>
                  Upload your complete CSV. It replaces only your parts in this
                  list.
                </p>
                <label className={styles.drop}>
                  <Icon kind="upload" />
                  <strong>Choose or drop a CSV</strong>
                  <span>Part number · Quantity · Unit price</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      void run(async () => {
                        if (f.size > MAX_PARTS_CSV_BYTES)
                          throw new Error("Use a CSV smaller than 2 MB.");
                        const value = await f.text();
                        const parsed = readPartsCsv(value);
                        setCsv(value);
                        setHeaders(parsed[0]);
                        setColumns(guessPartColumns(parsed[0]));
                      });
                    }}
                  />
                </label>
                {headers.length > 0 && (
                  <>
                    <div className={styles.grid}>
                      {(["partNumber", "quantity", "price"] as const).map(
                        (k) => (
                          <label key={k}>
                            {
                              {
                                partNumber: "Part number",
                                quantity: "Quantity",
                                price: "Unit price",
                              }[k]
                            }
                            <select
                              value={columns[k]}
                              onChange={(e) =>
                                setColumns({
                                  ...columns,
                                  [k]: Number(e.target.value),
                                })
                              }
                            >
                              <option value={-1}>Choose column</option>
                              {headers.map((h, i) => (
                                <option value={i} key={i}>
                                  {h || `Column ${i + 1}`}
                                </option>
                              ))}
                            </select>
                          </label>
                        ),
                      )}
                    </div>
                    <div className={styles.grid}>
                      {(
                        ["businessName", "town", "phone", "email"] as const
                      ).map((k) => (
                        <label key={k}>
                          {
                            {
                              businessName: "Dealership",
                              town: "Town",
                              phone: "Contact phone",
                              email: "Contact email",
                            }[k]
                          }
                          <input
                            value={details[k]}
                            onChange={(e) =>
                              setDetails({ ...details, [k]: e.target.value })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        Prices
                        <select
                          value={String(details.vatIncluded)}
                          onChange={(e) =>
                            setDetails({
                              ...details,
                              vatIncluded: e.target.value === "true",
                            })
                          }
                        >
                          <option value="false">Exclude VAT</option>
                          <option value="true">Include VAT</option>
                        </select>
                      </label>
                    </div>
                    <button
                      disabled={
                        busy || Object.values(columns).some((i) => i < 0)
                      }
                      className={styles.primary}
                      onClick={() =>
                        void run(async () =>
                          setPreview(
                            await api({
                              action: "preview",
                              network,
                              csv,
                              columns,
                            }),
                          ),
                        )
                      }
                    >
                      Review upload
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className={styles.summary}>
                  {Object.entries(preview.summary).map(([k, v]) => (
                    <div key={k}>
                      <strong>{v.toLocaleString()}</strong>
                      <span>{k}</span>
                    </div>
                  ))}
                </div>
                <p>
                  Parts missing from this CSV will be removed from your listing.
                  Your master stock records and asset cost ledger are
                  unaffected.
                </p>
                <div className={styles.actions}>
                  <button disabled={busy} onClick={() => setPreview(null)}>
                    Back
                  </button>
                  <button
                    className={styles.primary}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await mutate({
                          action: "import",
                          csv,
                          columns,
                          revision: preview.revision,
                          ...details,
                        });
                        setModal(null);
                        switchView("mine");
                        setNotice("Parts list replaced successfully.");
                      })
                    }
                  >
                    Replace my parts list
                  </button>
                </div>
              </>
            )}
            {feedback}
          </Modal>
        )}
        {contact && (
          <Modal title={contact.part_number} onClose={close} busy={busy}>
            <h3>{contact.business_name}</h3>
            <p>
              {contact.town} · Updated {date(contact.uploaded_at)}
            </p>
            <p>Confirm availability and price directly with the dealer.</p>
            {!current?.owned && (
              <>
                <label>
                  Enquiry
                  <textarea
                    value={enquiry}
                    maxLength={2000}
                    onChange={(e) => setEnquiry(e.target.value)}
                  />
                </label>
                <div className={styles.actions}>
                  <button
                    className={styles.primary}
                    disabled={busy || !enquiry.trim()}
                    onClick={() =>
                      void run(async () => {
                        await api({
                          action: "enquire",
                          network,
                          dealerId: contact.dealer_id,
                          partNumber: contact.part_number,
                          message: enquiry,
                        });
                        setContact(null);
                        setNotice(
                          "Enquiry sent. The dealer can find it in Leads.",
                        );
                      })
                    }
                  >
                    Send enquiry
                  </button>
                </div>
                {feedback}
              </>
            )}
            <div className={styles.actions}>
              <a
                className={styles.button}
                href={"tel:" + contact.phone.replace(/[^+0-9]/g, "")}
              >
                <Icon kind="phone" />
                Call
              </a>
              <a
                className={styles.button}
                href={`mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent("Part enquiry: " + contact.part_number)}`}
              >
                Email
              </a>
              <a
                className={styles.button}
                target="_blank"
                rel="noopener noreferrer"
                href={
                  "https://wa.me/" +
                  contact.phone.replace(/\D/g, "").replace(/^0/, "27") +
                  "?text=" +
                  encodeURIComponent(
                    "Hello, is part " +
                      contact.part_number +
                      " still available?",
                  )
                }
              >
                WhatsApp
              </a>
            </div>
            <small>
              {contact.phone} · {contact.email}
            </small>
            {contribute && website && (
              <p>
                <a href="/dealer-costs">Open client cost ledger</a>
              </p>
            )}
          </Modal>
        )}
        {confirm && (
          <Modal title="Update member access" onClose={close} busy={busy}>
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
