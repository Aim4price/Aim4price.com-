const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "exports", code)(
    (n) => (n in mocks ? mocks[n] : require(n)),
    exports,
  );
  return exports;
}
const csv = load("lib/parts-network-csv.ts"),
  columns = { partNumber: 0, quantity: 1, price: 2 };
test("CSV handles BOM, semicolon decimal commas, quotes, CRLF and leading zeros", () => {
  const rows = csv.parsePartsSnapshot(
    '\uFEFFPart number;Quantity;Price\r\n001-AB;2;"R 1 234,50"\r\n"X;Y";0;0',
    columns,
  );
  assert.deepEqual(rows, [
    { partNumber: "001-AB", quantity: 2, price: 1234.5 },
    { partNumber: "X;Y", quantity: 0, price: 0 },
  ]);
  assert.deepEqual(
    csv.parsePartsSnapshot('Code,Qty,Price\n001,3,"1,234.50"', columns),
    [{ partNumber: "001", quantity: 3, price: 1234.5 }],
  );
  assert.deepEqual(
    csv.guessPartColumns(["Stock Code", "Qty", "Unit Price"]),
    columns,
  );
});
test("CSV refuses empty snapshots, duplicate identities, invalid numbers and mismatched mappings", () => {
  for (const text of [
    "Part,Qty,Price",
    "Part,Qty,Price\na,1,2\nA,2,3",
    "Part,Qty,Price\na,-1,2",
    "Part,Qty,Price\na,1.5,2",
    "Part,Qty,Price\na,1,2,3",
    'Part,Qty,Price\n"a,1,2',
    'Part,Qty,Price\na,1,"1,234"',
  ])
    assert.throws(() => csv.parsePartsSnapshot(text, columns));
  assert.throws(() =>
    csv.parsePartsSnapshot("Part,Qty,Price\na,1,2", {
      partNumber: 0,
      quantity: 0,
      price: 2,
    }),
  );
  assert.throws(() => csv.readPartsCsv("x".repeat(2000001)));
  assert.deepEqual(
    csv.snapshotChanges(
      [
        { partNumber: "a", quantity: 1, price: 2 },
        { partNumber: "b", quantity: 2, price: 3 },
      ],
      [
        { partNumber: "A", quantity: 5, price: 2 },
        { partNumber: "c", quantity: 1, price: 1 },
      ],
    ),
    { added: 1, updated: 1, removed: 1, total: 2 },
  );
});
test("private network membership, import replacement and invitation lifecycle use real SQL", async () => {
  const db = new PGlite();
  await db.exec(
    "CREATE TABLE account_profiles(user_id text,business_name text,town_city text);",
  );
  const client = {
    query: async (sql, args) =>
      sql === load("lib/parts-network-schema.ts").PARTS_NETWORK_SCHEMA
        ? db.exec(sql)
        : db.query(sql, args),
    release() {},
  };
  const pool = { ...client, connect: async () => client };
  const messages = [];
  const network = load("lib/parts-network.ts", {
    "./db": { getDb: () => pool },
    "./parts-network-schema": load("lib/parts-network-schema.ts"),
    "./parts-network-csv": csv,
    "./email": {
      getSiteOrigin: () => "https://example.test",
      sendAim4priceEmail: async (m) => messages.push(m),
    },
  });
  const admin = {
    id: "platform",
    email: "admin@example.test",
    platformAdmin: true,
    staff: false,
    canContribute: true,
  };
  const dealer = {
    id: "dealer-a",
    email: "a@example.test",
    platformAdmin: false,
    staff: false,
    canContribute: true,
  };
  const other = { ...dealer, id: "dealer-b", email: "b@example.test" };
  const outsider = { ...dealer, id: "outsider", email: "x@example.test" };
  const { id } = await network.createPartsNetwork(admin, "Private pilot");
  const { id: second } = await network.createPartsNetwork(admin, "Other group");
  assert.deepEqual(await network.listPartsNetworks(outsider), []);
  await assert.rejects(
    () => network.partsData(outsider, id, "search", "", 0),
    /approval/,
  );
  await assert.rejects(
    () => network.createPartsNetwork(dealer, "bad"),
    /administrator/,
  );
  await db.query(
    "INSERT INTO parts_network_members(network_id,dealer_id,role,status,business_name,email) VALUES($1,$2,'admin','active','Dealer A',$3),($1,$4,'contributor','active','Dealer B',$5)",
    [id, dealer.id, dealer.email, other.id, other.email],
  );
  const input = {
    csv: "Part number,Qty,Price\n001,3,12\n002,4,14",
    columns,
    businessName: "Dealer A",
    town: "George",
    phone: "0821234567",
    email: dealer.email,
    vatIncluded: false,
  };
  const preview = await network.importParts(dealer, id, input, false);
  assert.equal(preview.summary.added, 2);
  await network.importParts(
    dealer,
    id,
    { ...input, revision: preview.revision },
    true,
  );
  await network.importParts(
    other,
    id,
    { ...input, businessName: "Dealer B", revision: 0 },
    true,
  );
  let result = await network.partsData(other, id, "search", "001", 0);
  assert.equal(result.total, 2);
  assert.equal(result.rows[0].part_number, "001");
  await assert.rejects(
    () => network.partsData(dealer, second, "search", "", 0),
    /approval/,
  );
  await assert.rejects(
    () => network.importParts(dealer, id, { ...input, revision: 0 }, true),
    /changed/,
  );
  const update = { ...input, csv: "Part number,Qty,Price\n001,1,15\n003,2,10" };
  const p2 = await network.importParts(dealer, id, update, false);
  assert.deepEqual(p2.summary, { added: 1, updated: 1, removed: 1, total: 2 });
  await network.importParts(
    dealer,
    id,
    { ...update, revision: p2.revision },
    true,
  );
  result = await network.partsData(dealer, id, "mine", "", 0);
  assert.deepEqual(
    result.rows.map((r) => r.part_number),
    ["001", "003"],
  );
  assert.equal(
    (await network.partsData(other, id, "mine", "", 0)).rows.length,
    2,
    "replacement never touches another dealer",
  );
  await assert.rejects(() =>
    network.importParts(
      dealer,
      id,
      { ...input, csv: "Part,Qty,Price", revision: 2 },
      true,
    ),
  );
  assert.equal((await network.partsData(dealer, id, "mine", "", 0)).total, 2);
  await network.setPartsVisibility(dealer, id, false);
  assert.equal((await network.partsData(other, id, "search", "", 0)).total, 2);
  await network.changePartsMember(dealer, id, other.id, "viewer", "active");
  await assert.rejects(
    () => network.importParts(other, id, input, false),
    /Contribution/,
  );
  await assert.rejects(
    () => network.invitePartsMember(other, id, "x@example.test", "admin"),
    /administrator/,
  );
  await assert.rejects(
    () =>
      network.invitePartsMember(
        { ...dealer, staff: true },
        id,
        "x@example.test",
        "admin",
      ),
    /administrator/,
  );
  await assert.rejects(
    () =>
      network.importParts(
        { ...dealer, staff: true, canContribute: false },
        id,
        input,
        false,
      ),
    /Contribution/,
  );
  await assert.rejects(
    () =>
      network.changePartsMember(dealer, id, dealer.id, "contributor", "active"),
    /another active/,
  );
  const invite = await network.invitePartsMember(
    dealer,
    id,
    outsider.email,
    "contributor",
  );
  const token = new URL(invite.url).searchParams.get("token");
  process.env.RESEND_API_KEY = "test-only";
  await assert.rejects(() => network.partsInvitePin(other, token), /belongs/);
  await network.partsInvitePin(outsider, token);
  const pin = messages.at(-1).text.match(/\d{6}/)[0];
  await assert.rejects(() => network.partsInvitePin(outsider, token), /wait/);
  await assert.rejects(
    () => network.partsInvitePin(outsider, token, "000000"),
    /Incorrect/,
  );
  assert.equal(
    (await db.query("SELECT attempts FROM parts_network_invites")).rows[0]
      .attempts,
    1,
    "failed attempts must commit",
  );
  await network.partsInvitePin(outsider, token, pin);
  await assert.rejects(
    () => network.partsData(outsider, id, "search", "", 0),
    /approval/,
  );
  await assert.rejects(
    () => network.partsInvitePin(outsider, token, pin),
    /unavailable/,
  );
  await network.changePartsMember(
    dealer,
    id,
    outsider.id,
    "contributor",
    "active",
  );
  assert.equal(
    (await network.partsData(outsider, id, "search", "", 0)).total,
    2,
  );
  await network.changePartsMember(dealer, id, other.id, "viewer", "suspended");
  await assert.rejects(
    () => network.partsData(other, id, "search", "", 0),
    /approval/,
  );
  assert.equal(
    (await network.partsData(outsider, id, "search", "", 0)).total,
    0,
    "suspended dealer listings hidden",
  );
  const fresh = await network.invitePartsMember(
    dealer,
    id,
    other.email,
    "admin",
  );
  const token2 = new URL(fresh.url).searchParams.get("token");
  await network.partsInvitePin(other, token2);
  await network.partsInvitePin(
    other,
    token2,
    messages.at(-1).text.match(/\d{6}/)[0],
  );
  await assert.rejects(
    () => network.partsData(other, id, "search", "", 0),
    /approval/,
    "invitation cannot reinstate a suspended member",
  );
  const blocked = await network.invitePartsMember(
    dealer,
    id,
    "blocked@example.test",
    "viewer",
  );
  const record = (
    await db.query(
      "SELECT id FROM parts_network_invites WHERE email='blocked@example.test'",
    )
  ).rows[0];
  await network.revokePartsInvite(dealer, id, record.id);
  await assert.rejects(
    () =>
      network.partsInvitePin(
        { ...outsider, email: "blocked@example.test" },
        new URL(blocked.url).searchParams.get("token"),
      ),
    /unavailable/,
  );
  await db.close();
});
test("account and staff gates reject inactive dealers, other account types and technicians", async () => {
  let session = { user: { id: "dealer", email: "dealer@example.test" } },
    profile = {
      accountType: "dealer",
      accountStatus: "active",
      accountSubtype: "agricultural",
    },
    staff = false;
  const access = load("lib/parts-network-access.ts", {
    "./auth-session": {
      getServerSession: async () => session,
      isDealerAppSession: () => staff,
    },
    "./account-profile": { getAccountProfile: async () => profile },
    "./account-constants": {
      isAim4priceAdminEmail: (e) => e === "admin@example.test",
    },
    "./dealer-app-access": load("lib/dealer-app-access.ts"),
    "./middleman-account": {
      isMiddlemanAccountSubtype: (s) => s === "middleman",
    },
  });
  assert.equal((await access.getPartsActor()).canContribute, true);
  profile.accountStatus = "pending_payment";
  assert.equal(await access.getPartsActor(), null);
  assert.ok(await access.getPartsActor(true));
  profile.accountStatus = "suspended";
  assert.equal(await access.getPartsActor(true), null);
  profile.accountStatus = "active";
  profile.accountType = "owner";
  assert.equal(await access.getPartsActor(), null);
  profile.accountType = "dealer";
  profile.accountSubtype = "middleman";
  assert.equal(await access.getPartsActor(), null);
  profile.accountSubtype = "agricultural";
  staff = true;
  session.dealerApp = { role: "technician" };
  assert.equal(await access.getPartsActor(), null);
  session.dealerApp.role = "sales";
  assert.equal((await access.getPartsActor()).canContribute, false);
  session.dealerApp.role = "parts";
  assert.equal((await access.getPartsActor()).canContribute, true);
  staff = false;
  session.user.email = "admin@example.test";
  assert.equal((await access.getPartsActor()).platformAdmin, true);
  session = null;
  assert.equal(await access.getPartsActor(), null);
});
