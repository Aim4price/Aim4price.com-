/* Real Parts client, synthetic read-only APIs; no deployment credentials needed. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const ts = require("typescript"),
  postcss = require("postcss"),
  puppeteer = require("puppeteer-core"),
  chromium = require("@sparticuz/chromium");
const root = path.resolve(__dirname, ".."),
  modules = {},
  sheets = [];
let cssIndex = 0;
const stubs = {
  "components/useWebsiteStyles":
    "exports.useWebsiteStyles=(native,website)=>window.compact?native:website;",
  "components/WebsitePortal":
    'exports.createPortal=(children)=>ReactDOM.createPortal(children,document.getElementById("aim4price-website-overlays"));',
  "components/DropdownOverlay": "exports.default=()=>null;",
  "app/asset-discovery/recently-advertised-client": "exports.default=()=>null;",
};
function cssModule(file) {
  const prefix = "c" + cssIndex++ + "_",
    map = {},
    sheet = postcss.parse(fs.readFileSync(path.join(root, file), "utf8"));
  sheet.walkRules((rule) => {
    const globals = [];
    let selector = rule.selector;
    while (selector.includes(":global(")) {
      const start = selector.indexOf(":global(");
      let end = start + 8,
        depth = 1;
      for (; depth && end < selector.length; end++) {
        if (selector[end] === "(") depth++;
        else if (selector[end] === ")") depth--;
      }
      const token = "GLOBALTOKEN" + globals.length;
      globals.push(selector.slice(start + 8, end - 1));
      selector = selector.slice(0, start) + token + selector.slice(end);
    }
    selector = selector.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => {
      map[name] = prefix + name;
      return "." + prefix + name;
    });
    globals.forEach((value, index) => {
      selector = selector.replace("GLOBALTOKEN" + index, value);
    });
    rule.selector = selector;
  });
  sheets.push(sheet.toString());
  modules[file] = "module.exports=" + JSON.stringify(map);
}
function add(file) {
  if (Object.hasOwn(modules, file)) return;
  if (file.endsWith(".css")) {
    cssModule(file);
    return;
  }
  if (stubs[file]) {
    modules[file] = stubs[file];
    return;
  }
  const filename = [".tsx", ".ts", ""]
    .map((ext) => path.join(root, file + ext))
    .find(fs.existsSync);
  if (!filename) throw Error("Missing module " + file);
  modules[file] = "";
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  modules[file] = code.replace(
    /require\(["']([^"']+)["']\)/g,
    (match, name) => {
      if (!name.startsWith(".")) return match;
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(file), name),
      );
      add(resolved);
      return "require(" + JSON.stringify(resolved) + ")";
    },
  );
}
const entry = "app/dealer/parts/parts-client";
add(entry);
add("app/parts/join/join-client");
const react = fs.readFileSync(
  path.join(
    path.dirname(require.resolve("react/package.json")),
    "umd/react.production.min.js",
  ),
  "utf8",
);
const reactDOM = fs.readFileSync(
  path.join(
    path.dirname(require.resolve("react-dom/package.json")),
    "umd/react-dom.production.min.js",
  ),
  "utf8",
);
const appCode =
  "const sources=" +
  JSON.stringify(modules) +
  ",cache={};" +
  'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}' +
  "const Component=require(location.pathname === '/parts/join' ? 'app/parts/join/join-client' : " +
  JSON.stringify(entry) +
  ').default;ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(Component,{website:true,listId:location.pathname.split("/")[2]||""}));';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: true,
    pipe: true,
  });
  try {
    const page = await browser.newPage(),
      errors = [],
      actions = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    let emptyFixture = false;
    const network = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Landini parts",
      owned: true,
      list_mode: true,
      part_count: 1,
      last_updated: new Date().toISOString(),
      status: "active",
      role: "admin",
      visible: true,
      revision: 1,
      owner_business_name: "Example Agricultural",
      owner_town: "George",
      owner_vat_included: false,
      owner_uploaded_at: new Date().toISOString(),
      business_name: "Example Agricultural",
      town: "George",
      phone: "0821234567",
      email: "parts@example.test",
      vat_included: false,
    };
    const row = {
      dealer_id: "a",
      part_number: "001-ABC",
      quantity: 3,
      price: "850.00",
      business_name: "Example Agricultural",
      town: "George",
      phone: "0821234567",
      email: "parts@example.test",
      vat_included: false,
      uploaded_at: new Date().toISOString(),
    };
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      if (r.url().includes("/api/parts-network")) {
        const url = new URL(r.url());
        let data;
        if (url.searchParams.has("token")) return r.respond({status:401,contentType:"application/json",body:JSON.stringify({error:"Sign in required"})});
        if (r.method() === "POST") {
          const b = JSON.parse(r.postData());
          actions.push(b);
          data =
            b.action === "preview"
              ? {
                  revision: 1,
                  summary: { added: 1, updated: 1, removed: 1, total: 2 },
                }
              : b.action === "invite"
                ? { url: "https://example.test/parts/join?token=example" }
                : { ok: true };
        } else if (!url.search)
          data = {
            networks: [
              network,
              {
                ...network,
                id: "22222222-2222-4222-8222-222222222222",
                name: "John Deere parts",
              },
              {
                ...network,
                id: "33333333-3333-4333-8333-333333333333",
                name: "Second-hand parts",
              },
              {
                ...network,
                id: "44444444-4444-4444-8444-444444444444",
                name: "Shared dealer parts",
                owned: false,
                role: "viewer",
              },
            ],
            staff: false,
            canContribute: true,
          };
        else if (url.searchParams.get("view") === "inbox")
          data = { invitations: [], enquiries: [], shared: [] };
        else if (url.searchParams.get("view") === "members")
          data = {
            members: [
              { ...network, dealer_id: "a" },
              {
                ...network,
                dealer_id: "b",
                role: "viewer",
                email: "buyer@example.test",
              },
            ],
            invites: [],
          };
        else data = emptyFixture || url.searchParams.get("search") === "not-found" ? { rows: [], total: 0 } : { rows: [row], total: 1 };
        return r.respond({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      }
      return r.respond({
        contentType: "text/html",
        body: '<html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eef4f0}' + sheets.join("\n") + '</style></head><body><div id="app"></div><script>' + react + '</script><script>' + reactDOM + '</script><script>' + appCode.replace(/<\/script/gi, '<\\/script') + '</script></body></html>',
      });
    });
    await page.goto("https://example.test/parts");
    await page.waitForSelector("article");
    assert.ok(
      await page.$eval("h1", (e) =>
        e.textContent.includes("Parts Management System"),
      ),
    );
    const cards = await page.$$eval("article", (nodes) =>
      nodes.map((n) => ({
        x: n.getBoundingClientRect().x,
        width: n.getBoundingClientRect().width,
      })),
    );
    assert.ok(
      cards.length >= 3 &&
        cards.every((c) => c.width > 1000 && c.x === cards[0].x),
      "Parts lists use full-width Leads-style cards",
    );
    await page.type('input[aria-label="Search parts lists"]', "John Deere");
    await page.waitForFunction(
      () => document.querySelectorAll("article").length === 1,
    );
    assert.ok(
      await page.$eval("article", (e) => e.textContent.includes("John Deere")),
    );
    await page.click('input[aria-label="Search parts lists"]', {
      clickCount: 3,
    });
    await page.keyboard.press("Backspace");
    await page.waitForFunction(
      () => document.querySelectorAll("article").length === 4,
    );

    const click = async (text) => {
      await page.waitForFunction(t => [...document.querySelectorAll("button")].some(b => (b.textContent.trim() === t || b.querySelector("strong")?.textContent.trim() === t) && !b.disabled), {}, text);
      const navigation = ["Open", "Back to Parts"].includes(text) ? page.waitForNavigation({waitUntil:"domcontentloaded"}) : null;
      assert.ok(
        await page.evaluate((t) => {
          const b = [...document.querySelectorAll("button")].find(
            (b) =>
              (b.textContent.trim() === t ||
                b.querySelector("strong")?.textContent.trim() === t) &&
              !b.disabled,
          );
          if (!b || b.disabled) return false;
          b.click();
          return true;
        }, text),
        text,
      );
      if (navigation) await navigation;
    };
    const output = path.join(root, ".next/parts-network-validation");
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "lists-desktop.png") });
    assert.ok(
      !(await page.evaluate(() => document.body.innerText.includes("network"))),
    );
    await click("Add parts list");
    await page.waitForSelector('[role="dialog"]');
    assert.ok(
      await page.evaluate(() =>
        document.body.innerText.includes("Second-hand parts"),
      ),
    );
    await page.keyboard.press("Escape");
    await click("Share");
    await page.waitForSelector('[role="dialog"]');
    assert.ok(
      await page.evaluate(
        () =>
          document.body.innerText.includes("Inside Aim4price") &&
          document.body.innerText.includes("Send link"),
      ),
    );
    await page.screenshot({
      path: path.join(output, "share-destinations.png"),
    });
    await page.keyboard.press("Escape");
    await click("Open");
    await page.waitForSelector("tbody tr");
    assert.ok(page.url().endsWith("/parts/11111111-1111-4111-8111-111111111111"));
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForSelector("tbody tr");
    assert.equal(await page.$$eval("table", (e) => e.length), 1);
    await page.screenshot({ path: path.join(output, "table-desktop.png") });
    assert.equal(await page.$$eval("thead th", cells => cells.length), 4);
    assert.ok(!(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Next"))));
    await page.type('input[aria-label="Search part number"]', "not-found");
    await page.waitForFunction(() => document.body.innerText.includes("No matching parts"));
    await click("Clear search");
    await page.waitForSelector("tbody tr");
    await click("Contact");
    await page.waitForSelector("[role=dialog]");
    assert.equal(
      await page.$eval('a[href^="tel:"]', (e) => e.getAttribute("href")),
      "tel:0821234567",
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
    await click("Upload CSV");
    await page.waitForSelector("input[type=file]");
    const file = path.join(output, "fixture.csv");
    fs.writeFileSync(
      file,
      "Part number,Quantity,Price\n001-ABC,2,850\n002-XYZ,1,100",
    );
    await (await page.$("input[type=file]")).uploadFile(file);
    await page.waitForFunction(() =>
      document.body.innerText.includes("Review upload"),
    );
    await click("Review upload");
    await page.waitForFunction(() =>
      document.body.innerText.includes("Replace my parts list"),
    );
    await page.screenshot({ path: path.join(output, "upload-review.png") });
    await click("Replace my parts list");
    await page.waitForFunction(() =>
      document.body.innerText.includes("Parts list replaced successfully."),
    );
    assert.equal(actions.find((a) => a.action === "import").revision, 1);
    await click("Manage");
    await page.waitForSelector("[role=dialog]");
    assert.ok(
      await page.evaluate(
        () =>
          document.body.innerText.includes("Rename list") &&
          document.body.innerText.includes("Delete list"),
      ),
    );
    await page.screenshot({ path: path.join(output, "manage-parts.png") });
    await page.setViewport({ width: 390, height: 844 });
    assert.ok(
      await page.$eval(
        "[role=dialog]",
        (e) => e.getBoundingClientRect().width <= 390,
      ),
    );
    await page.screenshot({ path: path.join(output, "manage-mobile.png") });
    await page.setViewport({ width: 1440, height: 1000 });
    await click("Rename list");
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role="dialog"]')
          ?.getAttribute("aria-label") === "Rename parts list",
    );
    await click("Back");
    await click("Sharing & access");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent === "Suspend",
      ),
    );
    await click("Suspend");
    await page.waitForSelector("[role=dialog]");
    await page.keyboard.press("Escape");
    assert.ok(
      !actions.some((a) => a.action === "member"),
      "cancel does not change membership",
    );
    await click("View parts");
    await page.setViewport({ width: 390, height: 844 });
    await page.waitForSelector("tbody tr");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "only table scrolls on phones",
    );
    await page.screenshot({ path: path.join(output, "table-phone.png") });
    await click("Upload CSV");
    await page.waitForSelector("[role=dialog]");
    assert.ok(
      await page.$eval(
        "[role=dialog]",
        (e) => e.getBoundingClientRect().right <= innerWidth,
      ),
    );
    await page.screenshot({ path: path.join(output, "upload-phone.png") });
    await page.keyboard.press("Escape");
    await page.addStyleTag({
      content:
        ":root{--app-text:#e1eee6;--app-text-muted:#a9bcb0;--app-surface:#15251d;--app-surface-soft:#1d3025;--app-border:#375345;--app-background:#0d1912}body{background:#0d1912}",
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(output, "table-dark.png") });
    await click("Back to Parts");
    await page.waitForSelector("article");
    await page.screenshot({ path: path.join(output, "lists-dark.png") });
    const sharedNavigation = page.waitForNavigation({waitUntil:"domcontentloaded"});
    await page.evaluate(() =>
      [...document.querySelectorAll("article")]
        .find((a) => a.textContent.includes("Shared parts list"))
        .querySelector("button")
        .click(),
    );
    await sharedNavigation;
    assert.ok(page.url().endsWith("/parts/44444444-4444-4444-8444-444444444444"));
    await page.waitForSelector("tbody tr");
    assert.ok(
      !(await page.evaluate(() =>
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent.trim() === "Upload CSV",
        ),
      )),
    );
    await click("Enquire");
    await page.waitForSelector("textarea");
    await click("Send enquiry");
    await page.waitForFunction(() =>
      document.body.innerText.includes("Enquiry sent."),
    );
    assert.equal(
      actions.find((a) => a.action === "enquire").partNumber,
      "001-ABC",
    );
    assert.equal(
      actions.find((a) => a.action === "enquire").network,
      "44444444-4444-4444-8444-444444444444",
    );
    await click("Back to Parts");
    await click("Share");
    await click("Inside Aim4price");
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', "buyer@example.test");
    await click("Share inside Aim4price");
    await page.waitForFunction(() =>
      document.body.innerText.includes("Shared inside Aim4price."),
    );
    assert.equal(actions.find((a) => a.action === "invite").channel, "direct");
    assert.equal(actions.find((a) => a.action === "invite").role, "viewer");
    await click("Share");
    await page.screenshot({ path: path.join(output, "share-dark.png") });
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, "share-mobile-dark.png") });
    await page.setViewport({ width: 1440, height: 1000 });
    await click("Send link");
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', "other@example.test");
    await click("Create sharing link");
    await page.waitForFunction(() =>
      document.body.innerText.includes("Copy link"),
    );
    assert.equal(
      actions.filter((a) => a.action === "invite").at(-1).channel,
      "link",
    );
    emptyFixture = true;
    network.part_count = 0;
    network.owner_uploaded_at = null;
    network.last_updated = null;
    await page.goto("https://example.test/parts/11111111-1111-4111-8111-111111111111");
    await page.waitForFunction(() => document.body.innerText.includes("No parts uploaded yet"));
    assert.ok(await page.evaluate(() => [...document.querySelectorAll("button")].filter(b => b.textContent.trim() === "Upload CSV").length === 2));
    await page.screenshot({path:path.join(output,"empty-list.png")});
    await page.goto("https://example.test/parts/join?token=fixture");
    await page.waitForSelector('a[href^="/auth?returnTo="]');
    assert.ok(await page.$eval('a[href^="/auth?returnTo="]', e => decodeURIComponent(e.getAttribute("href")).includes("/parts/join?token=fixture")));
    await page.screenshot({path:path.join(output,"invitation-desktop.png")});
    await page.setViewport({width:390,height:844});
    await page.screenshot({path:path.join(output,"invitation-phone.png")});
    assert.deepEqual(errors, []);
    console.log(
      "Parts network UI: table, contact, CSV review/import, membership cancellation, phone and dark mode passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
