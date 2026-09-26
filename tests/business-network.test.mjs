import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
function load(path, stubs = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
    filename: path,
  })(
    (name) => (name in stubs ? stubs[name] : require(name)),
    module,
    module.exports,
  );
  return module.exports;
}
const shared = load("lib/business-network-shared.ts");
test("validates business details, legacy metadata, safe URLs and service coverage", () => {
  const b = shared.validateBusinessDetails(
    {
      name: "Workshop",
      town: "George",
      latitude: -33.96,
      longitude: 22.46,
      radiusKm: 100,
      nationwide: false,
      headings: ["Mechanic", "Tractor dealer"],
      services: ["Brakes", "Electrical"],
      website: "example.com",
    },
    "service@example.com",
  );
  const untagged = shared.validateBusinessDetails({ ...b, headings: undefined, services: undefined }, b.email);
  assert.equal(untagged.headings.length, 0);
  assert.equal(untagged.services.length, 0);
  assert.equal(b.headings.length, 2);
  assert.equal(b.services.length, 2);
  assert.equal(shared.businessCoversLocation(b, -33.95, 22.47), true);
  assert.equal(shared.businessCoversLocation(b, -26.2, 28), false);
  assert.equal(
    shared.businessCoversLocation({ ...b, nationwide: true }, -26.2, 28),
    true,
  );
  assert.throws(
    () => shared.validateBusinessDetails({ ...b, latitude: "" }, b.email),
    /location/,
  );
  assert.throws(
    () => shared.validateBusinessDetails({ ...b, radiusKm: 0 }, b.email),
    /distance/,
  );
  assert.throws(() =>
    shared.businessEmail("a@example.com\r\nBcc: bad@example.com"),
  );
  assert.throws(() =>
    shared.businessUrl("https://google.com.evil.test/maps", true),
  );
  assert.throws(() => shared.businessUrl("https://user:password@example.com"));
});
test("business lifecycle and request access use actual PostgreSQL constraints", async () => {
  const db = new PGlite();
  const sent = [];
  let failEmail = false;
  const owner = { id: "owner-one", email: "owner@example.com", name: "Owner" };
  const assetId = "11111111-1111-4111-8111-111111111111",
    asset2 = "22222222-2222-4222-8222-222222222222";
  const asset = {
    id: assetId,
    title: "Tractor",
    brandName: "Brand",
    modelName: "Model",
    yearModel: 2020,
    hours: 100,
    condition: "good",
    serialNumber: "ABC",
    licenseRegistrationNumber: "CA1",
    selectedValueExVat: 200000,
    value: 200000,
    photos: ["/api/asset-register/uploads/photo-one"],
    specsJson: { secret: "hidden" },
    documents: [{ url: "private-report.pdf" }],
  };
  const network = load("lib/business-network.ts", {
    "./business-network-shared": shared,
    "./db": {
      getDb: () => ({
        query: async (sql, params) =>
          params ? db.query(sql, params) : (await db.exec(sql)).at(-1),
      }),
    },
    "./email": {
      getSiteOrigin: () => "https://aim4price.test",
      sendAim4priceEmail: async (mail) => {
        if (failEmail) throw new Error("Delivery failed");
        sent.push(mail);
      },
    },
    "./account-profile": {
      getAccountProfile: async () => ({
        name: "Owner",
        businessName: "Farm",
        phone: "0123456789",
        marketplaceEmail: "owner@example.com",
      }),
    },
    "./asset-register-db": {
      getAssetRegisterItemById: async (user, id) =>
        user === owner.id && [assetId, asset2].includes(id)
          ? { ...asset, id }
          : null,
    },
    "./asset-groups": {
      getAssetGroupById: async (user, id) =>
        user === owner.id && id === "group-one"
          ? { members: [{ assetId }, { assetId: asset2 }] }
          : null,
    },
  });
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "test-only";
  try {
    await network.inviteBusiness(owner.id, "Workshop", "service@example.com");
    assert.equal(
      (await network.listExternalBusinesses({ partnerType: "dealer" })).length,
      0,
      "invited businesses must be hidden",
    );
    const token = sent.at(-1).text.match(/#([a-f0-9]{64})/)[1];
    const b = await network.getBusinessByToken(token);
    const details = {
      name: "Workshop",
      town: "George",
      latitude: -33.96,
      longitude: 22.46,
      radiusKm: 100,
      nationwide: false,
      headings: ["Mechanic", "Tractor dealer"],
      services: ["Brakes", "Electrical"],
      accepted: true,
      googlePlaceId: "google-123",
    };
    await assert.rejects(
      network.saveBusiness(token, { ...details, accepted: false }),
      /Confirm/,
    );
    await network.saveBusiness(token, details);
    assert.equal((await network.listExternalBusinesses({})).length, 0, 'acceptance alone must not publish');
    const manualAdmin = load('lib/admin-business-network.ts', {'./db': {getDb: () => ({query: async (sql,params)=>params?db.query(sql,params):(await db.exec(sql)).at(-1)})}, './business-network': network, './business-network-shared': shared});
    await manualAdmin.saveAdminBusiness('admin', {id:b.id,action:'publish'});
    const directory = await network.listExternalBusinesses({
      partnerType: "dealer",
      latitude: -33.95,
      longitude: 22.47,
    });
    assert.equal(directory.length, 1);
    assert.equal(directory[0].isExternalBusiness, true);
    assert.equal((await network.listExternalBusinesses({ search: 'Workshop' })).length, 1);
    assert.equal((await network.listExternalBusinesses({ search: 'Brakes' })).length, 0, 'Lookup matches business names, not service tags');

    assert.equal(
      (
        await network.listExternalBusinesses({
          partnerType: "finance",
        })
      ).length,
      1,
      'Legacy headings must not prevent sharing through another request type',
    );
    assert.equal(
      (
        await network.listExternalBusinesses({
          partnerType: "dealer",
          latitude: -26.2,
          longitude: 28,
        })
      ).length,
      0,
    );
    const input = {
      assetId,
      partnerUserId: directory[0].userId,
      ownerMessage: "Oil leak <script>alert(1)</script>",
      additionalContact: "Call Sam",
      requestKey: "33333333-3333-4333-8333-333333333333",
      includedSections: {
        photos: true,
        valuationSummary: true,
        documents: true,
        liveAccess: true,
        registerSnapshot: { secret: "private" },
      },
    };
    const preview = await network.buildBusinessLeadView(owner, input);
    assert.equal(preview.view.contact.additional, "Call Sam");
    assert.equal(preview.view.assets[0].photos.length, 1);
    assert.ok(!JSON.stringify(preview.view).includes("private-report"));
    assert.ok(!JSON.stringify(preview.view).includes("secret"));
    await assert.rejects(
      network.buildBusinessLeadView({ ...owner, id: "other-owner" }, input),
      /does not belong/,
    );
    await assert.rejects(
      network.buildBusinessLeadView(owner, {
        ...input,
        assetIds: [assetId, asset2],
      }),
      /umbrella/,
    );
    await assert.rejects(
      network.buildBusinessLeadView(owner, {
        ...input,
        assetIds: [assetId, asset2],
        assetGroupId: "wrong",
      }),
      /umbrella/,
    );
    const umbrella = await network.buildBusinessLeadView(owner, {
      ...input,
      assetIds: [assetId, asset2],
      assetGroupId: "group-one",
    });
    assert.equal(umbrella.view.assets.length, 2);
    const emailCount = sent.length;
    await network.sendBusinessLead(owner, input);
    await network.sendBusinessLead(owner, input);
    assert.equal(
      sent.length,
      emailCount + 1,
      "repeated send must not duplicate email",
    );
    assert.equal(sent.at(-1).replyTo, "owner@example.com");
    assert.ok(!sent.at(-1).html.includes("<script>"));
    const requestToken = sent.at(-1).text.match(/#([a-f0-9]{64})/)[1];
    assert.equal(
      (await network.getBusinessRequest(requestToken)).assets[0].title,
      "Tractor",
    );
    await assert.rejects(
      network.getBusinessRequest(token),
      /unavailable/,
      "management token must not open requests",
    );
    await assert.rejects(
      network.getBusinessByToken(requestToken),
      /invalid/,
      "request token must not manage listings",
    );
    const requestRow = (
      await db.query(
        "select id from business_network_requests where request_key=$1",
        [input.requestKey],
      )
    ).rows[0];
    await assert.rejects(
      network.revokeBusinessRequest("other-owner", requestRow.id),
      /unavailable/,
    );
    assert.equal(
      (await network.getBusinessRequest(requestToken)).assets.length,
      1,
    );
    assert.equal(
      network.BUSINESS_SCHEMA.trim(),
      readFileSync(
        new URL(
          "../database/migrations/102-business-network.sql",
          import.meta.url,
        ),
        "utf8",
      ).trim(),
    );
    const stored = await db.query(
      "select token_hash,snapshot from business_network_requests",
    );
    assert.notEqual(stored.rows[0].token_hash, requestToken);
    await db.query(
      "update business_network_requests set expires_at=now()-interval '1 day'",
    );
    await assert.rejects(network.getBusinessRequest(requestToken), /expired/);
    await db.query(
      "update business_network_requests set expires_at=now()+interval '1 day'",
    );
    failEmail = true;
    await assert.rejects(
      network.sendBusinessLead(owner, {
        ...input,
        requestKey: "44444444-4444-4444-8444-444444444444",
      }),
      /Delivery failed/,
    );
    assert.equal(
      (
        await db.query(
          "select status from business_network_requests where request_key='44444444-4444-4444-8444-444444444444'",
        )
      ).rows[0].status,
      "failed",
    );
    failEmail = false;
    await network.saveBusiness(token, { action: "pause" });
    assert.equal((await network.listExternalBusinesses({})).length, 0);
    assert.ok(await network.getBusinessRequest(requestToken), 'hiding a listing preserves existing enquiries');
    await assert.rejects(network.sendBusinessLead(owner, input), /no longer/);
    await network.saveBusiness(token, details);
    assert.equal((await network.listExternalBusinesses({})).length,0,'editing a hidden listing does not republish it');
    await manualAdmin.saveAdminBusiness('admin', {id:b.id,action:'publish'});
    assert.ok(await network.getBusinessRequest(requestToken), 'directory visibility is separate from enquiry access');
    await network.limitBusinessAction("test-limit", 1);
    await assert.rejects(
      network.limitBusinessAction("test-limit", 1),
      /Too many/,
    );
  } finally {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldKey;
    await db.close();
  }
});

test("invitation actions require an active owner or an admin and reject foreign origins", async () => {
  let user = null;
  let profile = { accountType: "owner", accountStatus: "active" };
  const api = load("lib/business-network-api.ts", {
    "./trusted-request-origin": load("lib/trusted-request-origin.ts"),
    "./auth-session": {
      getServerSession: async (options) => {
        assert.equal(options.allowAdmin, true);
        return user ? { user } : null;
      },
    },
    "./account-profile": { getAccountProfile: async () => profile },
    "./account-constants": {
      isAim4priceAdminEmail: (email) => email === "admin@example.com",
    },
  });
  await assert.rejects(api.requireBusinessOwner(), /login/);
  user = { id: "owner", email: "owner@example.com" };
  assert.equal((await api.requireBusinessOwner()).id, "owner");
  profile = { accountType: "owner", accountStatus: "suspended" };
  await assert.rejects(api.requireBusinessOwner(), /active owner/);
  profile = { accountType: "dealer", accountStatus: "active" };
  await assert.rejects(api.requireBusinessOwner(), /active owner/);
  user = { id: "admin", email: "admin@example.com" };
  assert.equal((await api.requireBusinessOwner()).id, "admin");
  const { NextRequest } = require("next/server");
  assert.throws(
    () =>
      api.requireBusinessOrigin(
        new NextRequest("https://aim4price.test/api/business-network/invite", {
          headers: { origin: "https://evil.test" },
        }),
      ),
    /from Aim4price/,
  );
  assert.doesNotThrow(() =>
    api.requireBusinessOrigin(
      new NextRequest("https://aim4price.test/api/business-network/invite", {
        headers: { origin: "https://aim4price.test" },
      }),
    ),
  );
});

test("admin drafts require explicit publication before appearing in the directory", async () => {
  const db = new PGlite();
  const adapter = {
    query: async (sql, params) =>
      params ? db.query(sql, params) : (await db.exec(sql)).at(-1),
  };
  const network = load("lib/business-network.ts", {
    "./business-network-shared": shared,
    "./db": { getDb: () => adapter },
    "./email": {},
    "./account-profile": {},
    "./asset-register-db": {},
  });
  const admin = load("lib/admin-business-network.ts", {
    "./business-network-shared": shared,
    "./db": { getDb: () => adapter },
    "./business-network": network,
  });
  try {
    const input = {
      name: "Manual Workshop",
      email: "manual@example.com",
      town: "George",
      latitude: -33.96,
      longitude: 22.46,
      radiusKm: 100,
      googlePlaceId: "manual-place",
      googleMapsUrl: "https://www.google.com/maps?query_place_id=manual-place",
    };
    const id = await admin.saveAdminBusiness("admin-one", input);
    const row = (
      await db.query("select * from business_network where id=$1", [id])
    ).rows[0];
    assert.equal(row.status, "invited");
    assert.equal(row.accepted_at, null);
    assert.equal(row.invited_by, "admin-one");
    assert.equal(
      (await db.query("select * from business_network_tokens")).rows.length,
      0,
    );
    assert.equal(
      (await network.listExternalBusinesses({ partnerType: "dealer" })).length,
      0,
    );
    await assert.rejects(
      () => admin.saveAdminBusiness("admin-one", input),
      /already listed/,
    );
    // Drafts may reference the same Google place; publication remains unique.
    const duplicateDraft = await admin.saveAdminBusiness("admin-one", {...input, email: "another@example.com"});
    assert.equal((await network.listExternalBusinesses({partnerType:"dealer"})).length, 0);
    await db.query("delete from business_network_admin_actions where business_id=$1", [duplicateDraft]);
    await db.query("delete from business_network where id=$1", [duplicateDraft]);
    await assert.rejects(
      () =>
        admin.saveAdminBusiness("admin-one", {
          ...input,
          email: "third@example.com",
          googlePlaceId: "",
          latitude: "",
        }),
      /location/,
    );
    await assert.rejects(
      () =>
        admin.saveAdminBusiness("admin-one", {
          ...input,
          id,
          email: "redirect@example.com",
        }),
      /cannot be changed/,
    );
    await admin.saveAdminBusiness("admin-two", {
      ...input,
      id,
      name: "Updated Workshop",
    });
    assert.equal(
      (await admin.listAdminBusinesses())[0].name,
      "Updated Workshop",
    );
    assert.equal((await admin.listAdminBusinesses())[0].status, "invited");
    await admin.saveAdminBusiness('admin-two',{id,action:'publish'});
    assert.equal((await db.query("select count(*)::int as n from business_network_tokens")).rows[0].n,0,'manual publishing needs no invitation');
    assert.equal((await network.listExternalBusinesses({ partnerType: "dealer" })).length, 1);
    await db.query(
      `insert into business_network_requests(id,owner_id,business_id,request_key,token_hash,snapshot,status,expires_at) values($1,'owner',$2,'key','hash','{}','sent',now()+interval '1 day')`,
      ["33333333-3333-4333-8333-333333333333", id],
    );
    await admin.saveAdminBusiness("admin-two", { id, action: "pause" });
    assert.equal(
      (await network.listExternalBusinesses({ partnerType: "dealer" })).length,
      0,
    );
    assert.equal(
      (await db.query("select revoked_at from business_network_requests"))
        .rows[0].revoked_at, null,
    );
    assert.deepEqual(
      (
        await db.query(
          "select action from business_network_admin_actions order by created_at",
        )
      ).rows.map((r) => r.action),
      ["create", "update", "manually_approve_publish", "pause"],
    );
    // Admin can publish in the same atomic save, with no Google profile or invite.
    const direct = await admin.saveAdminBusiness('admin-one', {...input, email:'direct@example.com', googlePlaceId:'', googleMapsUrl:'', action:'save_publish'});
    assert.equal((await db.query('select status from business_network where id=$1',[direct])).rows[0].status,'active');
    assert.equal((await network.listExternalBusinesses({partnerType:'dealer'})).length,1);
    assert.equal((await db.query('select count(*)::int as n from business_network_tokens')).rows[0].n,0);
    await admin.saveAdminBusiness('admin-one', {...input,id,action:'save_publish',name:'Republished Workshop'});
    assert.equal((await db.query('select name,status from business_network where id=$1',[id])).rows[0].name,'Republished Workshop');
    assert.equal((await network.listExternalBusinesses({partnerType:'dealer'})).length,2);
    await assert.rejects(admin.saveAdminBusiness('admin-one',{...input,email:'conflict@example.com',action:'save_publish'}),/already listed/);
    assert.equal((await db.query("select count(*)::int as n from business_network where email='conflict@example.com'")).rows[0].n,0,'failed publish leaves no partial draft');
    assert.deepEqual((await db.query("select action from business_network_admin_actions where action like '%and_publish' order by created_at")).rows.map(r=>r.action),['create_and_publish','update_and_publish']);
  } finally {
    await db.close();
  }
});

test("manual business API refuses non-admin callers and cross-origin writes", async () => {
  let session = null,
    writes = 0;
  const route = load("app/api/admin/business-network/route.ts", {
    "../../../../lib/trusted-request-origin": load("lib/trusted-request-origin.ts"),
    "next/server": {},
    "../../../../lib/auth-session": {
      getAnyServerSession: async () => session,
    },
    "../../../../lib/account-constants": {
      isAim4priceAdminEmail: (email) => email === "admin@example.com",
    },
    "../../../../lib/admin-business-network": {
      listAdminBusinesses: async () => [],
      saveAdminBusiness: async () => {
        writes++;
        return "id";
      },
    },
    "../../../../lib/business-network-api": {
      businessJson: (body, status = 200) => ({ body, status }),
      businessError: () => ({ status: 400 }),
      businessBody: async () => ({}),
      requireBusinessOrigin: (r) => {
        if (r.headers.get("origin") !== "https://aim4price.test")
          throw Error("origin");
      },
    },
  });
  const request = {
    url: "http://internal:3000/api/admin/business-network",
    headers: new Headers({ origin: "https://aim4price.com" }),
  };
  assert.equal((await route.POST(request)).status, 403);
  session = { user: { id: "owner", email: "owner@example.com" } };
  assert.equal((await route.GET()).status, 403);
  assert.equal((await route.POST(request)).status, 403);
  session = { user: { id: "admin", email: "admin@example.com" } };
  assert.equal(
    (
      await route.POST({
        url: "http://internal:3000/api/admin/business-network",
        headers: new Headers({ origin: "https://other.test" }),
      })
    ).status,
    403,
  );
  assert.equal(writes, 0);
  assert.equal((await route.POST(request)).status, 200);
  assert.equal(writes, 1);
});


test('Google lookup accepts public origins through a proxy, searches real endpoint and rejects foreign origins', async () => {
  const oldEnv = process.env.NODE_ENV, oldKey = process.env.GOOGLE_PLACES_API_KEY, originalFetch = globalThis.fetch;
  process.env.NODE_ENV = 'production'; process.env.GOOGLE_PLACES_API_KEY = 'test-key';
  let session = {user:{id:'admin',email:'admin@example.com'}}, calls = 0;
  const api = load('lib/business-network-api.ts', {
    './trusted-request-origin':load('lib/trusted-request-origin.ts'), './auth-session':{getServerSession:async()=>session}, './account-profile':{getAccountProfile:async()=>({accountType:'owner',accountStatus:'active'})}, './account-constants':{isAim4priceAdminEmail:e=>e==='admin@example.com'},
  });
  const route = load('app/api/business-network/google/route.ts', {
    '../../../../lib/auth-session':{getAnyServerSession:async()=>session},
    '../../../../lib/account-constants':{isAim4priceAdminEmail:e=>e==='admin@example.com'},
    '../../../../lib/business-network':{limitBusinessAction:async()=>{},getBusinessByToken:async()=>{throw new Error('This token is invalid.')}},
    '../../../../lib/business-network-api':api, '../../../../lib/business-network-shared':shared,
  });
  const {NextRequest}=require('next/server');
  const request = (origin, body={query:'S Haddad George'}) => new NextRequest('http://internal.railway:3000/api/business-network/google',{method:'POST',headers:{...(origin?{origin}:{}),'content-type':'application/json','x-forwarded-host':'evil.test'},body:JSON.stringify(body)});
  globalThis.fetch=async(url,options)=>{
    calls++;assert.equal(url,'https://places.googleapis.com/v1/places:searchText');
    assert.equal(JSON.parse(options.body).textQuery,'S Haddad George');assert.equal(options.headers['X-Goog-Api-Key'],'test-key');
    return Response.json({places:[{id:'place-1',displayName:{text:'S Haddad'},formattedAddress:'George'}]});
  };
  try {
    for(const origin of ['https://aim4price.com','https://www.aim4price.com']) {
      const response=await route.POST(request(origin)); assert.equal(response.status,200); assert.equal((await response.json()).places[0].id,'place-1');
    }
    for(const origin of ['https://evil.test','null',undefined,'https://aim4price.com.evil.test'])assert.notEqual((await route.POST(request(origin))).status,200);
    assert.equal(calls,2,'untrusted origins never reach Google');
    globalThis.fetch=async(url,options)=>{
      calls++;assert.equal(url,'https://places.googleapis.com/v1/places/place-1');
      assert.equal(options.cache,'no-store');assert.match(options.headers['X-Goog-FieldMask'],/nationalPhoneNumber/);
      assert.ok(!options.headers['X-Goog-FieldMask'].includes('photos'));
      return Response.json({id:'place-1',displayName:{text:'Workshop'},location:{latitude:-33.9,longitude:22.4}});
    };
    const detail=await route.POST(request('https://aim4price.com',{placeId:'place-1'}));
    assert.equal(detail.status,200);assert.match(detail.headers.get('cache-control'),/no-store/);
    assert.equal((await detail.json()).place.displayName.text,'Workshop');
    for(const placeId of ['../secrets','https://evil.test','', 'place-1?key=bad']) assert.equal((await route.POST(request('https://aim4price.com',{placeId}))).status,400);
    assert.equal(calls,3);
    globalThis.fetch=async()=>new Response('',{status:503});
    const failed=await route.POST(request('https://aim4price.com',{placeId:'place-1'}));
    assert.equal(failed.status,400);assert.match((await failed.json()).error,/manually/);
    session={user:{id:'owner',email:'owner@example.com'}};
    globalThis.fetch=async()=>Response.json({places:[]});
    assert.equal((await route.POST(request('https://aim4price.com'))).status,200,'active owners can search for a recipient');
    session=null; assert.equal((await route.POST(request('https://aim4price.com'))).status,403);assert.equal(calls,3);
    session={user:{id:'admin',email:'admin@example.com'}};delete process.env.GOOGLE_PLACES_API_KEY;
    const unavailable=await route.POST(request('https://aim4price.com'));assert.equal(unavailable.status,503);assert.match((await unavailable.json()).error,/not configured/);
  } finally {
    globalThis.fetch=originalFetch;
    if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;
    if(oldKey===undefined)delete process.env.GOOGLE_PLACES_API_KEY;else process.env.GOOGLE_PLACES_API_KEY=oldKey;
  }
});


test('Google suggestions require independent confirmation before saving', () => {
  assert.throws(() => shared.validateBusinessDetails({googleDetailsUsed:true,detailsVerified:false}, 'business@example.com'), /Confirm the listing details/);
});
