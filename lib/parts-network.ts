import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { PoolClient } from "pg";
import { getDb } from "./db";
import { PARTS_NETWORK_SCHEMA } from "./parts-network-schema";
import type { PartsActor } from "./parts-network-access";
import {
  parsePartsSnapshot,
  snapshotChanges,
  type PartColumns,
  type PartRow,
} from "./parts-network-csv";
import { sendAim4priceEmail, getSiteOrigin } from "./email";

export class PartsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
let ready: Promise<void> | undefined;
export function ensurePartsNetwork() {
  return (ready ??= getDb()
    .query(PARTS_NETWORK_SCHEMA)
    .then(() => {})
    .catch((e) => {
      ready = undefined;
      throw e;
    }));
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const str = (v: unknown, max = 160) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
export function networkId(v: unknown) {
  const id = str(v);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new PartsError("Choose a parts list.");
  return id;
}
function role(v: unknown) {
  if (!["admin", "contributor", "viewer"].includes(String(v)))
    throw new PartsError("Choose a valid role.");
  return String(v);
}
async function transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  await ensurePartsNetwork();
  const db = await getDb().connect();
  try {
    await db.query("BEGIN");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
async function audit(
  db: PoolClient,
  id: string,
  actor: PartsActor,
  action: string,
  target: string,
) {
  await db.query(
    "INSERT INTO parts_network_audit(id,network_id,actor_id,action,target) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), id, actor.id, action, target],
  );
}
async function access(
  db: PoolClient,
  actor: PartsActor,
  id: string,
  level: "read" | "write" | "admin" = "read",
) {
  // A network row lock serialises membership revocations, imports and invitations.
  const n = await db.query(
    "SELECT * FROM parts_networks WHERE id=$1 AND archived=false FOR UPDATE",
    [networkId(id)],
  );
  if (!n.rows.length) throw new PartsError("Parts list not available.", 403);
  const m = (
    await db.query(
      "SELECT * FROM parts_network_members WHERE network_id=$1 AND dealer_id=$2",
      [id, actor.id],
    )
  ).rows[0];
  if (!m || m.status !== "active")
    throw new PartsError("Network approval required.", 403);
  if (level === "admin" && (actor.staff || m.role !== "admin"))
    throw new PartsError("Network administrator access required.", 403);
  if (level === "write" && (!actor.canContribute || m.role === "viewer"))
    throw new PartsError("Contribution access required.", 403);
  if (
    n.rows[0].list_mode &&
    level === "write" &&
    n.rows[0].created_by !== actor.id
  )
    throw new PartsError("Only the list owner can replace this CSV.", 403);
  if (
    n.rows[0].list_mode &&
    level === "admin" &&
    n.rows[0].created_by !== actor.id
  )
    throw new PartsError("Only the list owner can manage sharing.", 403);
  return m;
}
export async function listPartsNetworks(actor: PartsActor) {
  await ensurePartsNetwork();
  return (
    await getDb().query(
      `SELECT n.id,n.name,n.list_mode,(n.created_by=$1) AS owned,
 owner.business_name AS owner_business_name,owner.town AS owner_town,owner.vat_included AS owner_vat_included,owner.uploaded_at AS owner_uploaded_at,
 (SELECT count(*)::int FROM parts_network_rows r WHERE r.network_id=n.id AND (NOT n.list_mode OR r.dealer_id=n.created_by)) AS part_count,
 (SELECT max(uploaded_at) FROM parts_network_members u WHERE u.network_id=n.id) AS last_updated,m.status,m.role, m.revision,m.visible,m.business_name,m.town,m.phone,m.email,m.vat_included,m.uploaded_at
 FROM parts_networks n LEFT JOIN parts_network_members owner ON owner.network_id=n.id AND owner.dealer_id=n.created_by
 LEFT JOIN parts_network_members m ON m.network_id=n.id AND m.dealer_id=$1
 WHERE m.dealer_id=$1 AND n.archived=false ORDER BY n.name`,
      [actor.id],
    )
  ).rows;
}
export async function partsData(
  actor: PartsActor,
  id: string,
  view: string,
  search: string,
  page: number,
) {
  return transaction(async (db) => {
    const member = await access(
      db,
      actor,
      id,
      view === "members" ? "admin" : "read",
    );
    if (view === "members")
      return {
        members: (
          await db.query(
            "SELECT * FROM parts_network_members WHERE network_id=$1 ORDER BY business_name,email",
            [id],
          )
        ).rows,
        invites: (
          await db.query(
            "SELECT id,email,role,expires_at,consumed_at,revoked_at FROM parts_network_invites WHERE network_id=$1 ORDER BY expires_at DESC LIMIT 100",
            [id],
          )
        ).rows,
      };
    const mine = view === "mine";
    const query = str(search, 100).toUpperCase();
    const offset = Math.max(0, Math.min(10000, Math.floor(page) || 0)) * 50;
    // strpos is literal, preserving punctuation and leading zeros in part numbers.
    const where = `r.network_id=$1 AND EXISTS (SELECT 1 FROM parts_networks n WHERE n.id=r.network_id AND (NOT n.list_mode OR n.created_by=r.dealer_id)) AND ($2::boolean AND r.dealer_id=$3 OR NOT $2::boolean AND m.status='active' AND m.visible=true AND r.quantity>0) AND ($4='' OR strpos(r.part_key,$4)>0)`;
    const args = [id, mine, actor.id, query];
    const rows = await db.query(
      `SELECT r.dealer_id,r.part_number,r.quantity,r.price,m.business_name,m.town,m.phone,m.email,m.vat_included,m.uploaded_at FROM parts_network_rows r JOIN parts_network_members m ON m.network_id=r.network_id AND m.dealer_id=r.dealer_id WHERE ${where} ORDER BY (r.part_key=$4) DESC,r.part_key,m.business_name,r.dealer_id LIMIT 50 OFFSET $5`,
      [...args, offset],
    );
    const count = await db.query(
      `SELECT count(*)::int total FROM parts_network_rows r JOIN parts_network_members m ON m.network_id=r.network_id AND m.dealer_id=r.dealer_id WHERE ${where}`,
      args,
    );
    return { rows: rows.rows, total: count.rows[0].total, member };
  });
}
export async function createPartsNetwork(
  actor: PartsActor,
  name: unknown,
  listMode = false,
) {
  if (actor.staff)
    throw new PartsError(
      "Only the dealership account owner can create a parts list.",
      403,
    );
  const title = str(name, 80);
  if (!title) throw new PartsError("Enter a list name.");
  return transaction(async (db) => {
    const id = randomUUID();
    await db.query(
      "INSERT INTO parts_networks(id,name,created_by,list_mode) VALUES($1,$2,$3,$4)",
      [id, title, actor.id, listMode],
    );
    const profile = (
      await db.query(
        "SELECT business_name,town_city FROM account_profiles WHERE user_id=$1",
        [actor.id],
      )
    ).rows[0];
    await db.query(
      `INSERT INTO parts_network_members(network_id,dealer_id,role,status,email,business_name,town,approved_by)
       VALUES($1,$2,'admin','active',$3,$4,$5,$2)`,
      [
        id,
        actor.id,
        actor.email,
        profile?.business_name || "",
        profile?.town_city || "",
      ],
    );
    await audit(db, id, actor, "create", title);
    return { id };
  });
}
export async function invitePartsMember(
  actor: PartsActor,
  id: string,
  emailInput: unknown,
  roleInput: unknown,
  channel: unknown = "link",
) {
  const email = str(emailInput, 254).toLowerCase(),
    memberRole = role(roleInput);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new PartsError("Enter a valid email address.");
  return transaction(async (db) => {
    await access(db, actor, id, "admin");
    const list = (
      await db.query("SELECT list_mode FROM parts_networks WHERE id=$1", [id])
    ).rows[0];
    if (list.list_mode && memberRole !== "viewer")
      throw new PartsError("Shared lists are view-only.");
    if (channel !== "link" && channel !== "direct")
      throw new PartsError("Choose a sharing method.");
    await db.query(
      "UPDATE parts_network_invites SET revoked_at=now() WHERE network_id=$1 AND email=$2 AND consumed_at IS NULL AND revoked_at IS NULL",
      [id, email],
    );
    const token = randomBytes(32).toString("hex");
    await db.query(
      `INSERT INTO parts_network_invites(id,network_id,email,role,token_hash,created_by,expires_at,channel) VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days',$7)`,
      [randomUUID(), id, email, memberRole, hash(token), actor.id, channel],
    );
    await audit(db, id, actor, "invite", email);
    return { url: `${getSiteOrigin()}/parts/join?token=${token}` };
  });
}
export async function revokePartsInvite(
  actor: PartsActor,
  id: string,
  inviteId: unknown,
) {
  return transaction(async (db) => {
    await access(db, actor, id, "admin");
    await db.query(
      "UPDATE parts_network_invites SET revoked_at=now() WHERE id=$1 AND network_id=$2 AND consumed_at IS NULL",
      [networkId(inviteId), id],
    );
    await audit(db, id, actor, "revoke-invite", String(inviteId));
  });
}
export async function changePartsMember(
  actor: PartsActor,
  id: string,
  target: unknown,
  newRole: unknown,
  status: unknown,
) {
  const dealer = str(target, 200),
    memberRole = role(newRole);
  if (!["active", "suspended"].includes(String(status)))
    throw new PartsError("Choose active or suspended.");
  return transaction(async (db) => {
    await access(db, actor, id, "admin");
    const current = (
      await db.query(
        "SELECT * FROM parts_network_members WHERE network_id=$1 AND dealer_id=$2",
        [id, dealer],
      )
    ).rows[0];
    if (!current) throw new PartsError("Member not found.", 404);
    const list = (
      await db.query(
        "SELECT list_mode,created_by FROM parts_networks WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (
      list.list_mode &&
      (dealer === list.created_by || memberRole !== "viewer")
    )
      throw new PartsError(
        "The owner retains control; shared access is view-only.",
      );
    if (
      current.role === "admin" &&
      current.status === "active" &&
      (memberRole !== "admin" || status !== "active")
    ) {
      const count = await db.query(
        "SELECT count(*)::int total FROM parts_network_members WHERE network_id=$1 AND role='admin' AND status='active'",
        [id],
      );
      if (count.rows[0].total <= 1)
        throw new PartsError(
          "Appoint another active network administrator first.",
        );
    }
    await db.query(
      "UPDATE parts_network_members SET role=$3,status=$4,approved_by=$5 WHERE network_id=$1 AND dealer_id=$2",
      [id, dealer, memberRole, status, actor.id],
    );
    await audit(db, id, actor, `member:${status}:${memberRole}`, dealer);
  });
}
export async function partsInvitePin(
  actor: PartsActor,
  token: unknown,
  pin?: unknown,
) {
  if (actor.staff)
    throw new PartsError(
      "Use the dealership owner’s Aim4price login to accept an invitation.",
      403,
    );
  const raw = str(token, 128);
  if (!/^[a-f0-9]{64}$/.test(raw))
    throw new PartsError("Invitation not available.", 403);
  const outcome = await transaction(async (db) => {
    const found = (
      await db.query(
        "SELECT network_id FROM parts_network_invites WHERE token_hash=$1",
        [hash(raw)],
      )
    ).rows[0];
    if (!found) throw new PartsError("Invitation unavailable.", 403);
    const list = (
      await db.query(
        "SELECT id FROM parts_networks WHERE id=$1 AND archived=false FOR UPDATE",
        [found.network_id],
      )
    ).rows[0];
    if (!list) throw new PartsError("Invitation unavailable.", 403);
    const inv = (
      await db.query(
        "SELECT * FROM parts_network_invites WHERE token_hash=$1 FOR UPDATE",
        [hash(raw)],
      )
    ).rows[0];
    if (
      !inv ||
      inv.email !== actor.email ||
      inv.consumed_at ||
      inv.revoked_at ||
      new Date(inv.expires_at).getTime() < Date.now()
    )
      throw new PartsError(
        "This invitation is unavailable or belongs to another email address.",
        403,
      );
    if (pin === undefined) {
      if (
        inv.pin_sends >= 5 ||
        (inv.pin_sent_at &&
          Date.now() - new Date(inv.pin_sent_at).getTime() < 60000)
      )
        throw new PartsError(
          "Please wait before requesting another PIN. After five requests, ask for a new invitation.",
          429,
        );
      const code = String(randomInt(100000, 1000000));
      if (!process.env.RESEND_API_KEY)
        throw new PartsError(
          "Email delivery is not configured. Contact Aim4price.",
          503,
        );
      await sendAim4priceEmail({
        to: actor.email,
        subject: "Your shared parts PIN",
        text: `Your verification PIN is ${code}. It expires in 10 minutes. Do not share it.`,
        html: `<p>Your verification PIN is <strong>${code}</strong>.</p><p>It expires in 10 minutes. Do not share it.</p>`,
      });
      await db.query(
        "UPDATE parts_network_invites SET pin_hash=$2,pin_expires_at=now()+interval '10 minutes',pin_sent_at=now(),pin_sends=pin_sends+1 WHERE id=$1",
        [inv.id, hash(raw + code)],
      );
      return { sent: true };
    }
    if (inv.attempts >= 5)
      throw new PartsError(
        "Too many attempts. Ask the administrator for a new invitation.",
        429,
      );
    const code = str(pin, 20),
      expected = inv.pin_hash
        ? Buffer.from(inv.pin_hash, "hex")
        : Buffer.alloc(0),
      actual = Buffer.from(hash(raw + code), "hex");
    if (
      !/^\d{6}$/.test(code) ||
      !inv.pin_expires_at ||
      new Date(inv.pin_expires_at).getTime() < Date.now() ||
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      await db.query(
        "UPDATE parts_network_invites SET attempts=attempts+1 WHERE id=$1",
        [inv.id],
      );
      return { invalid: true };
    }
    // Never reinstate or promote an existing member by replaying an invitation.
    const p = (
      await db.query(
        "SELECT business_name,town_city FROM account_profiles WHERE user_id=$1",
        [actor.id],
      )
    ).rows[0];
    await db.query(
      `INSERT INTO parts_network_members(network_id,dealer_id,role,status,email,business_name,town) VALUES($1,$2,$3,'pending',$4,$5,$6) ON CONFLICT(network_id,dealer_id) DO NOTHING`,
      [
        inv.network_id,
        actor.id,
        inv.role,
        actor.email,
        p?.business_name || "",
        p?.town_city || "",
      ],
    );
    await db.query(
      "UPDATE parts_network_invites SET consumed_at=now(),pin_hash=NULL WHERE id=$1",
      [inv.id],
    );
    await audit(db, inv.network_id, actor, "accept-invite", actor.email);
    return { accepted: true, network: inv.network_id };
  });
  if ("invalid" in outcome)
    throw new PartsError("Incorrect or expired PIN. Please try again.", 400);
  return outcome;
}
export async function importParts(
  actor: PartsActor,
  id: string,
  input: Record<string, unknown>,
  commit: boolean,
) {
  if (typeof input.csv !== "string") throw new PartsError("Choose a CSV file.");
  let rows: PartRow[];
  try {
    rows = parsePartsSnapshot(input.csv, input.columns as PartColumns);
  } catch (e) {
    throw new PartsError(e instanceof Error ? e.message : "Invalid CSV.");
  }
  return transaction(async (db) => {
    const member = await access(db, actor, id, "write");
    if (!member)
      throw new PartsError("Upload from an approved dealership account.");
    if (
      commit &&
      (!Number.isInteger(input.revision) || input.revision !== member.revision)
    )
      throw new PartsError("Your list changed. Preview the upload again.", 409);
    const previous = (
      await db.query(
        "SELECT part_number,quantity,price FROM parts_network_rows WHERE network_id=$1 AND dealer_id=$2",
        [id, actor.id],
      )
    ).rows.map((r) => ({
      partNumber: r.part_number,
      quantity: r.quantity,
      price: Number(r.price),
    }));
    const summary = snapshotChanges(previous, rows);
    if (!commit)
      return { summary, revision: member.revision, sample: rows.slice(0, 5) };
    const business = str(input.businessName),
      town = str(input.town, 100),
      phone = str(input.phone, 30),
      email = str(input.email, 254).toLowerCase();
    if (
      !business ||
      !town ||
      !/^\+?[0-9 ()-]{7,30}$/.test(phone) ||
      !/^\S+@\S+\.\S+$/.test(email)
    )
      throw new PartsError(
        "Enter the dealership name, town, phone and contact email.",
      );
    if (typeof input.vatIncluded !== "boolean")
      throw new PartsError("Choose the price VAT basis.");
    await db.query(
      "DELETE FROM parts_network_rows WHERE network_id=$1 AND dealer_id=$2",
      [id, actor.id],
    );
    await db.query(
      `INSERT INTO parts_network_rows(network_id,dealer_id,part_number,part_key,quantity,price) SELECT $1,$2,p->>'partNumber',upper(p->>'partNumber'),(p->>'quantity')::integer,(p->>'price')::numeric FROM jsonb_array_elements($3::jsonb) p`,
      [id, actor.id, JSON.stringify(rows)],
    );
    await db.query(
      "UPDATE parts_network_members SET business_name=$3,town=$4,phone=$5,email=$6,vat_included=$7,revision=revision+1,uploaded_at=now() WHERE network_id=$1 AND dealer_id=$2",
      [id, actor.id, business, town, phone, email, input.vatIncluded],
    );
    await audit(db, id, actor, "replace-list", `${rows.length} rows`);
    return { summary };
  });
}
export async function setPartsVisibility(
  actor: PartsActor,
  id: string,
  visible: unknown,
) {
  if (typeof visible !== "boolean") throw new PartsError("Choose visibility.");
  return transaction(async (db) => {
    await access(db, actor, id, "write");
    await db.query(
      "UPDATE parts_network_members SET visible=$3 WHERE network_id=$1 AND dealer_id=$2",
      [id, actor.id, visible],
    );
    await audit(db, id, actor, "visibility", String(visible));
  });
}

// List lifecycle keeps rows and audit history intact when a list is removed.
export async function managePartsList(
  actor: PartsActor,
  id: string,
  name: unknown,
  archive = false,
) {
  return transaction(async (db) => {
    await access(db, actor, id, "admin");
    const list = (
      await db.query("SELECT created_by FROM parts_networks WHERE id=$1", [id])
    ).rows[0];
    if (list.created_by !== actor.id)
      throw new PartsError("Only the list owner can manage this list.", 403);
    const title = str(name, 80);
    if (!archive && !title) throw new PartsError("Enter a list name.");
    await db.query(
      "UPDATE parts_networks SET name=CASE WHEN $3 THEN name ELSE $2 END,archived=$3 WHERE id=$1",
      [id, title, archive],
    );
    await audit(db, id, actor, archive ? "archive-list" : "rename-list", title);
  });
}
export async function partsInbox(actor: PartsActor) {
  await ensurePartsNetwork();
  const invitations = actor.staff
    ? []
    : (
        await getDb().query(
          `SELECT i.id,n.name FROM parts_network_invites i JOIN parts_networks n ON n.id=i.network_id WHERE lower(i.email)=lower($1) AND i.channel='direct' AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND NOT n.archived`,
          [actor.email],
        )
      ).rows;
  const enquiries = (
    await getDb().query(
      `SELECT e.*,n.name FROM parts_enquiries e JOIN parts_networks n ON n.id=e.network_id WHERE e.recipient_id=$1 ORDER BY e.created_at DESC LIMIT 100`,
      [actor.id],
    )
  ).rows;
  const shared = (await listPartsNetworks(actor)).filter((n) => !n.owned);
  return { invitations, enquiries, shared };
}
export async function acceptDirectPartsShare(
  actor: PartsActor,
  inviteId: unknown,
) {
  if (actor.staff) throw new PartsError("Use the account owner's login.", 403);
  return transaction(async (db) => {
    // Lock the list before its invitation, matching share/revoke lock order.
    const found = (
      await db.query(
        "SELECT network_id FROM parts_network_invites WHERE id=$1",
        [networkId(inviteId)],
      )
    ).rows[0];
    if (!found) throw new PartsError("Invitation unavailable.", 404);
    const list = (
      await db.query(
        "SELECT * FROM parts_networks WHERE id=$1 AND archived=false FOR UPDATE",
        [found.network_id],
      )
    ).rows[0];
    const inv = (
      await db.query(
        "SELECT * FROM parts_network_invites WHERE id=$1 FOR UPDATE",
        [inviteId],
      )
    ).rows[0];
    if (
      !list ||
      inv.channel !== "direct" ||
      inv.email.toLowerCase() !== actor.email.toLowerCase() ||
      inv.revoked_at ||
      inv.consumed_at ||
      new Date(inv.expires_at).getTime() < Date.now()
    )
      throw new PartsError("Invitation unavailable.", 403);
    await db.query(
      `INSERT INTO parts_network_members(network_id,dealer_id,role,status,email) VALUES($1,$2,$3,'active',$4) ON CONFLICT(network_id,dealer_id) DO NOTHING`,
      [inv.network_id, actor.id, inv.role, actor.email],
    );
    await db.query(
      "UPDATE parts_network_invites SET consumed_at=now() WHERE id=$1",
      [inviteId],
    );
    await audit(db, inv.network_id, actor, "accept-direct", actor.email);
    return { network: inv.network_id };
  });
}
export async function createPartsEnquiry(
  actor: PartsActor,
  id: string,
  input: Record<string, unknown>,
) {
  return transaction(async (db) => {
    await access(db, actor, id);
    const part = str(input.partNumber, 100),
      recipient = str(input.dealerId, 200),
      message = str(input.message, 2000);
    if (!message) throw new PartsError("Enter your enquiry.");
    const row = (
      await db.query(
        `SELECT r.part_number FROM parts_network_rows r JOIN parts_network_members m ON m.network_id=r.network_id AND m.dealer_id=r.dealer_id WHERE r.network_id=$1 AND r.dealer_id=$2 AND r.part_key=upper($3) AND r.quantity>0 AND m.visible AND m.status='active'`,
        [id, recipient, part],
      )
    ).rows[0];
    if (!row || recipient === actor.id)
      throw new PartsError("Choose an available part from another dealer.");
    const recent = (
      await db.query(
        "SELECT id FROM parts_enquiries WHERE sender_id=$1 AND network_id=$2 AND recipient_id=$3 AND part_number=$4 AND created_at>now()-interval '1 minute'",
        [actor.id, id, recipient, row.part_number],
      )
    ).rows;
    if (recent.length)
      throw new PartsError(
        "Your enquiry was already sent. Please wait before sending another.",
        429,
      );
    await db.query(
      "INSERT INTO parts_enquiries(id,network_id,sender_id,recipient_id,part_number,message,reply_email) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        id,
        actor.id,
        recipient,
        row.part_number,
        message,
        actor.email,
      ],
    );
    await audit(db, id, actor, "enquiry", row.part_number);
  });
}
export async function handlePartsEnquiry(actor: PartsActor, id: unknown) {
  await ensurePartsNetwork();
  await getDb().query(
    "UPDATE parts_enquiries SET status='handled' WHERE id=$1 AND recipient_id=$2",
    [networkId(id), actor.id],
  );
}

export async function resolvePartsShare(actor: PartsActor, token: unknown) {
  await ensurePartsNetwork();
  const raw = str(token, 128);
  if (!/^[a-f0-9]{64}$/.test(raw))
    throw new PartsError("Invitation unavailable.", 403);
  const row = (
    await getDb().query(
      `SELECT i.network_id,i.consumed_at,i.revoked_at,i.expires_at,m.status FROM parts_network_invites i JOIN parts_networks n ON n.id=i.network_id LEFT JOIN parts_network_members m ON m.network_id=i.network_id AND m.dealer_id=$2 WHERE i.token_hash=$1 AND lower(i.email)=lower($3) AND NOT n.archived`,
      [hash(raw), actor.id, actor.email],
    )
  ).rows[0];
  if (!row)
    throw new PartsError(
      "Invitation unavailable or belongs to another email.",
      403,
    );
  if (row.consumed_at)
    return {
      signedIn: true,
      accepted: true,
      network: row.network_id,
      status: row.status,
    };
  if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now())
    throw new PartsError("Invitation expired or revoked.", 403);
  return { signedIn: true, accepted: false };
}
