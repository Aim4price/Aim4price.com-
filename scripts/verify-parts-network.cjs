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
const appCode =
  "const sources=" +
  JSON.stringify(modules) +
  ",cache={};" +
  'function require(name){if(name==="next/link")return {__esModule:true,default:({children,...props})=>React.createElement("a",props,children)};if(name==="exceljs")return ExcelJS;if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}' +
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
    let viewerFixture = false;
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
    page.on("request", (r) => {
      if (r.url().includes("/api/parts-network")) {
        const url = new URL(r.url());
        let data;
        if (url.searchParams.has("token")) return r.respond({status:401,contentType:"application/json",body:JSON.stringify({error:"Sign in required"})});
        if (r.method() === "POST") {
          const b = JSON.parse(r.postData());
          actions.push(b);
          if (b.action === "edit-part") row.quantity = Number(b.quantity);
          data =
            b.action === "preview"
              ? {
                  revision: 1,
                  summary: { added: 1, updated: 1, removed: b.mode === "replace" ? 1 : 0, total: 2 },
                  sample: parser.parsePartsSnapshot(b.csv, b.columns, b.options).slice(0,5),
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
            invites: [],
          };
        else data = emptyFixture || url.searchParams.get("search") === "not-found" ? { rows: [], total: 0 } : url.searchParams.get("network") === "44444444-4444-4444-8444-444444444444" ? {rows:[row,{...row,part_number:"002-XYZ"},{...row,part_number:"003-PAGE"}],total:3} : { rows: [row], total: 1, member:{...network,revision:0} };
        return r.respond({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      }
      return r.respond({
        contentType: "text/html",
        body: '<html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eef4f0}' + sheets.join("\n") + '</style></head><body><div id="app"></div><div id="aim4price-website-overlays"></div><script>' + excelScript + '</script><script>' + react + '</script><script>' + reactDOM + '</script><script>' + appCode.replace(/<\/script/gi, '<\\/script') + '</script></body></html>',
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

    const click = async (text) => {
      await page.waitForFunction(t => [...document.querySelectorAll("button")].some(b => (b.textContent.trim() === t || b.querySelector("strong")?.textContent.trim() === t) && !b.matches(":disabled")), {}, text);
      const navigation = text === "Open" ? page.waitForNavigation({waitUntil:"domcontentloaded"}) : null;
      assert.ok(
        await page.evaluate((t) => {
          const b = [...document.querySelectorAll("button")].find(
            (b) =>
              (b.textContent.trim() === t ||
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
          document.body.innerText.includes("Send link"),
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
    await page.screenshot({ path: path.join(output, "table-desktop.png") });
    assert.ok(await page.$$eval('thead th',els=>els.every(e=>getComputedStyle(e).textAlign==='center')));
    await page.evaluate(()=>{URL.createObjectURL=blob=>{window.exportBlob=blob;return 'blob:fixture';};HTMLAnchorElement.prototype.click=function(){};});
    await click('Download');await click('Excel');
    await page.waitForFunction(()=>document.body.innerText.includes('Parts download ready.'));
    const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.exportBlob.arrayBuffer())));
    const exported=new (require('exceljs').Workbook)();await exported.xlsx.load(Buffer.from(bytes));
    assert.equal(exported.worksheets[0].getCell('A2').value,'001-ABC');
    assert.equal(exported.worksheets[0].getCell('D2').value,3);
    assert.equal(exported.worksheets[0].getCell('F2').value,'Excl. VAT');

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
    assert.equal(await page.$eval('#part-edit-price',e=>e.value),'850');
    await click("Incl");
    assert.equal(await page.$eval('#part-edit-price',e=>e.value),'977.5');
    await page.$eval('#part-edit-price',e=>e.select());
    await page.type('#part-edit-price','115');
    await click("Excl");
    assert.equal(await page.$eval('#part-edit-price',e=>e.value),'100');
    await click("Incl");
    assert.equal(await page.$eval('#part-edit-price',e=>e.value),'115');
    assert.ok(await page.$eval('#part-edit-price',e=>e.parentElement.textContent.includes('R')));
    assert.ok(await page.$eval('[role=dialog] form',e=>{
      const save=[...e.querySelectorAll('button')].find(b=>b.textContent==='Save changes');
      return Math.abs(save.getBoundingClientRect().right-e.getBoundingClientRect().right)<2;
    }),'Edit footer aligns right');
    await page.screenshot({path:path.join(output,'edit-part.png')});
    await page.setViewport({width:390,height:844});
    assert.ok(await page.$eval('[role=dialog]',e=>e.scrollWidth<=e.clientWidth+1),'Edit controls fit phone width');
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
    await click("Add / edit parts"); await click("Add parts");
    await page.hover('[data-tone="green"]');
    await page.$eval('[data-tone="green"]',e=>e.focus());
    await page.screenshot({path:path.join(output,'entry-choices-desktop.png')});
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
    await page.type('[aria-label="Part number 1"]', '000123');
    await page.type('[aria-label="Quantity 1"]', '1');
    await page.type('[aria-label="Brand 1"]', 'Landini');
    await page.type('[aria-label="Description 1"]', 'Dowel');
    await page.screenshot({path:path.join(output,'manual-editor.png')});
    await click("Continue");
    await click("Review parts");
    await page.waitForFunction(() => document.body.innerText.includes('reviewed rows'));
    await click("Save & add another");
    await page.waitForSelector('[aria-label="Part number 1"]');
    assert.equal(await page.$eval('[aria-label="Part number 1"]',e=>e.value),'');
    assert.equal(await page.$$eval('[aria-invalid=true]',els=>els.length),0);
    await page.type('[aria-label="Part number 1"]','000123');
    await page.type('[aria-label="Quantity 1"]','2');
    await click('Continue');await click('Review parts');await click('Save parts');
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    assert.equal(actions.filter(a => a.action === 'import').at(-1).mode, 'add');
    assert.equal(parser.parsePartsSnapshot(actions.filter(a => a.action === 'import').at(-1).csv, {partNumber:0,description:1,quantity:2,price:3,brand:4}, {hasHeader:false})[0].partNumber, '000123');
    await click("Add / edit parts"); await click("Edit parts"); await click("Edit one part");
    await page.waitForSelector('[aria-label="Search parts to edit"]');
    await page.type('[aria-label="Search parts to edit"]', '001-ABC');
    await click("001-ABC");
    await page.waitForSelector('[aria-label="Edit part"]');
    await click("Back");
    assert.equal(await page.$eval('[aria-label="Search parts to edit"]', e=>e.value), '001-ABC');
    await click("Back");
    await click("Edit in a sheet");
    await page.waitForSelector('[aria-label="Part number 1"]');
    assert.equal(await page.$eval('[aria-label="Part number 1"]', e=>e.value), '001-ABC');
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
    assert.equal(await page.$$eval('[aria-invalid=true]',els=>els.length),0);
    assert.equal(await page.$('section[aria-label="Contact details and VAT"]'),null);
    await paste('[aria-label="Part number 1"]','01.3657074\n01.3671641');
    await paste('[aria-label="Quantity 1"]','16\n9');
    await paste('[aria-label="Description 1"]','Dowel\nBush');
    assert.equal(await page.$eval('[aria-label="Quantity 2"]',e=>e.value),'9');
    await page.click('[aria-label="Select all rows"]');
    await page.evaluate(()=>[...document.querySelectorAll('summary')].find(e=>e.textContent==='Clean up part numbers').click());
    await page.type('[aria-label="Remove part number prefix"]','01.');
    await click('Preview cleanup (2)');
    assert.ok(await page.evaluate(()=>document.body.innerText.includes('01.3657074')&&document.body.innerText.includes('3657074')));
    await click('Apply cleanup');
    assert.equal(await page.$eval('[aria-label="Part number 1"]',e=>e.value),'3657074');
    await click('Undo last change');
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
    await page.evaluate(()=>[...document.querySelectorAll('summary')].find(e=>e.textContent==='Paste a table with a different column order').click());
    await page.type('[aria-label="Paste spreadsheet cells"]','Description\tQty\tPart number\nDowel\t16\t000123');
    await click('Match pasted columns');await page.waitForSelector('[aria-label="Part number column"]');
    assert.equal(await page.$eval('[aria-label="Part number column"]',e=>e.value),'2');
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
    await page.select('[aria-label="Quantity column"]','2');await page.select('[aria-label="Description column"]','1');
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
    await page.screenshot({path:path.join(output,"sharing-access-modal.png")});
    await click("Remove access");
    await page.waitForSelector("[role=dialog]");
    await page.keyboard.press("Escape");
    assert.ok(
      !actions.some((a) => a.action === "member"),
      "cancel does not change membership",
    );
    await page.keyboard.press("Escape");
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
    await page.waitForFunction(()=>document.querySelector('[aria-label="Sharing recipient"] option[value="buyer@example.test"]'));
    await page.select('[aria-label="Sharing recipient"]', 'buyer@example.test');
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
