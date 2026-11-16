/* Real Parts client, synthetic read-only APIs; no deployment credentials needed. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const ts = require("typescript"),
  postcss = require("postcss"),
  puppeteer = require("puppeteer-core"),
  chromium = require("@sparticuz/chromium");
const parser = {};
new Function('exports', ts.transpileModule(fs.readFileSync('lib/parts-network-csv.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(parser);
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
add("components/SharedParts");
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
const excelScript = fs.readFileSync(require.resolve('exceljs/dist/exceljs.min.js'), 'utf8');
const fontCss = `@font-face{font-family:PartsPreview;src:url(data:font/woff;base64,${fs.readFileSync(path.join(root,"public/fonts/montserrat-latin.woff")).toString("base64")})}:root{--font-body:PartsPreview;--font-heading:PartsPreview}body{font-family:PartsPreview,Arial,sans-serif}`;
const appCode =
  "const sources=" +
  JSON.stringify(modules) +
  ",cache={};" +
  'function require(name){if(name==="next/link")return {__esModule:true,default:({children,...props})=>React.createElement("a",props,children)};if(name==="exceljs")return ExcelJS;if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}' +
  "const Component=require(location.pathname.startsWith('/parts-share/') ? 'components/SharedParts' : location.pathname === '/parts/join' ? 'app/parts/join/join-client' : " +
  JSON.stringify(entry) +
  ').default;ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(Component,{website:true,token:location.pathname.split("/")[2],listId:location.pathname.split("/")[2]||""}));';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    ignoreDefaultArgs: ["--hide-scrollbars"],
    headless: true,
    pipe: true,
  });
  try {
    const page = await browser.newPage(),
      errors = [],
      actions = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    let paginationFixture = false;
    let emptyFixture = false;
    let longPickerFixture = false;
    let viewerFixture = false;
    let accessInvites = [];
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
      email: "dealers@aim4price.com",
      vat_included: false,
    };
    const row = {
      dealer_id: "a",
      part_number: "001-ABC",
      description: "Diff washer domed",
      brand: "Landini",
      quantity: 3,
      price: "850.00",
      business_name: "Example Agricultural",
      town: "George",
      phone: "0821234567",
      email: "dealers@aim4price.com",
      vat_included: false,
      uploaded_at: new Date().toISOString(),
    };
    await page.setRequestInterception(true);
    let pdfRequest;
    let shareLocked=false;
    let shareLinks=[{id:"share-1",url:"https://example.test/parts-share/"+"a".repeat(64),created_at:"2026-11-16",protected:true,allow_download:true,allow_enquiry:true,recipient_name:"",revoked_at:null}];
    page.on("request", (r) => {
      if (/\/brand\/(pdf|sheet)\.png$/.test(r.url())) return r.respond({contentType:"image/png",body:fs.readFileSync(path.join(root,"public",new URL(r.url()).pathname))});
      if (r.url().includes('/api/parts-share/')) {
        const input=JSON.parse(r.postData()||'{}');
        if(input.action==='landing')return r.respond({contentType:'application/json',body:JSON.stringify({name:'Landini Parts List',owner:'Example Agricultural',total:1})});
        if(input.action==='unlock'){if(input.password!=='example-password')return r.respond({status:403,contentType:'application/json',body:JSON.stringify({error:'The password is incorrect.'})});shareLocked=false;return r.respond({contentType:'application/json',body:JSON.stringify({name:'Landini Parts List',owner:'Example Agricultural',total:1,page:0,signedIn:false,allowDownload:true,allowEnquiry:true,vatIncluded:false,rows:[{...row,details:{}}]})});}
        if(shareLocked)return r.respond({status:423,contentType:'application/json',body:JSON.stringify({error:'Enter the password from the list owner.'})});
        return r.respond({contentType:'application/json',body:JSON.stringify({name:'Landini Parts List',owner:'Example Agricultural',total:1,page:0,signedIn:false,allowDownload:true,allowEnquiry:true,vatIncluded:false,rows:[{...row,details:{Notes:'Compatible asset models'}}]})});
      }
      if (r.url().includes("/api/parts-network") && new URL(r.url()).searchParams.get("format") === "pdf") {
        pdfRequest = Object.fromEntries(new URL(r.url()).searchParams);
        return r.respond({status:200,contentType:"application/pdf",body:"%PDF-1.7\nfixture"});
      }
      if (r.url().includes("/api/parts-network")) {
        const url = new URL(r.url());
        let data;
        if (url.searchParams.has("token")) return r.respond({status:401,contentType:"application/json",body:JSON.stringify({error:"Sign in required"})});
        if (r.method() === "POST") {
          const b = JSON.parse(r.postData());
          actions.push(b);
          if (b.action === "revoke-share") shareLinks=shareLinks.map(link=>link.id===b.id?{...link,revoked_at:new Date().toISOString()}:link);
          if (b.action === "delete-share") shareLinks=shareLinks.filter(link=>link.id!==b.id);
          if (b.action === "edit-part") row.quantity = Number(b.quantity);
          data =
            b.action === "share-history" ? {links:shareLinks} : b.action === "preview"
              ? {
                  revision: 1,
                  summary: { added: 1, updated: 1, removed: b.mode === "replace" ? 1 : 0, total: 2 },
                  sample: parser.parsePartsSnapshot(b.csv, b.columns, b.options).slice(0,5),
                }
              : b.action === "invite" || b.action === "create-share"
                ? { url: "https://example.test/parts-share/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
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
            canContribute: !viewerFixture,
          };
        else if (url.searchParams.get("view") === "recipients") data={recipients:[{email:'buyer@example.test',business_name:'Buyer Dealer',town_city:'George'}]};
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
            invites: accessInvites,
          };
        else if (longPickerFixture && url.searchParams.get("view") === "mine" && url.searchParams.get("download") === "true") {
          const rows = [row, ...Array.from({length: 41}, (_, i) => ({...row, part_number: "TEST-" + i}))];
          data = {rows, total: rows.length, member: {...network, revision: 0}};
        }
        else if (paginationFixture) {
          const all = Array.from({length:65}, (_, i) => ({...row, part_number:`PAGE-${String(i).padStart(3, "0")}`}));
          const filtered = all.filter(r => r.part_number.includes(url.searchParams.get("search") || ""));
          const size = url.searchParams.get("pageSize") === "all" ? filtered.length : Number(url.searchParams.get("pageSize") || 50);
          const start = Number(url.searchParams.get("page") || 0) * size;
          data = {rows: filtered.slice(start, start + size), total:filtered.length, member:{...network,revision:0}};
        }
        else data = emptyFixture || url.searchParams.get("search") === "not-found" ? { rows: [], total: 0 } : url.searchParams.get("network") === "44444444-4444-4444-8444-444444444444" ? {rows:[row,{...row,part_number:"002-XYZ"},{...row,part_number:"003-PAGE"}],total:3} : { rows: [row], total: 1, member:{...network,revision:0} };
        if (paginationFixture && data.networks) data.networks.push(...Array.from({length:15}, (_,i)=>({...network,id:`extra-${i}`,name:`Extra stocklist ${i}`})));
        return r.respond({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      }
      return r.respond({
        contentType: "text/html",
        body: '<html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eef4f0}' + fontCss + sheets.join("\n") + '</style></head><body><div id="app"></div><div id="aim4price-website-overlays"></div><script>' + excelScript + '</script><script>' + react + '</script><script>' + reactDOM + '</script><script>' + appCode.replace(/<\/script/gi, '<\\/script') + '</script></body></html>',
      });
    });
    await page.goto("https://example.test/parts");
    await page.waitForSelector("article");
    assert.ok(
      await page.$eval("h1", (e) =>
        e.textContent.trim() === "PARTS STOCKLISTS",
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

    paginationFixture = true;
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(() => document.querySelectorAll("article").length === 6);
    await page.click('[aria-label="Stocklists pagination"] [aria-label="Next page"]');
    await page.waitForFunction(() => document.querySelector('[aria-label="Stocklists pagination"]').textContent.includes("Page 2 of 4"));
    await page.type('input[aria-label="Search parts lists"]', "John Deere");
    await page.waitForFunction(() => document.querySelectorAll("article").length === 1);
    assert.match(await page.$eval('[aria-label="Stocklists pagination"]', e=>e.textContent), /Page 1 of 1/);
    await page.click('input[aria-label="Search parts lists"]', {clickCount:3});
    await page.keyboard.press("Backspace");
    await page.click('[aria-label="Stocklists pagination"] [aria-label="Show all per page"]');
    await page.waitForFunction(() => document.querySelectorAll("article").length === 19);
    paginationFixture = false;
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForSelector("article");

    const click = async (text) => {
      await page.waitForFunction(t => [...([...document.querySelectorAll("dialog[open]")].at(-1) || document).querySelectorAll("button")].some(b => (b.textContent.trim() === t || b.getAttribute("aria-label") === t || b.querySelector("strong")?.textContent.trim() === t) && !b.matches(":disabled")), {}, text);
      const navigation = text === "Open" ? page.waitForNavigation({waitUntil:"domcontentloaded"}) : null;
      assert.ok(
        await page.evaluate((t) => {
          const b = [...([...document.querySelectorAll("dialog[open]")].at(-1) || document).querySelectorAll("button")].find(
            (b) =>
              (b.textContent.trim() === t || b.getAttribute("aria-label") === t ||
                b.querySelector("strong")?.textContent.trim() === t) &&
              !b.matches(":disabled"),
          );
          if (!b || b.matches(":disabled")) return false;
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
          document.body.innerText.includes("Share link"),
      ),
    );
    await page.screenshot({
      path: path.join(output, "share-destinations.png"),
    });
    await page.keyboard.press("Escape");
    await click("Open");
    await page.waitForSelector("tbody tr");
    const returnSwitch = await page.$('a[aria-label="Back to parts stocklists"]');
    assert.ok(returnSwitch, "Open stocklists have a header switch");
    assert.equal(await returnSwitch.evaluate(el => el.getAttribute("href")), "/parts");
    await Promise.all([page.waitForNavigation(), returnSwitch.click()]);
    await page.waitForSelector("article");
    assert.equal(await page.$eval("h1", el => el.textContent.trim()), "PARTS STOCKLISTS");
    await click("Open");
    await page.waitForSelector("tbody tr");

    assert.ok(page.url().endsWith("/parts/11111111-1111-4111-8111-111111111111"));
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForSelector("tbody tr");
    assert.equal(await page.$$eval("table", (e) => e.length), 1);
    assert.ok(await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      return !buttons.some(b => b.textContent.trim() === "Back to Parts") &&
        ["Share", "Add / edit parts", "Manage", "Download"].every(label =>
          buttons.find(b => b.textContent.trim() === label)?.closest('[aria-label="Stocklist actions"]'));
    }), "List actions have a dedicated register-style row");
    await page.addStyleTag({content: `@font-face{font-family:PartsPreview;src:url(data:font/woff;base64,${fs.readFileSync(path.join(root,'public/fonts/montserrat-latin.woff')).toString('base64')})} :root{--font-body:PartsPreview;--font-heading:PartsPreview}`});
    await page.evaluate(()=>document.fonts.ready);
    const priceText = () => page.$eval('tbody tr:first-child td:nth-child(5)', e => e.textContent.replace(/\s/g, ''));
    assert.match(await priceText(), /850[.,]00/);
    await page.click('[aria-label="Display prices with or without VAT"] button:nth-child(2)');
    assert.match(await priceText(), /977[.,]50/);
    assert.equal(await page.$eval('[aria-label="Display prices with or without VAT"] button:nth-child(2)',e=>e.getAttribute('aria-pressed')),'true');
    await page.click('[aria-label="Display prices with or without VAT"] button:first-child');
    assert.match(await priceText(), /850[.,]00/);
    paginationFixture = true;
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 20);
    await page.click('[aria-label="Parts pagination"] [aria-label="Next page"]');
    await page.waitForFunction(() => document.querySelector("tbody")?.textContent.includes("PAGE-020"));
    for (const size of [40,60,"all"]) {
      await page.click(`[aria-label="Parts pagination"] [aria-label="Show ${size} per page"]`);
      await page.waitForFunction(n => document.querySelectorAll("tbody tr").length === n, {}, size === "all" ? 65 : size);
    }
    await page.screenshot({path:path.join(output,"parts-pagination.png")});
    paginationFixture = false;
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForSelector("tbody tr");
    await page.screenshot({ path: path.join(output, "table-desktop.png") });
    assert.ok(await page.$$eval('thead th',els=>els.every(e=>getComputedStyle(e).textAlign==='center')));
    await page.evaluate(()=>{URL.createObjectURL=blob=>{window.exportBlob=blob;return 'blob:fixture';};HTMLAnchorElement.prototype.click=function(){};});
    await click('Download');
    assert.equal(await page.$$eval('[data-download-option]', els=>els.length),2);
    assert.ok(!await page.$eval('[role=dialog]',el=>el.textContent.includes('CSV')));
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-download-icon] img')].every(img=>img.complete && img.naturalWidth > 0));
    await page.screenshot({path:path.join(output,'download-parts-desktop.png')});
    await page.setViewport({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 2));
    await page.screenshot({path:path.join(output,'download-parts-phone.png')});
    await page.setViewport({width:1440,height:1000});
    await page.click('[data-download-option]:last-child');await click('Download Excel');
    await page.waitForFunction(()=>document.body.innerText.includes('Parts download ready.'));
    const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.exportBlob.arrayBuffer())));
    const exported=new (require('exceljs').Workbook)();await exported.xlsx.load(Buffer.from(bytes));
    assert.equal(exported.worksheets[0].getCell('A2').value,'001-ABC');
    assert.equal(exported.worksheets[0].getCell('D2').value,3);
    assert.equal(exported.worksheets[0].getCell('F2').value,'Excl. VAT');
    assert.equal(exported.worksheets[0].getCell('E2').value,850);
    assert.equal(exported.worksheets[0].getCell('A2').numFmt,'@');
    await page.click('[aria-label="Display prices with or without VAT"] button:nth-child(2)');
    await click('Download');await click('Download PDF');
    await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
    assert.equal(pdfRequest.vat,'incl');
    assert.equal(pdfRequest.network,'11111111-1111-4111-8111-111111111111');
    assert.equal(pdfRequest.view,'mine');
    assert.equal(pdfRequest.title,'Landini parts');
    assert.equal(await page.evaluate(()=>window.exportBlob.type),'application/pdf');
    await page.click('[aria-label="Display prices with or without VAT"] button:first-child');

    assert.deepEqual(await page.$$eval("thead th", cells => cells.map(c => c.textContent.trim())), ["Part number", "Description", "Brand", "Quantity", "Unit price", "Edit"]);
    assert.deepEqual(await page.$$eval("tbody tr:first-child td", cells => cells.slice(0, 3).map(c => c.textContent.trim())), ["001-ABC", "Diff washer domed", "Landini"]);
    await page.setViewport({ width: 390, height: 844 });
    assert.ok(await page.$eval('[aria-label="Parts results"]', el => el.scrollWidth > el.clientWidth), "Extra columns scroll inside the table on phones");
    await page.$eval('[aria-label="Parts results"]', el => { el.scrollLeft = el.scrollWidth; });
    assert.ok(await page.$eval('[aria-label="Parts results"]', el => el.scrollLeft > 0), "Horizontal scrolling reaches the enquiry column");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "The page itself does not overflow");
    await page.$eval('[aria-label="Parts results"]', el => { el.scrollLeft = 0; });
    assert.equal(await page.$eval('[aria-label="Stocklist actions"]',e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2,"Phone actions use two columns");
    await page.screenshot({ path: path.join(output, "table-columns-phone.png") });
    await page.setViewport({ width: 1440, height: 1000 });
    assert.ok(!(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Next"))));
    await page.type('input[aria-label="Search part number"]', "not-found");
    await page.waitForFunction(() => document.body.innerText.includes("No matching parts"));
    await click("Clear search");
    await page.waitForSelector("tbody tr");
    await click("Edit");
    await page.waitForSelector('[role=dialog] form');
    assert.equal(await page.$eval('[role=dialog] input',e=>e.value),'001-ABC');
    assert.equal(await page.$eval('[aria-label^="Unit price,"]',e=>e.value),'850');
    await click("Incl");
    assert.equal(await page.$eval('[aria-label^="Unit price,"]',e=>e.value),'977.5');
    await page.$eval('[aria-label^="Unit price,"]',e=>e.select());
    await page.type('[aria-label^="Unit price,"]','115');
    await click("Excl");
    assert.equal(await page.$eval('[aria-label^="Unit price,"]',e=>e.value),'100');
    await click("Incl");
    assert.equal(await page.$eval('[aria-label^="Unit price,"]',e=>e.value),'115');
    assert.ok(await page.$eval('[aria-label^="Unit price,"]',e=>e.parentElement.textContent.includes('R')));
    assert.ok(await page.$eval('[role=dialog] form',e=>{
      const save=[...e.querySelectorAll('button')].find(b=>b.textContent==='Save changes');
      return Math.abs(save.getBoundingClientRect().right-e.getBoundingClientRect().right)<2;
    }),'Edit footer aligns right');
    await click('+ Add detail');
    await click('Bin / shelf location');
    assert.equal(await page.$eval('dialog input[type="checkbox"]',e=>e.checked),true);
    await click('Add detail');
    await page.type('[aria-label="Bin / shelf location"]','Shelf A4');
    await page.click('[aria-label="Remove Bin / shelf location from this part"]');
    assert.equal(await page.$('[aria-label="Bin / shelf location"]'),null);
    await click('+ Add detail'); await click('Bin / shelf location'); await click('Add detail');
    assert.equal(await page.$eval('[aria-label="Bin / shelf location"]',e=>e.value),'');
    await page.type('[aria-label="Bin / shelf location"]','Shelf A4');
    await page.screenshot({path:path.join(output,'edit-part.png')});
    await page.setViewport({width:390,height:844});
    assert.ok(await page.$eval('[role=dialog]',e=>e.scrollWidth<=e.clientWidth+1),'Edit controls fit phone width');
    assert.ok(await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save changes');const r=button.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Edit Save changes remains visible on phone');
    await page.screenshot({path:path.join(output,'edit-part-phone.png')});
    await page.setViewport({width:1440,height:1000});
    await page.$eval('[role=dialog] input[type=number]',e=>e.select());
    await page.type('[role=dialog] input[type=number]',"8");
    await click("Save changes");
    await page.waitForFunction(()=>document.body.innerText.includes('Part updated successfully.'));
    assert.equal(actions.find(a=>a.action==='edit-part').originalPartNumber,'001-ABC');
    assert.equal(actions.find(a=>a.action==='edit-part').revision,0);
    assert.equal(actions.find(a=>a.action==='edit-part').price,'100.00');
    assert.equal(actions.find(a=>a.action==='edit-part').quantity,'8');
    assert.equal(actions.find(a=>a.action==='edit-part').details.location,'Shelf A4');
    assert.equal(actions.find(a=>a.action==='edit-part').extraFields[0].private,true);
    await page.waitForFunction(()=>[...document.querySelectorAll('tbody td')].some(e=>e.textContent.trim()==='8'));
    await page.goto('https://example.test/parts/44444444-4444-4444-8444-444444444444');
    await page.waitForSelector('tbody tr');
    assert.equal(await page.$$eval('button',els=>els.filter(e=>e.textContent.trim()==='Edit').length),0);
    await click("Enquire");
    await page.waitForSelector("[role=dialog]");
    assert.equal(
      await page.$eval('a[href^="tel:"]', (e) => e.getAttribute("href")),
      "tel:0821234567",
    );
    assert.equal(await page.$eval('[role=dialog] h2',e=>e.textContent),'Parts enquiry');
    await page.addStyleTag({content: `@font-face{font-family:PartsPreview;src:url(data:font/woff;base64,${fs.readFileSync(path.join(root,'public/fonts/montserrat-latin.woff')).toString('base64')})} :root{--font-body:PartsPreview;--font-heading:PartsPreview}`});
    await page.evaluate(()=>document.fonts.ready);
    await page.setViewport({width:1440,height:700});
    await page.evaluate(() => document.documentElement.style.setProperty('--website-visible-height', '600px'));
    assert.ok(await page.$eval('[class*="enquiryBody"]', e => e.scrollHeight <= e.clientHeight + 1), 'Single-part contact body has no nested scrollbar at a scaled desktop height');
    assert.ok(await page.$eval('[role=dialog]', e => e.scrollHeight <= e.clientHeight + 1), 'Entire enquiry fits a 600px effective viewport without clipping or scrolling');
    assert.ok(await page.$$eval('[class*=enquiryContact] small', els=>els.every(e=>e.closest('[class*=enquiryContact]').scrollWidth<=e.closest('[class*=enquiryContact]').clientWidth+1 && e.scrollWidth<=e.clientWidth+1 && e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)+1)), 'Contact details stay on one complete line in the actual site font');
    assert.ok(await page.evaluate(()=>{
      const dealer=document.querySelector('[class*=enquiryDealer]').getBoundingClientRect();
      const parts=document.querySelector('[class*=enquiryItems]').getBoundingClientRect();
      const contacts=document.querySelector('[class*=enquiryContactGrid]').getBoundingClientRect();
      return Math.abs(dealer.top-contacts.top)<=1 && Math.abs(parts.bottom-contacts.bottom)<=1;
    }), 'Dealer and requested parts align with the top and bottom of the contact rows');
    await page.screenshot({path:path.join(output,'enquiry-desktop.png')});
    await page.evaluate(() => document.documentElement.style.removeProperty('--website-visible-height'));
    await page.setViewport({width:390,height:844});
    await page.screenshot({path:path.join(output,'enquiry-phone.png')});
    assert.ok(await page.$eval('[role=dialog]',e=>e.scrollWidth<=e.clientWidth+1),'Enquiry modal fits phone width');
    assert.ok(await page.$eval('[aria-label="Requested quantity for 001-ABC"]',e=>e.getBoundingClientRect().width<=110),'Quantity field stays compact');
    await page.setViewport({width:1440,height:1000});

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
    await page.goto('https://example.test/parts/11111111-1111-4111-8111-111111111111');
    await page.waitForSelector('tbody tr');
    await click("Add / edit parts");
    // Match the normal website: a 1440px canvas with the portal inside the same zoom.
    await page.setViewport({width: 740, height: 285});
    await page.evaluate(() => {
      const canvas = document.createElement("div");
      const scale = innerWidth / 1440;
      canvas.dataset.websiteCanvas = "";
      canvas.id = "parts-test-canvas";
      canvas.style.width = "1440px";
      canvas.style.zoom = String(scale);
      canvas.style.setProperty("--website-design-vw", "14.4px");
      canvas.style.setProperty("--website-visible-height", `${innerHeight / scale}px`);
      document.body.append(canvas);
      canvas.append(document.getElementById("app"), document.getElementById("aim4price-website-overlays"));
    });
    const chooser = '[role="dialog"][aria-label="Add / edit parts"]';
    assert.ok(await page.$eval(chooser, dialog => {
      const bounds = dialog.getBoundingClientRect();
      const edit = [...dialog.querySelectorAll("button")].find(button => button.innerText.includes("Edit parts"));
      return bounds.height > 180 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1
        && edit.getBoundingClientRect().bottom <= bounds.bottom;
    }), "Canonical landscape chooser fits the viewport and shows both choices");
    await page.screenshot({path:path.join(output, "entry-chooser-landscape.png")});
    await page.setViewport({width: 740, height: 165});
    await page.$eval("#parts-test-canvas", canvas =>
      canvas.style.setProperty("--website-visible-height", `${innerHeight / (innerWidth / 1440)}px`));
    assert.ok(await page.$eval(chooser, dialog => {
      if (getComputedStyle(dialog).overflowY !== "auto" || dialog.scrollHeight <= dialog.clientHeight) return false;
      dialog.scrollTop = dialog.scrollHeight;
      const edit = [...dialog.querySelectorAll("button")].find(button => button.innerText.includes("Edit parts"));
      return dialog.scrollTop > 0 && edit.getBoundingClientRect().bottom <= dialog.getBoundingClientRect().bottom;
    }), "The chooser scrolls to its last action on a very short screen");
    await page.$eval("#parts-test-canvas", canvas => canvas.replaceWith(...canvas.childNodes));
    await page.setViewport({width: 1440, height: 1000});
    await click("Add parts");
    await page.hover('[data-tone="green"]');
    await page.$eval('[data-tone="green"]',e=>e.focus());
    await page.screenshot({path:path.join(output,'entry-choices-desktop.png')});
    await click("See an example");
    await page.waitForSelector('[aria-label="Example parts table"]');
    assert.equal(await page.$eval('[role=dialog]', dialog => dialog.textContent.includes('Add one part')), false);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), "Example parts list");
    await page.setViewport({width:390,height:844});
    assert.ok(await page.$eval('[aria-label="Example parts table"]', table => table.scrollWidth > table.clientWidth));
    await click("Back");
    assert.equal(await page.evaluate(() => document.activeElement.textContent), "See an example");
    await page.setViewport({width:1440,height:1000});

    await page.setViewport({width:390,height:844});
    await page.screenshot({path:path.join(output,'entry-choices-phone.png')});
    await page.setViewport({width:1440,height:1000});
    await click("Import file");
    await page.waitForSelector("input[type=file]");
    const file = path.join(output, "fixture.csv");
    fs.writeFileSync(file,"Part number,Quantity,Price\n001-ABC,2,850\n002-XYZ,1,100");
    await (await page.$("input[type=file]")).uploadFile(file);
    await page.waitForSelector('[aria-label="Quantity column"]');
    await click('Continue to editable table');
    await page.waitForSelector('[aria-label="Part number 1"]');
    await click("Continue");
    await click("Review parts");
    await page.waitForFunction(() => document.body.innerText.includes("reviewed rows"));
    await page.screenshot({ path: path.join(output, "upload-review.png") });
    await click("Save parts");
    await page.waitForFunction(() => document.body.innerText.includes("Parts list updated successfully."));
    assert.equal(actions.find((a) => a.action === "import").revision, 1);
    await click("Add / edit parts"); await click("Add parts");
    await click("Add one part");
    await page.waitForSelector('[aria-label="Part number 1"]');
    await page.setViewport({width:1440,height:720});
    assert.ok(await page.evaluate(()=>{const add=[...document.querySelectorAll('button')].find(b=>b.textContent==='+ Add detail');return Boolean(add && add.closest('[class*=entryFooter]')); }),'Add detail sits outside the scrolling fields');
    assert.ok(await page.$eval('[class*=stageBody]', body=>body.scrollHeight <= body.clientHeight + 1), 'Core fields fit without vertical scrolling');
    await page.screenshot({path:path.join(output,'manual-core-fields.png')});
    await click('+ Add detail');
    const detailChoices=await page.$$eval('dialog[open] [data-detail]',cards=>cards.map(card=>({id:card.dataset.detail,text:card.querySelector('small').textContent,oneLine:card.querySelector('small').getBoundingClientRect().height<=parseFloat(getComputedStyle(card.querySelector('small')).lineHeight)+1})));
    assert.equal(detailChoices.length,7,'Every picker keeps all seven choices visible');
    assert.ok(detailChoices.every(c=>c.oneLine),'Card descriptions stay on one line');
    assert.ok(detailChoices.some(c=>c.id==='custom'));
    assert.ok(detailChoices.some(c=>c.text==='Compatible asset models'));
    await page.screenshot({path:path.join(output,'detail-picker-choices.png')});
    await page.click('[aria-label="Close add detail"]');
    await page.setViewport({width:1440,height:1000});
    await page.type('[aria-label="Part number 1"]', '000123');
    await page.type('[aria-label="Quantity 1"]', '1');
    await page.type('[aria-label="Brand 1"]', 'Landini');
    await page.type('[aria-label="Description 1"]', 'Dowel');
    assert.ok(await page.$eval('[aria-label="Part number is required"]',e=>e.disabled));
    assert.ok(await page.$eval('[aria-label="Quantity is required"]',e=>e.disabled));
    await page.type('[aria-label="Unit price 1"]','100');
    await click('Incl');
    assert.equal(await page.$eval('[aria-label="Unit price 1"]',e=>e.value),'115');
    await click('Excl');
    assert.equal(await page.$eval('[aria-label="Unit price 1"]',e=>e.value),'100');
    await page.click('[aria-label="Remove Brand from this part"]');
    assert.equal(await page.$('[aria-label="Brand 1"]'),null);
    await click('+ Add detail');
    await page.screenshot({path:path.join(output,'restore-fields.png')});
    await page.click('[aria-label="Restore Brand"]');
    assert.equal(await page.$eval('[aria-label="Brand 1"]',e=>e.value),'');
    await page.type('[aria-label="Brand 1"]','Landini');

    await click('+ Add detail'); await click('Compatible models'); await click('Add detail');
    await page.type('[aria-label="Compatible models"]','Landini 100');
    await page.click('[aria-label="Remove Compatible models from this part"]');
    assert.equal(await page.$('[aria-label="Compatible models"]'),null);
    await click('+ Add detail'); await click('Compatible models'); await click('Add detail');
    await page.type('[aria-label="Compatible models"]','Landini 100');
    await page.screenshot({path:path.join(output,'manual-editor.png')});
    await click("Continue");
    assert.ok(!await page.evaluate(()=>document.body.innerText.includes('Blank prices show as')));
    assert.ok(!await page.evaluate(()=>document.body.innerText.includes('Price VAT basis')));
    await page.setViewport({width:1440,height:720});
    assert.ok(await page.$eval('[class*=stageBody]',e=>e.scrollHeight<=e.clientHeight+1),'Contact step fits without scrolling');
    await page.screenshot({path:path.join(output,'manual-contact.png')});
    await page.setViewport({width:1440,height:1000});
    await click("Review parts");
    await page.waitForFunction(() => document.body.innerText.includes('reviewed rows'));
    await click("Save & add another");
    await page.waitForSelector('[aria-label="Part number 1"]');
    const added=actions.filter(a=>a.action==='import').at(-1);
    assert.equal(added.extraFields[0].id,'compatibility');
    assert.equal(parser.parsePartsSnapshot(added.csv,added.columns,added.options)[0].details.compatibility,'Landini 100');
    await page.waitForSelector('[aria-label="Part number 1"]');
    assert.equal(await page.$eval('[aria-label="Part number 1"]',e=>e.value),'');
    assert.equal(await page.$$eval('[aria-invalid=true]',els=>els.length),0);
    await page.type('[aria-label="Part number 1"]','000123');
    await page.type('[aria-label="Quantity 1"]','2');
    await click('Continue');await click('Review parts');await click('Save parts');
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    assert.equal(actions.filter(a => a.action === 'import').at(-1).mode, 'add');
    assert.equal(parser.parsePartsSnapshot(actions.filter(a => a.action === 'import').at(-1).csv, {partNumber:0,description:1,quantity:2,price:3,brand:4}, {hasHeader:false})[0].partNumber, '000123');
    await click("Add / edit parts"); await click("Edit parts"); longPickerFixture = true; await click("Edit a specific part");
    await page.waitForSelector('[aria-label="Search parts to edit"]');
    longPickerFixture = false;
    assert.equal(await page.$$eval('[aria-label="Parts to edit"] button', buttons => buttons.length), 42);
    assert.ok(await page.$eval('[aria-label="Parts to edit"]', list => list.scrollHeight > list.clientHeight));
    assert.ok(await page.$eval('[aria-label="Choose part"]', dialog => !/Page 1 of|Previous|Next/.test(dialog.textContent)));
    await page.screenshot({path:path.join(output,'choose-part-refined.png')});
    await page.type('[aria-label="Search parts to edit"]', '001-ABC');
    await click("001-ABC");
    await page.waitForSelector('[aria-label="Edit part"]');
    await click("Back");
    assert.equal(await page.$eval('[aria-label="Search parts to edit"]', e=>e.value), '001-ABC');
    await click("Back");
    longPickerFixture = true;
    await click("Edit in a sheet");
    await page.waitForSelector('[aria-label="Part number 1"]');
    assert.equal(await page.$eval('[aria-label="Part number 1"]', e=>e.value), '001-ABC');
    longPickerFixture = false;
    // Sheet tools only update the draft; columns, bulk scope, row actions and undo round-trip.
    const importsBeforeTools = actions.filter(a => a.action === "import").length;
    await click("Manage columns");
    await page.waitForSelector('dialog[open][aria-label="Manage columns"]');
    await page.evaluate(() => [...document.querySelectorAll('dialog label')].find(e => e.querySelector('strong')?.textContent === 'Brand').querySelector('input').click());
    await click("Done");
    assert.equal(await page.$eval('[aria-label="Brand 1"]', e => e.getClientRects().length), 0);
    await click("Manage columns");
    await page.evaluate(() => [...document.querySelectorAll('dialog label')].find(e => e.querySelector('strong')?.textContent === 'Brand').querySelector('input').click());
    await click("Done");
    await page.click('[aria-label="Select row 1"]');
    // Optional core columns can be removed without shifting the CSV schema; Undo restores them.
    for (const label of ['Description','Unit price','Brand']) {
      const before = await page.$eval(`[aria-label="${label} 1"]`,e=>e.value);
      await click('Manage columns');
      assert.equal(await page.$('[aria-label="Delete Part number column"]'),null);
      assert.equal(await page.$('[aria-label="Delete Quantity column"]'),null);
      await page.click(`[aria-label="Delete ${label} column"]`);
      await click('Delete column from sheet');
      assert.equal(await page.$eval(`[aria-label="${label} 1"]`,e=>e.getClientRects().length),0);
      assert.equal(await page.$eval(`[aria-label="${label} 1"]`,e=>e.value),'');
      assert.equal(await page.$eval('[aria-label="Part number 1"]',e=>e.value),'001-ABC');
      await click('Undo');
      assert.equal(await page.$eval(`[aria-label="${label} 1"]`,e=>e.value),before);
      assert.ok(await page.$eval(`[aria-label="${label} 1"]`,e=>e.getClientRects().length));
    }
    await page.click('[aria-label="Select row 1"]');
    const originalBrand = await page.$eval('[aria-label="Brand 1"]', e => e.value);
    await click("Bulk edit");
    await page.waitForSelector('dialog[open][aria-label="Bulk edit parts"]');
    await page.setViewport({width:1440,height:720});
    for(let stage=0;stage<3;stage++) {
      assert.equal(await page.$('[aria-label="Bulk edit progress"]'),null);
      assert.ok(await page.$eval('[data-bulk-body]',e=>e.scrollHeight<=e.clientHeight+1),'Bulk stage fits without scrolling');
      await page.screenshot({path:path.join(output,`bulk-stage-${stage+1}.png`)});
      if(stage<2) await click('Continue');
    }
    await page.type('dialog input:not([type=checkbox]):not([type=radio])', 'Test brand');
    await click("Preview changes");
    assert.ok(await page.$eval('[data-bulk-body]',e=>e.scrollHeight<=e.clientHeight+1),'Bulk review fits without scrolling');
    await click('Back');
    assert.equal(await page.$eval('dialog input:not([type=checkbox]):not([type=radio])',e=>e.value),'Test brand','Going back preserves the change');
    await click('Preview changes');
    await page.screenshot({path:path.join(output,'sheet-bulk-preview.png')});
    await page.setViewport({width:390,height:844});
    assert.ok(await page.$eval('dialog[open]', e => e.getBoundingClientRect().right <= innerWidth && e.getBoundingClientRect().left >= 0));
    await page.screenshot({path:path.join(output,'sheet-bulk-phone.png')});
    await page.setViewport({width:1440,height:1000});
    await click("Apply to 1 part");
    assert.equal(await page.$eval('[aria-label="Brand 2"]', e => e.value), originalBrand);
    assert.equal(await page.$eval('[aria-label="Brand 1"]', e => e.value), 'Test brand');
    await click("Undo");
    assert.equal(await page.$eval('[aria-label="Brand 1"]', e => e.value), originalBrand);
    await page.click('[aria-label="Select row 1"]');
    await click("Bulk edit");
    await page.click('dialog input[type=radio][value=selected]');
    await click('Continue');
    await page.click('dialog input[type=radio][value="2"]');
    await click('Continue');
    await page.type('dialog input:not([type=checkbox]):not([type=radio])', '-1');
    await click("Preview changes");
    assert.ok(await page.$eval('dialog', e => e.querySelector('[role=alert]') && [...e.querySelectorAll('button')].some(b => b.textContent.includes('Apply to') && b.disabled)));
    await page.click('[aria-label="Close sheet tool"]');
    await click("Bulk edit");
    await click('Continue');
    await page.click('dialog input[type=radio][value="0"]');
    await click('Continue');
    await page.type('dialog input[placeholder="e.g. 01."]', '001-');
    await click("Preview changes");
    assert.ok(await page.$eval('dialog', e => e.textContent.includes('001-ABC') && e.textContent.includes('ABC')));
    await click("Apply to 1 part");
    assert.equal(await page.$eval('[aria-label="Part number 1"]', e => e.value), 'ABC');
    await click("Undo");
    await page.click('[aria-label="Actions for row 1"]');
    await page.focus('[data-detail="delete"]');
    assert.ok(await page.$eval('[data-detail="delete"]',button=>{const r=button.getBoundingClientRect(),p=button.closest('[class*=sheetToolBody]').getBoundingClientRect();return r.left-p.left>=16 && p.right-r.right>=16;}),'Focus halo has space on both sides');
    await page.screenshot({path:path.join(output,"part-action-choices.png")});
    const sheetPriceBefore = await page.$eval('[aria-label="Unit price 1"]',e=>e.value);
    await click("Edit part");
    await page.type('dialog[aria-label="Edit part"] [aria-label="Description"]', ' changed');
    assert.ok(await page.$('dialog[aria-label="Edit part"] [aria-label="Unit price VAT basis"]'));
    await page.screenshot({path:path.join(output,'sheet-shared-edit-part.png')});
    await click("Save changes");
    assert.ok((await page.$eval('[aria-label="Description 1"]', e => e.value)).endsWith(' changed'));
    assert.equal(Number(await page.$eval('[aria-label="Unit price 1"]',e=>e.value)), Number(sheetPriceBefore), 'Shared editor preserves the sheet price');
    await click("Undo");
    const countBeforeDelete = await page.$$eval('[aria-label="Parts spreadsheet"] tbody tr', els => els.length);
    await page.click('[aria-label="Actions for row 1"]');
    await click("Delete row");
    await click("Delete row from sheet");
    assert.equal(await page.$$eval('[aria-label="Parts spreadsheet"] tbody tr', els => els.length), countBeforeDelete - 1);
    await click("Undo");
    await click("+ Add row");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), `Part number ${countBeforeDelete + 1}`);
    await click("Undo");
    assert.equal(actions.filter(a => a.action === "import").length, importsBeforeTools);
    assert.ok(await page.$eval('[aria-label="Actions for row 1"]',button=>{
      const rect=button.getBoundingClientRect();const cell=button.closest('td').getBoundingClientRect();
      return rect.width>=36 && rect.height>=36 && rect.left>=cell.left && rect.right<=cell.right;
    }));
    await page.screenshot({path:path.join(output,'sheet-tools.png')});
    await click("Review changes");
    await click("Save changes (1 removed)");
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    assert.equal(actions.filter(a=>a.action==="import").at(-1).baseRevision,0);
    // Literal column paste preserves all rows and part identifiers.
    async function paste(selector,text) {
      await page.$eval(selector,(input,text)=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',text);input.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));},text);
    }
    await click("Add / edit parts"); await click("Add parts");
    await click("Add in a sheet");
    await click('+ Add column');
    assert.deepEqual(await page.$$eval('dialog[open] [data-detail]',cards=>cards.map(c=>c.dataset.detail)),detailChoices.map(c=>c.id),'Sheet and individual detail pickers have the same seven cards');
    await page.screenshot({path:path.join(output,'add-column-grid.png')});
    await click('Custom field');
    await page.type('[aria-label="Custom field name"]','Dimensions');
    await page.screenshot({path:path.join(output,'add-part-column.png')});
    await page.setViewport({width:1366,height:650});
    assert.ok(await page.$eval('dialog[open]', e=>{const r=e.getBoundingClientRect(), f=e.querySelector('footer').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && f.bottom<=innerHeight;}),'Detail picker and footer fit a short laptop viewport');
    await page.screenshot({path:path.join(output,'detail-picker-short.png')});
    await page.setViewport({width:390,height:650});
    assert.ok(await page.$eval('dialog[open]', e=>{const r=e.getBoundingClientRect(), f=e.querySelector('footer').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && f.bottom<=innerHeight;}),'Detail picker fits a phone');
    await page.setViewport({width:1440,height:1000});

    await click('Next');
    assert.ok(await page.$eval('[aria-label="Dimensions 1"]',input=>{
      const cell=input.getBoundingClientRect(),sheet=input.closest('[aria-label="Parts spreadsheet"]').getBoundingClientRect();
      return cell.left>=sheet.left && cell.right<=sheet.right+1;
    }),'New column is visible immediately before review');
    await page.type('[aria-label="Dimensions 1"]','001 x 020');
    await click('+ Add row');
    await page.$eval('[aria-label="Scroll sheet columns"]', bar=>{bar.scrollLeft=bar.scrollWidth;bar.dispatchEvent(new Event('scroll'));});
    assert.ok(await page.$eval('[aria-label="Parts spreadsheet"]',sheet=>{
      const rows=[...sheet.querySelectorAll('tr')];
      return rows[0].scrollLeft>0 && rows.every(row=>Math.abs(row.scrollLeft-rows[0].scrollLeft)<=1);
    }),'Footer scrollbar pans every row and header together');
    assert.ok(await page.$$eval('[aria-label="Parts spreadsheet"] tbody tr',rows=>rows.every(row=>getComputedStyle(row).scrollbarWidth==='none')),'No row has an embedded scrollbar');
    const barTop=await page.$eval('[aria-label="Scroll sheet columns"]',e=>e.getBoundingClientRect().top);
    await page.$eval('[aria-label="Parts spreadsheet"]',sheet=>{sheet.parentElement.scrollTop=sheet.parentElement.scrollHeight;});
    assert.equal(await page.$eval('[aria-label="Scroll sheet columns"]',e=>e.getBoundingClientRect().top),barTop,'Horizontal bar stays fixed while rows scroll vertically');
    await page.screenshot({path:path.join(output,'fixed-sheet-scroll.png')});
    await page.click('[aria-label="Actions for row 2"]'); await click('Delete row'); await click('Delete row from sheet');

    await click('Manage columns');
    await page.click('[aria-label="Clear Dimensions values"]');
    await click('Clear values in sheet');
    assert.equal(await page.$eval('[aria-label="Dimensions 1"]',e=>e.value),'');
    await click('Undo');
    assert.equal(await page.$eval('[aria-label="Dimensions 1"]',e=>e.value),'001 x 020');
    await click('Manage columns');
    await page.setViewport({width:1440,height:720});
    assert.ok(await page.$eval('[data-columns-body]',e=>e.scrollHeight<=e.clientHeight+1),'Column cards fit at laptop height');
    assert.equal(await page.$$eval('[class*="manageColumnRow"]',e=>e.length),6);
    await page.screenshot({path:path.join(output,'manage-columns.png')});
    await page.click('[aria-label="Delete Dimensions column"]');
    await page.screenshot({path:path.join(output,'delete-column-confirmation.png')});
    await click('Back');
    assert.equal(await page.$eval('[aria-label="Dimensions 1"]',e=>e.value),'001 x 020','Back preserves column values');
    await page.click('[aria-label="Delete Dimensions column"]');
    await click('Delete column from sheet');
    await page.setViewport({width:1440,height:1000});
    assert.equal(await page.$('[aria-label="Dimensions 1"]'),null);
    await click('Undo');
    assert.equal(await page.$eval('[aria-label="Dimensions 1"]',e=>e.value),'001 x 020');
    await page.click('[aria-label="Actions for row 1"]'); await click('Edit part');
    assert.equal(await page.$eval('dialog[aria-label="Edit part"] [aria-label="Dimensions"]',e=>e.value),'001 x 020');
    await click('Back'); await click('Cancel');
    // Clear the temporary value so existing blank-row validation stays unchanged.
    await page.$eval('[aria-label="Dimensions 1"]',e=>e.select());await page.keyboard.press('Backspace');

    await page.waitForSelector('[aria-label="Sheet tools"]');
    assert.ok(await page.$('[aria-label="Actions for row 1"]'));
    const addRowCount = await page.$$eval('[aria-label="Parts spreadsheet"] tbody tr', rows=>rows.length);
    await click('+ Add row');
    assert.equal(await page.$eval('input:focus',input=>input.getAttribute('aria-label')),`Part number ${addRowCount + 1}`);
    await click('Undo');
    assert.equal(await page.$$eval('[aria-label="Parts spreadsheet"] tbody tr',rows=>rows.length),addRowCount);
    assert.equal(await page.$$eval('[aria-invalid=true]',els=>els.length),0);
    assert.equal(await page.$('section[aria-label="Contact details and VAT"]'),null);
    await paste('[aria-label="Part number 1"]','01.3657074\n01.3671641');
    await paste('[aria-label="Quantity 1"]','16\n9');
    await paste('[aria-label="Description 1"]','Dowel\nBush');
    assert.equal(await page.$eval('[aria-label="Quantity 2"]',e=>e.value),'9');
    await page.click('[aria-label="Select all rows"]');
    await click('Bulk edit');
    await click('Continue');
    await page.click('dialog input[type=radio][value="0"]');
    await click('Continue');
    await page.type('dialog input[placeholder="e.g. 01."]','01.');
    await click('Preview changes');
    assert.ok(await page.evaluate(()=>document.body.innerText.includes('01.3657074')&&document.body.innerText.includes('3657074')));
    await click('Apply to 2 parts');
    assert.equal(await page.$eval('[aria-label="Part number 1"]',e=>e.value),'3657074');
    await click('Undo');
    assert.equal(await page.$eval('[aria-label="Part number 1"]',e=>e.value),'01.3657074');
    await page.screenshot({path:path.join(output,'paste-editor.png')});
    await page.setViewport({width:390,height:844});
    await page.screenshot({path:path.join(output,'paste-editor-phone.png')});
    assert.ok(await page.evaluate(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent==='Continue').getBoundingClientRect();return b.top>0&&b.bottom<=innerHeight;}), 'Continue stays visible on phone');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    await page.setViewport({width:1440,height:1000});
    await click('Continue');await click('Review parts');
    await page.waitForFunction(()=>document.body.innerText.includes('reviewed rows'));
    await click('Save parts');
    await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
    await click('Add / edit parts'); await click('Add parts');await click('Import file');
    await page.screenshot({path:path.join(output,'parts-import-upload.png')});
    await click('Paste from a spreadsheet');
    await page.type('[aria-label="Paste spreadsheet cells"]','Description\tQty\tPart number\nDowel\t16\t000123');
    await click('Match pasted columns');await page.waitForSelector('[aria-label="Part number column"]');
    assert.ok(await page.$eval('[aria-label="Part number column"]',e=>e.textContent.includes('Column 3')));
    assert.equal(await page.$('input[type=file]'),null,'Mapping is separate from upload');
    await click('Continue to editable table');await page.waitForSelector('[aria-label="Part number 1"]').catch(async e=>{console.error(await page.evaluate(()=>document.body.innerText));throw e;});
    assert.equal(await page.$eval('[aria-label="Part number 1"]',e=>e.value),'000123');
    await paste('[aria-label="Part number 1"]','000123\n000123');
    await paste('[aria-label="Quantity 1"]','16\n2');
    await click('Continue'); assert.equal(await page.$$eval('[aria-invalid=true]',els=>els.length),2);
    await paste('[aria-label="Part number 2"]','000456');
    await click('Continue');await click('Review parts');await page.waitForFunction(()=>document.body.innerText.includes('reviewed rows'));await click('Save parts');
    await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
    const Excel=require('exceljs');const workbook=new Excel.Workbook();
    workbook.addWorksheet('Stock').addRow(['01.3657074','Dowel',16]);
    workbook.addWorksheet('Other').addRow(['01.3671641','Bush',9]);
    const excelFile=path.join(output,'fixture.xlsx');await workbook.xlsx.writeFile(excelFile);
    await click('Add / edit parts'); await click('Add parts');await click('Import file');
    await (await page.$('input[type=file]')).uploadFile(excelFile);
    await page.waitForSelector('[aria-label="Quantity column"]');
    assert.equal(await page.$eval('input[type=checkbox]',e=>e.checked),false);
    await page.click('[aria-label="Quantity column"]');
    await page.screenshot({path:path.join(output,'import-column-picker.png')});
    await page.$$eval('[role=option]',options=>options.find(o=>o.textContent.includes('Column 3')).click());
    await page.click('[aria-label="Description column"]');
    await page.waitForSelector('[role=option]');
    await page.$$eval('[role=option]',options=>options.find(o=>o.textContent.includes('Column 1')).click());
    assert.ok(await page.$$eval('button',buttons=>buttons.find(b=>b.textContent==='Continue to editable table').disabled),'Repeated columns cannot continue');
    await page.click('[aria-label="Description column"]');
    await page.waitForSelector('[role=option]');
    await page.$$eval('[role=option]',options=>options.find(o=>o.textContent.includes('Column 2')).click());
    await page.screenshot({path:path.join(output,'excel-mapping.png')});
    await click('Continue to editable table');
    await page.waitForSelector('[aria-label="Part number 1"]');
    assert.equal(await page.$eval('[aria-label="Quantity 1"]',e=>e.value),'16');
    await click('Continue');await click('Review parts');await page.waitForFunction(()=>document.body.innerText.includes('reviewed rows'));await click('Save parts');
    await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
    await click("Manage");
    await page.waitForSelector("[role=dialog]");
    assert.ok(
      await page.evaluate(
        () =>
          document.body.innerText.includes("Rename list") &&
          document.body.innerText.includes("Delete list"),
      ),
    );
    assert.ok(await page.$eval("[role=dialog]", (dialog) =>
      Boolean(dialog.closest("#aim4price-website-overlays")),
    ), "Parts dialogs use the shared website overlay host");
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
    await page.$eval('[role=dialog]', dialog => {
      [...dialog.querySelectorAll('button')].find(button => button.querySelector('strong')?.textContent === 'Share').click();
    });
    await page.waitForFunction(() => document.querySelector('[role=dialog]')?.textContent.includes('Share link'));
    assert.equal(await page.$$eval('[role=dialog]', dialogs => dialogs.length), 1, 'Manage Share opens the managed share modal');
    await page.$eval('[role=dialog] button[aria-label^="Close"]', button => button.click());
    await click('Manage');
    await page.$eval('[role=dialog] button[data-tone="green"]', button=>button.click());
    await page.waitForSelector('[aria-label="Parts download format"]');
    assert.equal(await page.$eval('[role=dialog] input',input=>input.value),'Landini parts');
    await click('Cancel');await click('Manage');
    await click("Delete list");
    await page.waitForSelector('[aria-label="Delete this parts list?"]');
    await page.screenshot({path:path.join(output,"delete-parts.png")});
    await click("Cancel");
    assert.ok(!actions.some(a=>a.action==="archive"), "Cancel does not delete the list");
    await click("Rename list");
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role="dialog"]')
          ?.getAttribute("aria-label") === "Rename parts list",
    );
    await click("Back");
    const accessUrl = page.url();
    await click("Sharing & access");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent === "Remove access",
      ),
    );
    assert.equal(page.url(), accessUrl, "access opens without navigation");
    assert.equal(await page.$eval("[role=dialog]", e=>e.getAttribute("aria-label")), "Sharing & access");
    assert.equal(await page.$$eval('[role=dialog] table',tables=>tables.length),0);
    assert.ok(await page.$eval('[role=dialog]',dialog=>dialog.textContent.includes('List owner') && dialog.textContent.includes('No invitations yet')));
    await page.screenshot({path:path.join(output,"sharing-access-modal.png")});
    await page.setViewport({width:390,height:844});
    assert.ok(await page.$eval('[role=dialog]',dialog=>dialog.scrollWidth <= dialog.clientWidth + 2));
    await page.screenshot({path:path.join(output,"sharing-access-phone.png")});
    await page.setViewport({width:1440,height:1000});
    await click("Remove access");
    await page.waitForSelector("[role=dialog]");
    await page.keyboard.press("Escape");
    assert.ok(
      !actions.some((a) => a.action === "member"),
      "cancel does not change membership",
    );
    await page.keyboard.press("Escape");
    accessInvites = [
      {id:'pending-invite',email:'parts@example.test',role:'viewer',expires_at:'2099-01-01'},
      {id:'expired-invite',email:'expired@example.test',role:'viewer',expires_at:'2000-01-01'},
      {id:'accepted-invite',email:'accepted@example.test',role:'viewer',expires_at:'2099-01-01',consumed_at:'2026-11-15'},
    ];
    await click('Manage');await click('Sharing & access');
    await page.waitForFunction(()=>document.body.innerText.includes('parts@example.test'));
    assert.ok(await page.$eval('[role=dialog]',dialog=>['Pending','Expired','Accepted'].every(status=>dialog.textContent.includes(status))));
    assert.equal(await page.$$eval('[role=dialog] button',buttons=>buttons.filter(button=>button.textContent==='Revoke invitation').length),1);
    await click('Revoke invitation');
    await page.waitForFunction(()=>!document.querySelector('[role=dialog] [aria-busy="true"]'));
    assert.ok(actions.some(action=>action.action==='revoke' && action.id==='pending-invite'));
    await page.keyboard.press('Escape');
    await page.setViewport({ width: 390, height: 844 });
    await page.waitForSelector("tbody tr");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "only table scrolls on phones",
    );
    await page.screenshot({ path: path.join(output, "table-phone.png") });
    await click("Add / edit parts"); await click("Add parts");
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
    await page.goto("https://example.test/parts");
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
          (b) => b.textContent.trim() === "Add / edit parts",
        ),
      )),
    );
    await page.click('[aria-label="Select 001-ABC"]');
    await page.click('[aria-label="Select 002-XYZ"]');
    await page.click('[aria-label="Select 003-PAGE"]');
    await click("Enquire about selected");
    await page.$eval('[aria-label="Requested quantity for 002-XYZ"]',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'3');e.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.ok(await page.$eval('a[href^="mailto:"]',e=>decodeURIComponent(e.href).includes('002-XYZ — quantity 3')));
    assert.ok(await page.$eval('a[href^="https://wa.me/"]',e=>decodeURIComponent(e.href).includes('001-ABC — quantity 1')));
    await click("Next");
    await page.$eval('[aria-label="Requested quantity for 003-PAGE"]',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'5');e.dispatchEvent(new Event('input',{bubbles:true}));});
    await click("Previous");
    assert.equal(await page.$eval('[aria-label="Requested quantity for 002-XYZ"]',e=>e.value),'3');
    await click("Aim4price");
    await page.waitForSelector("textarea");
    await page.screenshot({path:path.join(output,'multi-enquiry.png')});
    await page.setViewport({width:390,height:844});
    await page.screenshot({path:path.join(output,'multi-enquiry-phone.png')});
    await page.addStyleTag({content:':root{--app-text:#e1eee6;--app-text-muted:#a9bcb0;--app-surface:#15251d;--app-surface-soft:#1d3025;--app-border:#375345;--app-background:#0d1912}'});
    assert.equal(await page.$eval('[role=dialog] tbody strong',e=>getComputedStyle(e).color),'rgb(225, 238, 230)');
    await page.screenshot({path:path.join(output,'enquiry-dark-phone.png')});
    assert.ok(await page.evaluate(()=>{const r=[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.includes('Send via Aim4price')).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Send action remains visible on phone');
    await page.setViewport({width:1440,height:1000});

    await click("Send via Aim4price");
    await page.waitForFunction(() =>
      document.body.innerText.includes("Enquiry sent."),
    );
    assert.equal(actions.find(a=>a.action==='enquire').items.length,3);
    assert.equal(actions.find(a=>a.action==='enquire').items[1].quantity,3);
    assert.equal(actions.find(a=>a.action==='enquire').items[2].quantity,5);
    assert.equal(
      actions.find((a) => a.action === "enquire").items[0].partNumber,
      "001-ABC",
    );
    assert.equal(
      actions.find((a) => a.action === "enquire").network,
      "44444444-4444-4444-8444-444444444444",
    );
    await page.goto("https://example.test/parts");
    await click("Share");
    await click("Inside Aim4price");
    await page.waitForFunction(()=>document.body.innerText.includes('Buyer Dealer'));
    await click('Details');
    assert.ok(await page.$('dialog[open] dl'),'Directory business details expand inline');
    await click('Hide details');
    await click('Select');
    assert.equal(await page.$eval('dialog[open] button[aria-pressed]',el=>el.getAttribute('aria-pressed')),'true');
    await page.type('[aria-label="Find sharing recipient"]','Another business');
    assert.ok(await page.$eval('dialog[open] footer button:last-child',b=>b.disabled),'Changing the business search clears the previous selection');
    await click('Search');await click('Select');
    await page.screenshot({path:path.join(output,'share-recipient-picker.png')});
    await page.setViewport({width:390,height:740});
    assert.ok(await page.$eval('dialog[open]',d=>d.scrollWidth<=d.clientWidth+2));
    await page.screenshot({path:path.join(output,'share-recipient-phone.png')});
    await page.setViewport({width:1440,height:1000});
    await click('Continue');
    await click('Continue');
    await click('Continue');
    assert.ok(!actions.some(a=>a.action==='create-share'),'Choosing view only does not create a link');
    assert.ok(await page.$eval('dialog[open] footer button:last-child',b=>b.disabled),'Risk consent is required');
    await page.click('dialog[open] input[type=checkbox]');
    await click('Create parts link');
    await page.waitForFunction(()=>document.body.innerText.includes('Copy link'));
    assert.equal(actions.find(a=>a.action==='create-share').channel,'direct');
    assert.equal(actions.find(a=>a.action==='create-share').accepted,true);
    assert.equal(actions.find(a=>a.action==='create-share').password,'','No-password choice creates an unprotected link');
    await page.click('dialog[open] button[aria-label="Close dialog"]');await page.waitForFunction(()=>!document.querySelector('dialog'));
    await click('Share');
    await page.screenshot({path:path.join(output,'share-dark.png')});
    await click('Share link');
    await page.screenshot({path:path.join(output,'share-access-choice.png')});
    assert.equal(await page.$('[role=dialog] input[type=password]'),null,'Permissions and password use separate slides');
    await page.click('[role=dialog] input[type=checkbox]');
    await page.screenshot({path:path.join(output,'share-permissions-only.png')});
    await click('Continue');
    await click('Add a password');
    assert.ok(await page.$eval('[data-access-actions] button:last-child',b=>b.disabled),'Adding protection requires a valid password');
    await page.type('[role=dialog] input[type=password]','example-password');
    await page.click('[aria-label="Show password"]');
    assert.equal(await page.$eval('[role=dialog] input[autocomplete="new-password"]',el=>el.type),'text');
    await page.click('[aria-label="Hide password"]');
    assert.equal(await page.$eval('[role=dialog] input[autocomplete="new-password"]',el=>el.value),'example-password');
    await click('Back');
    assert.ok(await page.$eval('[aria-label="Download parts"]',el=>el.checked),'Going back preserves permissions');
    await click('Continue');
    assert.equal(await page.$eval('[role=dialog] input[type=password]',el=>el.value),'example-password','Going back preserves password');
    await page.setViewport({width:1440,height:650});
    assert.ok(await page.$eval('[role=dialog]',d=>{const body=d.children[1],r=d.getBoundingClientRect();return body.scrollHeight<=body.clientHeight+2&&r.top>=0&&r.bottom<=innerHeight;}),'Parts link settings fit a short desktop without scrolling');
    await page.screenshot({path:path.join(output,'share-permissions.png')});
    await page.setViewport({width:1440,height:1000});
    await click('Continue');
    await page.click('dialog[open] input[type=checkbox]');
    await click('Create parts link');
    await page.waitForFunction(()=>document.body.innerText.includes('Copy link'));
    assert.equal(actions.filter(a=>a.action==='create-share').at(-1).channel,'link');
    assert.equal(actions.filter(a=>a.action==='create-share').at(-1).allowDownload,true);
    assert.equal(actions.filter(a=>a.action==='create-share').at(-1).password,'example-password');
    await page.screenshot({path:path.join(output,'share-send.png')});
    await page.click('dialog[open] button[aria-label="Close dialog"]');await page.waitForFunction(()=>!document.querySelector('dialog'));  await click('Share');await click('Sharing history');
    await page.waitForFunction(()=>document.body.innerText.includes('Password protected'));
    await page.screenshot({path:path.join(output,'parts-share-history.png')});
    assert.ok(await page.$('[data-share-history]'),'Parts uses the owner sharing history layout');
    await click('Settings');
    await click('Continue');
    await page.$$eval('[role=dialog] input[type=checkbox]',inputs=>inputs.at(-1).click());
    await page.type('[role=dialog] input[type=password]','replacement-password');
    await page.setViewport({width:1440,height:650});
    assert.ok(await page.$eval('[role=dialog]',d=>{const body=d.children[1];return body.scrollHeight<=body.clientHeight+2;}),'Editing a password fits the short desktop without scrolling');
    await page.screenshot({path:path.join(output,'share-settings-spacing.png')});
    await page.setViewport({width:1440,height:1000});
    shareLinks.push({...shareLinks[0],id:'share-2',recipient_name:'Other shared link',protected:false});
    await click('Save settings');
    await page.waitForFunction(()=>document.body.innerText.includes('Manage your shared links'));
    assert.equal(actions.filter(a=>a.action==='update-share').at(-1).password,'replacement-password');
    await click('Revoke access');
    assert.equal(await page.$$eval('[data-share-history] article',rows=>rows.length),1,'Only the selected link remains during confirmation');
    assert.ok(!(await page.$eval('[data-share-history]',el=>el.innerText)).includes('Other shared link'));
    assert.equal(await page.$('[data-share-history] a'),null,'Link actions are hidden during confirmation');
    assert.ok(await page.$eval('[aria-label="Confirm link change"]',confirmation=>confirmation.getBoundingClientRect().top-confirmation.previousElementSibling.getBoundingClientRect().bottom>=16),'Confirmation is separated from the history rows');
    await page.screenshot({path:path.join(output,'share-confirmation-spacing.png')});
    await click('Keep link');
    assert.equal(await page.$$eval('[data-share-history] article',rows=>rows.length),2,'Cancelling restores the full history');
    assert.ok(!actions.some(a=>a.action==='revoke-share'),'Cancelled revocation leaves the link active');
    await click('Revoke access');await click('Confirm revoke');
    await page.waitForFunction(()=>document.body.innerText.includes('Access revoked'));
    assert.equal(actions.filter(a=>a.action==='revoke-share').at(-1).id,'share-1');
    assert.equal(await page.$$eval('[data-share-history] article',rows=>rows.length),2,'Revoking restores the full history');
    await click('Delete');
    assert.equal(await page.$$eval('[data-share-history] article',rows=>rows.length),1,'Deletion only shows its selected link');
    await click('Confirm delete');
    await page.waitForFunction(()=>document.body.innerText.includes('Other shared link')&&!document.body.innerText.includes('Access revoked'));
    assert.equal(actions.filter(a=>a.action==='delete-share').at(-1).id,'share-1');
    viewerFixture=true;
    await page.goto('https://example.test/parts');await page.waitForSelector('article');
    assert.ok(await page.evaluate(()=>![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Add parts list')));
    viewerFixture=false;
    emptyFixture = true;
    network.part_count = 0;
    network.owner_uploaded_at = null;
    network.last_updated = null;
    await page.goto("https://example.test/parts/11111111-1111-4111-8111-111111111111");
    await page.waitForFunction(() => document.body.innerText.includes("No parts added yet"));
    assert.ok(await page.evaluate(() => [...document.querySelectorAll("button")].filter(b => b.textContent.trim() === "Add / edit parts").length === 1));
    await page.screenshot({path:path.join(output,"empty-list.png")});
    await page.goto("https://example.test/parts/join?token=fixture");
    await page.waitForSelector('a[href^="/auth?returnTo="]');
    assert.ok(await page.$eval('a[href^="/auth?returnTo="]', e => decodeURIComponent(e.getAttribute("href")).includes("/parts/join?token=fixture")));
    await page.screenshot({path:path.join(output,"invitation-desktop.png")});
    await page.setViewport({width:390,height:844});
    await page.screenshot({path:path.join(output,"invitation-phone.png")});
    await page.setViewport({width:1440,height:1000});
    await page.goto('https://example.test/parts-share/'+'a'.repeat(64));
    await page.waitForFunction(()=>document.body.innerText.includes('Open parts list'));
    await page.screenshot({path:path.join(output,'shared-parts-landing.png')});
    await click('Open parts list');
    await page.waitForSelector('tbody tr');
    await click('Download PDF');
    await page.waitForSelector('a[href^="/business/join?"]');
    assert.ok(await page.$eval('a[href^="/business/join?"]',a=>decodeURIComponent(a.href).includes('/parts-share/')));
    await page.screenshot({path:path.join(output,'shared-parts-account-gate.png')});
    await page.setViewport({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(output,'shared-parts-phone.png')});
    shareLocked=true;
    await page.goto('https://example.test/parts-share/'+'a'.repeat(64));
    await page.waitForFunction(()=>document.body.innerText.includes('Open parts list'));
    assert.equal(await page.$('input[type=password]'),null,'Welcome screen appears before the password prompt');
    await click('Open parts list');
    await page.screenshot({path:path.join(output,'shared-parts-protected-landing.png')});
    await page.waitForSelector('input[type=password]');
    assert.equal(await page.$('tbody tr'),null,'Locked links do not render parts');
    await page.type('input[type=password]','wrong-password');
    await page.$eval('dialog form',form=>form.requestSubmit());
    await page.waitForFunction(()=>document.body.innerText.includes('The password is incorrect.'));
    assert.equal(await page.$('tbody tr'),null);
    await page.$eval('input[type=password]',el=>{el.select();});
    await page.type('input[type=password]','stale-form-state');
    await click('Show password');
    assert.equal(await page.$eval('input[autocomplete=current-password]',el=>el.type),'text');
    await click('Hide password');
    await page.setViewport({width:1440,height:900});
    await page.screenshot({path:path.join(output,'parts-link-password-modal.png')});
    // Password managers may fill the DOM without dispatching React change events.
    await page.$eval('input[name=linkPassword]',el=>{el.value='example-password';});
    await page.$eval('dialog form',form=>form.requestSubmit());
    await page.waitForSelector('tbody tr');
    assert.equal(await page.$('dialog'),null,'Successful unlock opens the list directly');
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
