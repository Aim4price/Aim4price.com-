"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import ShareModalCloseButton from "../../../components/asset-register/ShareModalCloseButton";
import { useLeadDialog } from "../../../components/leads/useLeadDialog";
import { WorkspaceTitlePanel } from "../../../components/WorkspacePrimitives";
import {
  guessPartColumns,
  readPartsCsv,
  MAX_PARTS_CSV_BYTES,
  type PartColumns,
} from "../../../lib/parts-network-csv";
import styles from "./parts.module.css";
type Network = {
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
  kind: "search" | "upload" | "users" | "phone" | "list";
}) {
  const paths = {
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
  children,
}: {
  title: string;
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
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.closeWrap}>
          <ShareModalCloseButton onClick={onClose} disabled={busy} />
        </div>
        <h2>{title}</h2>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export default function PartsClient({
  website = false,
}: {
  website?: boolean;
}) {
  const [networks, setNetworks] = useState<Network[]>([]),
    [network, setNetwork] = useState(""),
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
  const [modal, setModal] = useState<"upload" | "invite" | "create" | null>(
      null,
    ),
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
    [inviteRole, setInviteRole] = useState("contributor"),
    [inviteUrl, setInviteUrl] = useState(""),
    [name, setName] = useState("");
  const current = networks.find((n) => n.id === network);
  const active = current?.status === "active";
  const admin = !staff && current?.role === "admin";
  const canUpload = contribute && current?.role !== "viewer" && active;
  const latest = useRef(0);
  const loadNetworks = useCallback(async () => {
    const d = await api();
    setNetworks(d.networks);
    setStaff(d.staff);
    setContribute(d.canContribute);
    setNetwork((old) =>
      d.networks.some((n: Network) => n.id === old)
        ? old
        : d.networks[0]?.id || "",
    );
    return d;
  }, []);
  useEffect(() => {
    void loadNetworks()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadNetworks]);
  useEffect(() => {
    const request = ++latest.current;
    setRows([]);
    setMembers([]);
    setInvites([]);
    setTotal(0);
    if (!network || !active) {
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
  }, [network, active, view, search, page, refresh]);
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
    <main className={styles.page}>
      <div className={styles.shell}>
        <WorkspaceTitlePanel title="Parts" className={styles.title} />
        <div className={styles.topline}>
          <span className={styles.eyebrow}>Private dealer network</span>
          {website && !staff && (
            <a className={styles.button} href="/account/dealer-app">
              Staff &amp; Permissions
            </a>
          )}
          {networks.length > 1 && (
            <label>
              Network
              <select
                aria-label="Network"
                value={network}
                onChange={(e) => {
                  setNetwork(e.target.value);
                  switchView("search");
                }}
              >
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!staff && (
            <button onClick={() => setModal("create")}>Create network</button>
          )}
        </div>
        {!modal && !contact && !confirm && feedback}
        {!network ? (
          <div className={styles.empty}>
            {loading
              ? "Loading…"
              : staff
                ? "Your dealership has not joined a network yet. Contact your account owner."
                : "No network joined yet. Accept a dealer invitation or create your own private network."}
          </div>
        ) : !active ? (
          <div className={styles.empty}>
            <h2>
              {current?.status === "pending"
                ? "Awaiting approval"
                : "Access suspended"}
            </h2>
            <p>
              Your network administrator controls access to this private group.
            </p>
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
            <div className={styles.toolbar}>
              <div className={styles.tabs}>
                {[
                  ["search", "Find parts", "search"],
                  ["mine", "My parts list", "list"],
                  ...(admin ? [["members", "Members", "users"]] : []),
                ].map(([id, label, icon]) => (
                  <button
                    key={id}
                    aria-pressed={view === id}
                    onClick={() => switchView(id)}
                  >
                    <Icon kind={icon as "search"} />
                    {label}
                  </button>
                ))}
              </div>
              <div className={styles.actions}>
                {canUpload && (
                  <button className={styles.primary} onClick={openUpload}>
                    <Icon kind="upload" />
                    Upload CSV
                  </button>
                )}
                {admin && (
                  <button
                    onClick={() => {
                      setInviteEmail("");
                      setInviteUrl("");
                      setModal("invite");
                    }}
                  >
                    <Icon kind="users" />
                    Invite dealer
                  </button>
                )}
              </div>
            </div>
            {view !== "members" && (
              <>
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
                <div className={styles.topline}>
                  <p>
                    {current?.name} · {total.toLocaleString()} matching{" "}
                    {total === 1 ? "part" : "parts"}
                  </p>
                  {view === "mine" && canUpload && (
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
                      {current?.visible ? "Hide my list" : "Show my list"}
                    </button>
                  )}
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
                        <th>Dealer</th>
                        <th>Last updated</th>
                        <th>
                          <span className={styles.srOnly}>Contact</span>
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
                            <small>
                              {r.vat_included ? "Incl. VAT" : "Excl. VAT"}
                            </small>
                          </td>
                          <td>
                            {r.business_name}
                            <small>{r.town}</small>
                          </td>
                          <td>
                            {date(r.uploaded_at)}
                            {Date.now() - new Date(r.uploaded_at).getTime() >
                              45 * 86400000 && <small>Update overdue</small>}
                          </td>
                          <td>
                            <button
                              aria-label={`Contact ${r.business_name} about ${r.part_number}`}
                              onClick={() => setContact(r)}
                            >
                              <Icon kind="phone" />
                              Contact
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!rows.length && (
                    <p className={styles.empty}>
                      {loading ? "Loading parts…" : "No parts found."}
                    </p>
                  )}
                </div>
                <div className={styles.topline}>
                  <small>
                    Availability is from the latest CSV. Confirm price and stock
                    with the dealer.
                  </small>
                  <div className={styles.actions}>
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
                  </div>
                </div>
              </>
            )}
            {view === "members" && (
              <>
                <p>
                  Verify the dealership independently before approving access.
                  Staff permissions remain controlled by each dealership owner.
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
                              disabled={busy || m.status === "pending"}
                              onChange={(e) =>
                                setConfirm({
                                  dealerId: m.dealer_id,
                                  role: e.target.value,
                                  status: m.status,
                                })
                              }
                            >
                              {["admin", "contributor", "viewer"].map((r) => (
                                <option key={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td>{m.status}</td>
                          <td>
                            <button
                              disabled={busy}
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
        )}
        {modal === "create" && (
          <Modal title="Create private network" onClose={close} busy={busy}>
            <label>
              Network name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </label>
            <p>
              You will manage this private network and invite participating
              dealers.
            </p>
            {feedback}
            <button
              className={styles.primary}
              disabled={busy || !name.trim()}
              onClick={() =>
                void run(async () => {
                  const d = await api({ action: "create", name });
                  await loadNetworks();
                  setNetwork(d.id);
                  setModal(null);
                })
              }
            >
              Create network
            </button>
          </Modal>
        )}
        {modal === "invite" && (
          <Modal title="Invite a dealer" onClose={close} busy={busy}>
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
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </label>
                  <label>
                    Network role
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      <option value="contributor">
                        Contributor · search and upload
                      </option>
                      <option value="viewer">Viewer · search only</option>
                      <option value="admin">
                        Administrator · manage network
                      </option>
                    </select>
                  </label>
                </div>
                <p>
                  The dealer signs in, verifies an email PIN and waits for your
                  approval.
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
                      });
                      setInviteUrl(d.url);
                      setRefresh((n) => n + 1);
                    })
                  }
                >
                  Create invitation link
                </button>
              </>
            )}
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
                  Upload your complete CSV. It replaces your previous list for
                  this network.
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
                : "This stops the dealership and its staff accessing this network and hides its parts."}
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
