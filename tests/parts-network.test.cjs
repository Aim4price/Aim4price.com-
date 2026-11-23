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
    { ...columns, brand: -1, description: -1 },
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
test("headerless tables preserve identifiers, optional prices and dealer metadata", () => {
  const mapping = { partNumber: 0, description: 1, quantity: 2, price: -1 };
  const rows = csv.parsePartsSnapshot('01.00123\tDowel\t16\n01.ABC-01\tBush\t9', mapping, { hasHeader: false, stripPrefix: "01.", defaultBrand: "Landini" });
  assert.deepEqual(rows, [
    { partNumber: "00123", description: "Dowel", quantity: 16, price: null, brand: "Landini" },
    { partNumber: "ABC-01", description: "Bush", quantity: 9, price: null, brand: "Landini" },
  ]);
  assert.equal(csv.parsePartsSnapshot('Code,Qty,Price\n001,1,', columns)[0].price, null);
  assert.equal(csv.parsePartsSnapshot('Code,Qty,Price\n001,1,0', columns)[0].price, 0);
  assert.equal(csv.parsePartsSnapshot('01.00123,Dowel,16', mapping, { hasHeader: false })[0].partNumber, '01.00123');
  assert.throws(() => csv.parsePartsSnapshot('01.A,Dowel,1\nA,Bush,2', mapping, { hasHeader: false, stripPrefix: '01.' }), /duplicate/);
  assert.equal(csv.snapshotChanges(rows, rows.map(r => ({ ...r, brand: 'JD' }))).updated, 2);
  assert.throws(() => csv.parsePartsSnapshot('a,b,1', { ...mapping, description: 0 }, { hasHeader: false }), /different columns/);
});
test("Excel sheets preserve text and zero padding, and reject uncached formulas", async () => {
  const Excel = require('exceljs');
  const reader = load('lib/parts-network-excel.ts');
  const workbook = new Excel.Workbook();
  const sheet = workbook.addWorksheet('Stock');
  sheet.addRow(['01.3657074', 'Dowel', 16]);
  sheet.addRow([123, 'Bush', 9]);
  sheet.getCell('A2').numFmt = '00000';
  workbook.addWorksheet('Other').addRow(['JD-1', 'Bolt', 1]);
  const rows = await reader.readPartsExcel(await workbook.xlsx.writeBuffer());
  assert.equal(rows.length, 2);
  assert.equal(rows[0].rows[0][0], '01.3657074');
  assert.equal(rows[0].rows[1][0], '00123');
  sheet.getCell('C1').value = { formula: '1+2' };
  await assert.rejects(async () => reader.readPartsExcel(await workbook.xlsx.writeBuffer()), /calculated values/);
});
test("private network membership, import replacement and invitation lifecycle use real SQL", async () => {
  const db = new PGlite();
  await db.exec(
    "CREATE TABLE account_profiles(user_id text,business_name text,town_city text,account_type text,account_status text,account_subtype text); CREATE TABLE \"user\"(id text,email text); CREATE TABLE sharing_account_access(user_id text,plan text);",
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
    "./team-access": {lockTeamPermission:async(_,s,p)=>{if(!s.grant.permissions[p])throw Error("Permission denied");return s.grant;},auditTeam:async()=>{}},
    "./db": { getDb: () => pool },
    "./parts-network-schema": load("lib/parts-network-schema.ts"),
    "./parts-network-csv": csv,
    "./sharing-foundation": { ensureSharingFoundation: async () => {} },
    "./business-network": {ensureBusinessNetwork:async()=>{await db.exec("CREATE TABLE IF NOT EXISTS business_network(id text,status text,accepted_at timestamptz,details jsonb DEFAULT '{}'::jsonb); CREATE TABLE IF NOT EXISTS account_directory_listings(user_id text,business_id text,logo_data text DEFAULT '');");}},
    "./email": {
      getSiteOrigin: () => "https://example.test",
      sendAim4priceEmail: async (m) => messages.push(m),
    },
  });
  const otherFounder = {
    id: "dealer-founder-b",
    email: "founder-b@example.test",
    staff: false,
    canContribute: true,
  };
  const dealer = {
    id: "dealer-a",
    email: "a@example.test",
    staff: false,
    canContribute: true,
  };
  const other = { ...dealer, id: "dealer-b", email: "b@example.test" };
  const outsider = { ...dealer, id: "outsider", email: "x@example.test" };
  const { id } = await network.createPartsNetwork(dealer, "Private pilot");
  const { id: second } = await network.createPartsNetwork(
    otherFounder,
    "Other group",
  );
  assert.deepEqual(await network.listPartsNetworks(outsider), []);
  const ownNetworks = await network.listPartsNetworks(dealer);
  assert.equal(ownNetworks.length, 1);
  assert.equal(ownNetworks[0].id, id);
  assert.equal(ownNetworks[0].role, "admin");
  assert.equal(ownNetworks[0].status, "active");
  await assert.rejects(
    () => network.partsData(otherFounder, id, "members", "", 0),
    /approval/,
  );
  await assert.rejects(
    () => network.partsData(outsider, id, "search", "", 0),
    /approval/,
  );
  await assert.rejects(
    () => network.createPartsNetwork({ ...dealer, staff: true }, "bad"),
    /account owner/,
  );
  await db.query(
    "INSERT INTO parts_network_members(network_id,dealer_id,role,status,business_name,email) VALUES($1,$2,'admin','active','Dealer A',$3),($1,$4,'contributor','active','Dealer B',$5) ON CONFLICT(network_id,dealer_id) DO UPDATE SET business_name=excluded.business_name",
    [id, dealer.id, dealer.email, other.id, other.email],
  );
  for (let i = 0; i < 65; i++) {
    const part = `PAGE-${String(i).padStart(3, "0")}`;
    await db.query("INSERT INTO parts_network_rows(network_id,dealer_id,part_number,part_key,quantity,price) VALUES($1,$2,$3,$3,1,0)", [id, dealer.id, part]);
  }
  for (const size of [20, 40, 60]) {
    const first = await network.partsData(dealer, id, "mine", "PAGE-", 0, false, size);
    const next = await network.partsData(dealer, id, "mine", "PAGE-", 1, false, size);
    assert.equal(first.rows.length, size);
    assert.equal(first.total, 65);
    assert.equal(next.rows.length, Math.min(size, 65 - size));
    assert.equal(next.rows[0].part_number, `PAGE-${String(size).padStart(3, "0")}`);
  }
  assert.equal((await network.partsData(dealer, id, "mine", "PAGE-", 3, false, "all")).rows.length, 65);
  assert.equal((await network.partsData(dealer, id, "mine", "PAGE-064", 0, false, 20)).total, 1);
  assert.equal((await network.partsData(dealer, id, "mine", "PAGE-", 2, true, 20)).rows.length, 65);
  await db.query("DELETE FROM parts_network_rows WHERE network_id=$1 AND dealer_id=$2", [id, dealer.id]);
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
  await assert.rejects(() => network.importParts(dealer,id,{...input,mode:"add"},false), /already exists/);
  await assert.rejects(() => network.importParts(dealer,id,{...input,mode:"replace",baseRevision:0},false), /changed after opening/);
  await assert.rejects(() => network.importParts(dealer,id,{...input,mode:"replace",baseRevision:0,revision:1},true), /changed after opening/);
  const editPreview = await network.importParts(dealer,id,{...input,mode:"replace",baseRevision:1,csv:""},false);
  assert.equal(editPreview.summary.removed,2);
  const staff = {...dealer,staff:true,team:{actor:{id:'staff'},grant:{partsListIds:[id],permissions:{viewParts:true,manageParts:true}}}};
  assert.equal((await network.listPartsNetworks(staff)).length,1);
  await assert.rejects(()=>network.partsData(staff,second,'search','',0),/unavailable/);
  await assert.rejects(()=>network.partsData(staff,id,'members','',0),/administration/);
  const staffPreview = await network.importParts(staff,id,input,false);
  await network.importParts(staff,id,{...input,businessName:'Unapproved identity',email:'changed@example.test',revision:staffPreview.revision},true);
  const savedIdentity=(await db.query('SELECT business_name,email FROM parts_network_members WHERE network_id=$1 AND dealer_id=$2',[id,dealer.id])).rows[0];
  assert.equal(savedIdentity.business_name,'Dealer A');assert.equal(savedIdentity.email,dealer.email);
  await assert.rejects(()=>network.importParts({...staff,team:{...staff.team,grant:{...staff.team.grant,permissions:{viewParts:true,manageParts:false}}}},id,input,false),/Permission denied/);
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
  assert.equal((await network.resolvePartsShare(outsider, token)).status, "pending");
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
  assert.equal((await network.resolvePartsShare(outsider, token)).status, "active");
  await assert.rejects(() => network.resolvePartsShare(other, token));
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
    "./business-accounts":{canBusinessRead:async()=>profile.accountStatus==="active"},
    "./business-credits":{ensureCreditSchema:async()=>{}},
    "./desktop-workspace":{getDesktopScope:async()=>null},
    "./auth-session": {
      getServerSession: async () => session,
      isDealerAppSession: () => staff,
    },
    "./account-profile": { getAccountProfile: async () => profile },
    "./sharing-foundation": { sharingPlan: async () => profile.accountType === "business" ? "free" : "desktop" },
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
  profile.accountType = "business";
  assert.equal((await access.getPartsActor()).canContribute,true);
  assert.equal((await access.getPartsActor()).viewerOnly,false);
  profile.accountStatus='suspended'; assert.equal(await access.getPartsActor(),null);
  profile.accountStatus='active';
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
  assert.equal(await access.getPartsActor(), null);
  session = null;
  assert.equal(await access.getPartsActor(), null);
});
test("named lists isolate CSVs, direct shares, enquiries and archived access", async () => {
  const db = new PGlite();
  await db.exec(
    "CREATE TABLE account_profiles(user_id text,business_name text,town_city text,account_type text,account_status text,account_subtype text); CREATE TABLE \"user\"(id text,email text); CREATE TABLE sharing_account_access(user_id text,plan text)",
  );
  const schema = load("lib/parts-network-schema.ts");
  const client = {
    query: (sql, args) =>
      sql === schema.PARTS_NETWORK_SCHEMA ? db.exec(sql) : db.query(sql, args),
    release() {},
  };
  const parts = load("lib/parts-network.ts", {
    "./team-access": {lockTeamPermission:async(_,s,p)=>{if(!s.grant.permissions[p])throw Error("Permission denied");return s.grant;},auditTeam:async()=>{}},
    "./db": { getDb: () => ({ ...client, connect: async () => client }) },
    "./parts-network-schema": schema,
    "./parts-network-csv": csv,
    "./sharing-foundation": { ensureSharingFoundation: async () => {} },
    "./business-network": {ensureBusinessNetwork:async()=>{await db.exec("CREATE TABLE IF NOT EXISTS business_network(id text,status text,accepted_at timestamptz,details jsonb DEFAULT '{}'::jsonb); CREATE TABLE IF NOT EXISTS account_directory_listings(user_id text,business_id text,logo_data text DEFAULT '');");}},
    "./email": { getSiteOrigin: () => "https://example.test" },
  });
  const owner = {
    id: "owner",
    email: "owner@example.test",
    staff: false,
    canContribute: true,
  };
  const buyer = { ...owner, id: "buyer", email: "buyer@example.test" };
  const stranger = { ...owner, id: "stranger", email: "stranger@example.test" };
  const a = (await parts.createPartsNetwork(owner, "Landini", true)).id;
  const b = (await parts.createPartsNetwork(owner, "John Deere", true)).id;
  const input = {
    csv: "Part,Qty,Price\n001,3,12",
    columns,
    businessName: "Dealer",
    town: "George",
    phone: "0821234567",
    email: owner.email,
    vatIncluded: false,
    revision: 0,
  };
  await parts.importParts(owner, a, input, true);
  await parts.importParts(owner, b, input, true);
  await parts.importParts(
    owner,
    a,
    { ...input, csv: "Part,Qty,Price\n002,1,20", revision: 1 },
    true,
  );
  assert.equal(
    (await parts.partsData(owner, b, "mine", "", 0)).rows[0].part_number,
    "001",
  );
  const additional = { ...input, mode: "merge", csv: 'Part,Qty,Price,Brand,Description\nNEW,2,,Landini,Dowel', columns: { ...columns, brand: 3, description: 4 } };
  const mergePreview = await parts.importParts(owner, b, additional, false);
  assert.deepEqual(mergePreview.summary, { added: 1, updated: 0, removed: 0, total: 2 });
  assert.equal(mergePreview.sample[0].price, null);
  await parts.importParts(owner, b, { ...additional, revision: mergePreview.revision }, true);
  const saved = (await parts.partsData(owner, b, 'mine', 'NEW', 0)).rows[0];
  assert.equal(saved.price, null);
  assert.equal(saved.brand, 'Landini');
  assert.equal(saved.description, 'Dowel');
  assert.equal((await parts.partsData(owner, b, 'mine', '', 0)).total, 2);
  await assert.rejects(() => parts.importParts(owner, b, { ...additional, revision: mergePreview.revision }, true), /changed/);
  const edit = { ...additional, csv: 'Part,Qty,Price,Brand,Description\nNEW,4,0,JD,Updated' };
  const editPreview = await parts.importParts(owner, b, edit, false);
  assert.deepEqual(editPreview.summary, { added: 0, updated: 1, removed: 0, total: 2 });
  await parts.importParts(owner, b, { ...edit, revision: editPreview.revision }, true);
  const edited = (await parts.partsData(owner, b, 'mine', 'NEW', 0)).rows[0];
  assert.equal(Number(edited.price), 0);
  assert.equal(edited.quantity, 4);
  assert.equal(edited.brand, 'JD');
  assert.equal((await parts.partsData(owner, b, 'mine', '', 0)).total, 2);

  await db.query('INSERT INTO "user"(id,email) VALUES($1,$2) ON CONFLICT DO NOTHING',[buyer.id,buyer.email]);
  await db.query("INSERT INTO account_profiles(user_id,account_type,account_status) VALUES($1,'dealer','active')",[buyer.id]);
  await db.exec("CREATE TABLE IF NOT EXISTS business_network(id text,status text,accepted_at timestamptz,details jsonb DEFAULT '{}'::jsonb); CREATE TABLE IF NOT EXISTS account_directory_listings(user_id text,business_id text,logo_data text DEFAULT '');");
  await db.query("INSERT INTO business_network(id,status,accepted_at) VALUES($1,'active',now());",[buyer.id]);
  await db.query("INSERT INTO account_directory_listings(user_id,business_id) VALUES($1,$1);",[buyer.id]);
  await parts.invitePartsMember(owner, a, buyer.email, "viewer", "direct");
  const invitation = (await parts.partsInbox(buyer)).invitations[0];
  assert.equal(invitation.name, "Landini");
  assert.equal((await parts.partsInbox(stranger)).invitations.length, 0);
  await assert.rejects(() =>
    parts.acceptDirectPartsShare(stranger, invitation.id),
  );
  await assert.rejects(()=>parts.invitePartsMember(owner,a,stranger.email,"viewer","direct"), /active dealer/);
  assert.equal((await parts.partsRecipients(owner,a,'buyer')).recipients[0].email,buyer.email);
  await db.exec(`INSERT INTO "user"(id,email) VALUES('paid-business','paid@example.test'),('free-business','free@example.test'); INSERT INTO account_profiles(user_id,business_name,account_type,account_status) VALUES('paid-business','Paid workshop','business','active'),('free-business','Free workshop','business','active'); INSERT INTO sharing_account_access(user_id,plan) VALUES('paid-business','desktop'),('free-business','free');`);
  await db.exec("INSERT INTO business_network(id,status,accepted_at) VALUES('paid-business','active',now()),('free-business','active',now()); INSERT INTO account_directory_listings(user_id,business_id) VALUES('paid-business','paid-business'),('free-business','free-business');");
  assert.deepEqual((await parts.partsRecipients(owner,a,'workshop')).recipients.map(r=>r.email),['free@example.test','paid@example.test']);
  await parts.invitePartsMember(owner,a,'free@example.test','viewer','direct');
  const freeBusiness = {...owner,id:'free-business',email:'free@example.test',viewerOnly:true,canContribute:false};
  const freeInvite = (await parts.partsInbox(freeBusiness)).invitations[0];
  await parts.acceptDirectPartsShare(freeBusiness,freeInvite.id);
  assert.equal((await parts.partsData(freeBusiness,a,'search','',0)).total,1);
  await assert.rejects(()=>parts.importParts(freeBusiness,a,input,false));
  await db.exec(`UPDATE account_profiles SET town_city='Knysna' WHERE user_id='free-business';`);
  assert.equal((await parts.partsRecipients(owner,a,'knysna')).recipients[0].email,'free@example.test');
  await db.exec(`UPDATE business_network SET details='{"name":"Free workshop","town":"Knysna","address":"Knysna, Western Cape","phone":"0441234567","services":["Parts"]}' WHERE id='free-business';`);
  const located=await parts.partsRecipients(owner,a,'workshop','Knysna, Western Cape');
  assert.deepEqual(located.recipients.map(r=>r.email),['free@example.test']);
  assert.equal(located.recipients[0].services,'Parts');
  assert.equal(located.recipients[0].phone,'0441234567');
  assert.equal((await parts.partsRecipients(owner,a,'workshop','Gauteng')).recipients.length,0);
  const legacy = (await parts.createPartsNetwork(owner,'Shared network',false)).id;
  await assert.rejects(()=>parts.invitePartsMember(owner,legacy,'free@example.test','admin','direct'), /view and enquire access only/);
  await db.exec(`UPDATE account_profiles SET account_status='suspended' WHERE user_id='free-business';`);
  assert.equal((await parts.partsRecipients(owner,a,'free@example.test')).recipients.length,0);
  await assert.rejects(()=>parts.invitePartsMember(owner,a,'free@example.test','viewer','direct'),/active dealer/);

  await assert.rejects(()=>parts.partsRecipients(buyer,a,''));
  await parts.acceptDirectPartsShare(buyer, invitation.id);
  assert.equal((await parts.partsData(owner,a,'members','',0)).members.find(m=>m.dealer_id===buyer.id).last_viewed_at,null);
  assert.equal((await parts.partsData(buyer, a, "search", "", 0)).total, 1);
  assert.equal((await parts.partsInbox(buyer)).shared.length, 1);
  assert.ok((await parts.partsData(owner,a,'members','',0)).members.find(m=>m.dealer_id===buyer.id).last_viewed_at);
  await assert.rejects(()=>parts.createPartsNetwork({...buyer,viewerOnly:true,canContribute:false},'Forbidden',true));
  await assert.rejects(()=>parts.importParts({...owner,viewerOnly:true},a,input,false));
  await assert.rejects(() => parts.partsData(buyer, b, "search", "", 0));
  await assert.rejects(() => parts.importParts(buyer, a, input, false));
  await assert.rejects(() => parts.managePartsList(buyer, a, "bad"));
  await assert.rejects(() =>
    parts.invitePartsMember(owner, a, stranger.email, "contributor"),
  );
  await assert.rejects(() =>
    parts.changePartsMember(owner, a, buyer.id, "admin", "active"),
  );
  await parts.createPartsEnquiry(buyer, a, {
    dealerId: owner.id,
    partNumber: "002",
    message: "Is it available?",
  });
  const enquiry = (await parts.partsInbox(owner)).enquiries[0];
  assert.equal(enquiry.part_number, "002");
  assert.equal(enquiry.reply_email, buyer.email);
  assert.equal((await parts.partsInbox(stranger)).enquiries.length, 0);
  await parts.handlePartsEnquiry(stranger, enquiry.id);
  assert.equal((await parts.partsInbox(owner)).enquiries[0].status, "new");
  await parts.handlePartsEnquiry(owner, enquiry.id);
  assert.equal((await parts.partsInbox(owner)).enquiries[0].status, "handled");
  await assert.rejects(
    () =>
      parts.createPartsEnquiry(buyer, a, {
        dealerId: owner.id,
        partNumber: "002",
        message: "Again",
      }),
    /already sent/,
  );
  const multiInput={...input,mode:'merge',csv:'Part,Qty,Price\n003,3,10',revision:2};
  await parts.importParts(owner,a,multiInput,true);
  const multi={dealerId:owner.id,items:[{partNumber:'002',quantity:2},{partNumber:'003',quantity:4}],message:'Please quote both.'};
  await assert.rejects(()=>parts.createPartsEnquiry(buyer,a,{...multi,items:[...multi.items,{partNumber:'missing',quantity:1}]}),/available parts/);
  assert.equal((await parts.partsInbox(owner)).enquiries.length,1);
  await assert.rejects(()=>parts.createPartsEnquiry(buyer,a,{...multi,items:[{partNumber:'002',quantity:0}]}),/positive whole/);
  await parts.createPartsEnquiry({...buyer,viewerOnly:true},a,multi);
  const combined=(await parts.partsInbox(owner)).enquiries.find(e=>e.part_number==='002, 003');
  assert.match(combined.message,/002 — quantity 2/); assert.match(combined.message,/003 — quantity 4/);
  await assert.rejects(()=>parts.createPartsEnquiry(buyer,a,{...multi,items:[...multi.items].reverse()}),/already sent/);
  await parts.changePartsMember(owner, a, buyer.id, "viewer", "suspended");
  await assert.rejects(() => parts.partsData(buyer, a, "search", "", 0));
  await parts.invitePartsMember(owner, a, buyer.email, "viewer", "direct");
  await parts.acceptDirectPartsShare(
    buyer,
    (await parts.partsInbox(buyer)).invitations[0].id,
  );
  await assert.rejects(() => parts.partsData(buyer, a, "search", "", 0));
  const link = await parts.invitePartsMember(
    owner,
    a,
    stranger.email,
    "viewer",
    "link",
  );
  await parts.managePartsList(owner, a, "Landini spares");
  assert.equal(
    (await parts.listPartsNetworks(owner)).find((n) => n.id === a).name,
    "Landini spares",
  );
  await parts.managePartsList(owner, a, "", true);
  assert.equal((await parts.listPartsNetworks(owner)).length, 2);
  await assert.rejects(() => parts.partsData(owner, a, "mine", "", 0));
  await assert.rejects(() =>
    parts.partsInvitePin(stranger, new URL(link.url).searchParams.get("token")),
  );
  assert.equal(
    (await parts.partsInbox(owner)).enquiries.length,
    2,
    "enquiries retained after archive",
  );
  await db.close();
});

test('clipboard pastes preserve row alignment, punctuation, blanks and existing columns',()=>{
 const editor=load('lib/parts-editor.ts',{'./parts-network-csv':csv});
 let rows=editor.pastePartsCells([editor.blankPart()],'001,ABC\n\n0007',0,0);
 assert.deepEqual(rows.map(r=>r[0]),['001,ABC','','0007']);
 rows=editor.pastePartsCells(rows,'2\n3\n4',0,2);
 assert.deepEqual(rows.map(r=>r[2]),['2','3','4']); assert.equal(rows[2][0],'0007');
 rows=editor.pastePartsCells(rows,'0\tLandini',0,3);
 assert.equal(rows[0][3],'0');assert.equal(rows[0][4],'Landini');
 assert.ok(editor.partRowErrors(rows)[1]);
 assert.throws(()=>editor.pastePartsCells(rows,'a\tb',0,4),/beyond Brand/);
 assert.throws(()=>editor.pastePartsCells(rows,'a\nb',19999,0),/20,000/);
 const duplicates=editor.partRowErrors([['ABC','','1','',''],['abc','','2','','']]);
 assert.match(duplicates[0],/Duplicate/);assert.match(duplicates[1],/Duplicate/);
 assert.deepEqual(editor.partRowErrors([['001','','1','','']]),{});
});
test('part number additions preserve identifiers and removals only match the ends',()=>{
 const {changePartNumber}=load('lib/parts-editor.ts',{'./parts-network-csv':csv});
 const change=(value,options)=>changePartNumber(value,{mode:'add',prefix:'',suffix:'',trim:false,...options});
 assert.equal(change('00123',{prefix:'LAN-'}),'LAN-00123');
 assert.equal(change('00123',{suffix:'.1'}),'00123.1');
 assert.equal(change('00123',{prefix:'LAN-',suffix:'-A'}),'LAN-00123-A');
 assert.equal(change(' 00123 ',{prefix:'LAN-',suffix:'-A',trim:true}),'LAN-00123-A');
 assert.equal(change(' 00123 ',{prefix:'LAN-'}),'LAN- 00123 ');
 assert.equal(change('LAN-00123',{prefix:'LAN-'}),'LAN-LAN-00123');
 assert.equal(change('',{prefix:'LAN-',suffix:'-A'}),'');
 assert.equal(change('   ',{prefix:'LAN-'}),'   ');
 assert.equal(change('01.00123.1',{mode:'remove',prefix:'01.',suffix:'.1'}),'00123');
 assert.equal(change('X01.00123.1Y',{mode:'remove',prefix:'01.',suffix:'.1'}),'X01.00123.1Y');
 assert.equal(change('A+B.01[1]',{mode:'remove',prefix:'A+B.',suffix:'[1]'}),'01');
 assert.equal(change(' 01.00123.1 ',{mode:'remove',prefix:'01.',suffix:'.1',trim:true}),'00123');
});
test('part number changes still reject duplicates, empty results and invalid codes',()=>{
 const {changePartNumber,partCellErrors}=load('lib/parts-editor.ts',{'./parts-network-csv':csv});
 const change=(value,options)=>changePartNumber(value,{mode:'add',prefix:'',suffix:'',trim:false,...options});
 const row=number=>[number,'','1','',''];
 assert.match(partCellErrors([row(change('001',{prefix:'LAN-'})),row('LAN-001')])[0][0],/Duplicate/);
 assert.ok(partCellErrors([row(change('001',{mode:'remove',prefix:'001'}))])[0][0]);
 assert.ok(partCellErrors([row(change('001',{suffix:'\n'}))])[0][0]);
});
test('parts signup continuations stay local and narrowly scoped',()=>{
 const {sharedEnquiryReturnTo:back}=load('lib/external-share-permissions.ts');
 assert.equal(back('/parts-share/'+'a'.repeat(64)), '/parts-share/'+'a'.repeat(64));
 for(const value of ['/parts-share/x','/parts-share/'+'a'.repeat(64)+'?redirect=evil','//evil.test/parts-share/'+'a'.repeat(64)])assert.equal(back(value),null);
 const link='/parts/join?token='+'a'.repeat(64);assert.equal(back(link),link);
 for(const value of ['https://evil.test/parts','//evil.test/parts','/parts/join?token=x','/parts/../admin','/parts?redirect=https://evil.test'])assert.equal(back(value),null);
});

test('sheet validation ignores untouched blank rows and identifies only invalid cells',()=>{
 const editor=load('lib/parts-editor.ts',{'./parts-network-csv':csv});
 assert.deepEqual(editor.partCellErrors([editor.blankPart()]),{});
 assert.deepEqual(Object.keys(editor.partCellErrors([['001','Dowel','','','']])[0]),['2']);
 const rows=editor.pastePartsCells([editor.blankPart()],'01.3657074\tDowel\t16\n01.3671641\tBush\t9',0,0);
 assert.equal(rows[1][1],'Bush');assert.equal(rows[1][2],'9');
 assert.deepEqual(editor.partCellErrors(rows),{});
});

test("row edits are scoped, validated and reject stale saves", async () => {
  const db = new PGlite();
  await db.exec(
    "CREATE TABLE account_profiles(user_id text,business_name text,town_city text,account_type text,account_status text,account_subtype text); CREATE TABLE \"user\"(id text,email text); CREATE TABLE sharing_account_access(user_id text,plan text);",
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
  const debits = [];
  let blockDebit = true;
  const network = load("lib/parts-network.ts", {
    "./business-credits": { spendBusinessCredit:async (writer, actor, label, key)=>{
      assert.equal(writer,client);
      if (blockDebit) throw Error("Monthly credits used");
      debits.push({actor,key});
    }},
    "./team-access": {lockTeamPermission:async(_,s,p)=>{if(!s.grant.permissions[p])throw Error("Permission denied");return s.grant;},auditTeam:async()=>{}},
    "./db": { getDb: () => pool },
    "./parts-network-schema": load("lib/parts-network-schema.ts"),
    "./parts-network-csv": csv,
    "./sharing-foundation": { ensureSharingFoundation: async () => {} },
    "./business-network": {ensureBusinessNetwork:async()=>{await db.exec("CREATE TABLE IF NOT EXISTS business_network(id text,status text,accepted_at timestamptz,details jsonb DEFAULT '{}'::jsonb); CREATE TABLE IF NOT EXISTS account_directory_listings(user_id text,business_id text,logo_data text DEFAULT '');");}},
    "./email": {
      getSiteOrigin: () => "https://example.test",
      sendAim4priceEmail: async (m) => messages.push(m),
    },
  });

  const dealer={id:'row-owner',email:'owner@example.test',staff:false,canContribute:true};
  const {id}=await network.createPartsNetwork(dealer,'Rows',true);
  await network.importParts(dealer,id,{csv:'Part,Qty,Price\n001,3,12\n002,4,14',columns,businessName:'Dealer',town:'George',phone:'0821234567',email:dealer.email,vatIncluded:false,revision:0},true);
  const edit={originalPartNumber:'001',partNumber:'003',quantity:'8',price:'',brand:'Landini',description:'Updated part',revision:1};
  await assert.rejects(()=>network.editPartsRow({...dealer,viewerOnly:true},id,edit),/viewing/);
  await assert.rejects(()=>network.editPartsRow({...dealer,id:'other'},id,edit),/approval/);
  await assert.rejects(()=>network.editPartsRow(dealer,id,{...edit,partNumber:'002'}),/already exists/);
  await assert.rejects(()=>network.editPartsRow(dealer,id,{...edit,quantity:'-1'}));
  const metered = {...dealer,metered:true};
  await assert.rejects(()=>network.editPartsRow(metered,id,edit),/Monthly credits used/);
  blockDebit = false;
  await network.editPartsRow(metered,id,edit);
  await assert.rejects(()=>network.editPartsRow(metered,id,edit),/changed/);
  assert.deepEqual(debits,[{actor:dealer.id,key:`stock-edit:${id}:${dealer.id}:2`}]);
  const rows=(await network.partsData(dealer,id,'mine','',0)).rows;
  assert.equal(rows.length,2);
  assert.equal(rows.find(r=>r.part_number==='002').quantity,4);
  const updated=rows.find(r=>r.part_number==='003');
  assert.equal(updated.quantity,8);assert.equal(updated.price,null);assert.equal(updated.description,'Updated part');
  await assert.rejects(()=>network.editPartsRow(dealer,id,edit),/changed/);
  assert.equal((await network.partsData(dealer,id,'mine','updated',0)).rows[0].part_number,'003');
  assert.equal((await network.partsData(dealer,id,'mine','landini',0)).rows[0].part_number,'003');
  await network.editPartsRow(dealer,id,{...edit,originalPartNumber:'003',quantity:'',brand:'',description:'',revision:2});
  const cleared=(await network.partsData(dealer,id,'mine','003',0)).rows[0];
  assert.equal(cleared.quantity,8);
  assert.equal(cleared.brand,'');
  assert.equal(cleared.description,'');

  await db.query("INSERT INTO parts_network_rows(network_id,dealer_id,part_key,part_number,quantity,price,brand,description) SELECT $1,$2,'EXTRA'||n,'EXTRA'||n,1,1,'','' FROM generate_series(1,55) n",[id,dealer.id]);
  assert.equal((await network.partsData(dealer,id,'mine','',0)).rows.length,50);
  assert.equal((await network.partsData(dealer,id,'mine','',0,true)).rows.length,57);
  await assert.rejects(()=>network.partsData({...dealer,id:'outsider'},id,'mine','',0,true),/approval/);

  const extraFields=[{id:"notes",label:"Notes",private:false},{id:"location",label:"Bin / shelf location",private:true},{id:"custom-size",label:"Dimensions",private:false}];
  await network.editPartsRow(dealer,id,{...edit,originalPartNumber:'003',revision:3,extraFields,details:{notes:'Unopened box',location:'Shelf A4','custom-size':'001 x 020'}});
  let own=await network.partsData(dealer,id,'mine','003',0,true);
  assert.equal(own.rows[0].details.location,'Shelf A4');
  assert.equal(own.fields.length,3);
  const viewer={...dealer,id:'shared-reader',email:'reader@example.test'};
  await db.query("INSERT INTO parts_network_members(network_id,dealer_id,role,status) VALUES($1,$2,'viewer','active')",[id,viewer.id]);
  assert.equal(await network.partsReportOwnerId(viewer,id),dealer.id,'Shared downloads use the list owner');
  assert.equal(await network.partsReportOwnerId(dealer,id),dealer.id);
  await assert.rejects(()=>network.partsReportOwnerId({...viewer,id:'outsider'},id),/approval/);
  const shared=await network.partsData(viewer,id,'search','003',0,true);
  assert.equal(shared.rows[0].details.notes,'Unopened box');
  assert.equal(shared.rows[0].details.location,undefined);
  assert.ok(!JSON.stringify(shared).includes('Shelf A4'));
  assert.ok(!shared.fields.some(f=>f.id==='location'));
  // A legacy import that has no extra columns must keep the existing details.
  await network.importParts(dealer,id,{mode:'merge',csv:'003,8,12',columns,options:{hasHeader:false},businessName:'Dealer',town:'George',phone:'0821234567',email:dealer.email,vatIncluded:false,revision:4},true);
  own=await network.partsData(dealer,id,'mine','003',0,true);
  assert.equal(own.rows[0].details.location,'Shelf A4');
  await assert.rejects(()=>network.editPartsRow(dealer,id,{...edit,originalPartNumber:'003',revision:5,extraFields:extraFields.map(f=>({...f,private:false})),details:{notes:'change'}}),/settings changed/);
  const imported={mode:'merge',csv:'003,8,12,,New condition',columns:{...columns,details:{notes:3,'custom-size':4}},options:{hasHeader:false},extraFields,businessName:'Dealer',town:'George',phone:'0821234567',email:dealer.email,vatIncluded:false,revision:5};
  await network.importParts(dealer,id,imported,true);
  own=await network.partsData(dealer,id,'mine','003',0,true);
  assert.equal(own.rows[0].details.notes,undefined);
  assert.equal(own.rows[0].details['custom-size'],'New condition');
  assert.equal(own.rows[0].details.location,'Shelf A4');
  assert.throws(()=>csv.validatePartFields([{id:'x',label:'Brand',private:false}]),/already exists/);
  assert.throws(()=>csv.validatePartDetails({location:'x'.repeat(501)},extraFields),/500/);
  // Removing a detail affects one row, leaving its stocklist definition intact.
  await network.editPartsRow(dealer,id,{...edit,originalPartNumber:'003',revision:6,extraFields,details:{location:'Shelf A4'}});
  own=await network.partsData(dealer,id,'mine','003',0,true);
  assert.equal(own.rows[0].details['custom-size'],undefined);
  assert.equal(own.fields.length,3);
  const snapshot=await network.partsData(dealer,id,'mine','',0,true);
  const removal={...imported,mode:'replace',baseRevision:7,revision:7,removedFieldIds:['location'],extraFields:extraFields.filter(f=>f.id!=='location'),columns:{...columns,details:{notes:3,'custom-size':4}},csv:csv.partsTableCsv(snapshot.rows.map(r=>[r.part_number,String(r.quantity),r.price==null ? '' : String(r.price),r.details.notes || '',r.details['custom-size'] || '']))};
  await assert.rejects(()=>network.importParts(dealer,id,{...removal,mode:'merge',baseRevision:undefined},true),/Reopen/);
  await assert.rejects(()=>network.importParts(dealer,id,{...removal,baseRevision:6},true),/changed/);
  await assert.rejects(()=>network.importParts(dealer,id,{...removal,removedFieldIds:['quantity']},true),/optional columns/);
  await network.importParts(dealer,id,removal,false);
  assert.equal((await network.partsData(dealer,id,'mine','003',0,true)).rows[0].details.location,'Shelf A4');
  await network.importParts(dealer,id,removal,true);
  const afterRemoval=await network.partsData(dealer,id,'mine','',0,true);
  assert.equal(afterRemoval.rows.length,snapshot.rows.length);
  assert.ok(!afterRemoval.fields.some(f=>f.id==='location'));
  assert.ok(afterRemoval.rows.every(r=>!('location' in r.details)));


  await db.close();
});

test("Parts PDF escapes user text and distinguishes zero prices from price on request", () => {
  const { buildPartsStockReportHtml } = load("lib/parts-network-report.ts", {
    './maintenance-report-style': { MAINTENANCE_REPORT_FONT_CSS: '', MAINTENANCE_REPORT_LAYOUT_CSS: '' },
    './report-theme': { REPORT_THEME_CSS: '' },
  });
  const { parseReportPdfRenderRequest } = load('lib/report-pdf-request.ts');
  const row = { part: '001-AB', description: '<script>alert(1)</script>', brand: 'A&B', quantity: 0, price: 0, vat: 'Excl. VAT', dealer: 'Dealer', town: 'George', details: {'<Notes>':'<img src=x onerror=alert(1)>', 'Alternative part number':'00123'} };
  const html = buildPartsStockReportHtml('Parts <list>', [row, {...row, part:'002', price:null}], 'Excl. VAT', 'Complete parts list', '15 Nov 2026');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A&amp;B/);
  assert.match(html, /001-AB/);
  assert.match(html, /&lt;Notes&gt;/);
  assert.ok(!html.includes('<img'));
  assert.match(html, /00123/);
  const branded=buildPartsStockReportHtml('Parts',[], 'Excl. VAT','Complete parts list','16 Nov 2026',{logoUrl:'/owner-logo.png?x=1&y=2'});
  assert.match(branded, /class="assetReportLogo" src="\/owner-logo.png\?x=1&amp;y=2"/);
  assert.ok(!branded.includes('assetReportLogoFallback'));
  assert.match(html, /R\s*0[.,]00/);
  assert.equal((html.match(/Price on request/g) || []).length, 1);
  assert.equal(parseReportPdfRenderRequest(JSON.stringify({html,fileName:'Parts.pdf'})).html, html);
});

test("Excel extra details preserve text identifiers and export column mapping", async () => {
  const {buildPartsWorkbook} = load('lib/parts-network-report.ts', {
    './maintenance-report-style': {MAINTENANCE_REPORT_FONT_CSS:'',MAINTENANCE_REPORT_LAYOUT_CSS:''},
    './report-theme': {REPORT_THEME_CSS:''},
  });
  const book = await buildPartsWorkbook([{part:'001',description:'Seal',brand:'',quantity:2,price:12,vat:'Excl. VAT',dealer:'Dealer',town:'',details:{'Alternative part number':'000012','Notes':'=1+1'}}]);
  const buffer = await book.xlsx.writeBuffer();
  const Excel = require('exceljs');
  const restored = new Excel.Workbook();
  await restored.xlsx.load(buffer);
  const sheet = restored.getWorksheet('Parts');
  assert.equal(sheet.getCell('I2').value,'000012');
  assert.equal(sheet.getCell('J2').value,'=1+1');
  assert.equal(sheet.getCell('I2').numFmt,'@');
  assert.equal(csv.guessPartColumns(sheet.getRow(1).values.slice(1)).price,4);
});

test("Parts PDF uses parts access, full filtered rows, VAT conversion and private responses", async () => {
  let actor = {id:'dealer-1'}, denied = false, renderCalls = 0, requestArgs, reportArgs, actorArgs;
  class PartsError extends Error { constructor(message, status) { super(message); this.status = status; } }
  class Reply extends Response { static json(value, options) { return new Reply(JSON.stringify(value),options); } }
  const { GET } = load('app/api/parts-network/route.ts', {
    'next/server': {NextResponse:Reply},
    '../../../lib/team-access-policy': {TeamAccessError:class extends Error {}},
    '../../../lib/trusted-request-origin': {},
    '../../../lib/parts-network-access': {getPartsActor:async (...args)=>{actorArgs=args;return actor;}},
    '../../../lib/parts-network': {
      PartsError, networkId:value=>value,
      partsReportOwnerId:async (caller,id)=>{assert.equal(caller.id,"dealer-1");assert.equal(id,"list-1");return "list-owner";},
      partsData:async (...args)=>{requestArgs=args;if(denied)throw new PartsError('No access',403);return {rows:[{part_number:'001',quantity:2,price:'100',vat_included:false,business_name:'Dealer',description:'Filter'},{part_number:'002',quantity:0,price:null,vat_included:false,business_name:'Dealer'}]};},
    },
    '../../../lib/parts-network-report': {buildPartsStockReportHtml:(...args)=>{reportArgs=args;return '<html>report</html>';}},
    '../../../lib/report-pdf': {renderReportHtmlToPdf:async()=>{renderCalls++;return Buffer.from('%PDF-1.7');}},
    '../../../lib/asset-registers': {getAssetRegisterReportLogoUrl:async id=>{assert.equal(id,'list-owner');return '/owner-logo.png';}},
    '../../../lib/report-logo': {resolveReportLogoUrlForHtml:async logo=>{assert.equal(logo,'/owner-logo.png');return 'data:image/png;base64,OWNER';}},
    '../../../lib/report-pdf-request': load('lib/report-pdf-request.ts'),
  });
  const url = new URL('https://example.test/api/parts-network?network=list-1&view=mine&format=pdf&vat=incl&search=Filter&title=Landini&desktopMembershipId=team-1');
  const request = {nextUrl:url,url:url.href,headers:new Headers()};
  const response = await GET(request);
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/application\/pdf/);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  assert.deepEqual(actorArgs,[false,'team-1']);
  assert.deepEqual(requestArgs,[actor,'list-1','mine','Filter',0,true]);
  assert.equal(reportArgs[1][0].part,'001');
  assert.equal(reportArgs[1][0].price,115);
  assert.equal(reportArgs[1][1].price,null);
  assert.equal(reportArgs[2],'Incl. VAT');
  assert.deepEqual(reportArgs[5],{logoUrl:'data:image/png;base64,OWNER'});
  denied=true;
  assert.equal((await GET(request)).status,403);
  actor=null;
  assert.equal((await GET(request)).status,403);
  assert.equal(renderCalls,1,'Unauthorized requests never render a report');
});

test('Import matches only recognisable headings and keeps unknown columns for a decision', () => {
  const mapping = load('lib/parts-import-mapping.ts', {'./parts-network-csv': csv});
  const detected = mapping.inspectPartsTable([
    ['Description','Qty','Part number','Notes','Bin / shelf location','Supplier'],
    ['Dowel','16','000123','Keep dry','A2','Example'],
  ], []);
  assert.equal(detected.hasHeader, true);
  assert.deepEqual(detected.mapping, ['description','quantity','partNumber','detail:notes','detail:location','']);
  assert.equal(detected.addedFields.find(f=>f.id==='location').private, true);
  assert.deepEqual(mapping.mappedPartColumns(detected.mapping), {partNumber:2,description:0,quantity:1,price:-1,brand:-1,details:{notes:3,location:4}});
  assert.deepEqual(mapping.inspectPartsTable([['000123','Dowel','16']], []).mapping, ['','','']);
  const duplicate = mapping.inspectPartsTable([['Part number','Qty','Qty'],['001','2','3']], []);
  assert.deepEqual(duplicate.mapping, ['partNumber','quantity','']);
  assert.throws(()=>mapping.mappedPartColumns(['quantity','quantity']));
  assert.equal(mapping.columnLetter(26), 'AA');
  assert.equal(mapping.columnLetter(99), 'CV');
});

test('Import includes late populated columns and recognises headers without quantity', () => {
  const mapping = load('lib/parts-import-mapping.ts', {'./parts-network-csv': csv});
  const table = Array.from({length:101},()=>['001','1']);
  table.push(['002','2','Do not lose this']);
  assert.equal(mapping.inspectPartsTable(table, []).mapping.length,3);
  assert.deepEqual(mapping.inspectPartsTable([['Part number','Something else'],['001','1']], []).mapping,['partNumber','']);
  assert.throws(()=>mapping.inspectPartsTable([Array(101).fill('x')],[]));
  assert.throws(()=>mapping.inspectPartsTable([['','']],[]));
});
