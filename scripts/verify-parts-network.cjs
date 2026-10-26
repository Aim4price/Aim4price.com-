/* Real Discovery client, synthetic read-only APIs; no deployment credentials needed. */
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
  "const Component=require(" +
  JSON.stringify(entry) +
  ').default;ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(Component,{website:true}));';
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
    const network = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Dealer pilot",
      status: "active",
      role: "admin",
      visible: true,
      revision: 1,
      business_name: "Example Agricultural",
      town: "George",
      phone: "0821234567",
      email: "parts@example.test",
      vat_included: false,
    };
    const row = {
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
            networks: [network],
            staff: false,
            platformAdmin: false,
            canContribute: true,
          };
        else if (url.searchParams.get("view") === "members")
          data = { members: [{ ...network, dealer_id: "a" }], invites: [] };
        else data = { rows: [row], total: 1 };
        return r.respond({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      }
      return r.respond({
        contentType: "text/html",
        body: '<html><head></head><body><div id="app"></div></body></html>',
      });
    });
    await page.goto("https://example.test/parts");
    await page.addStyleTag({
      content:
        "*{box-sizing:border-box}body{margin:0;background:#eef4f0}" +
        sheets.join("\n"),
    });
    await page.addScriptTag({ content: react });
    await page.addScriptTag({ content: reactDOM });
    await page.addScriptTag({ content: appCode });
    await page.waitForSelector("tbody tr");
    assert.equal(await page.$$eval("table", (e) => e.length), 1);
    const click = async (text) => {
      assert.ok(
        await page.evaluate((t) => {
          const b = [...document.querySelectorAll("button")].find(
            (b) => b.textContent.trim() === t,
          );
          if (!b || b.disabled) return false;
          b.click();
          return true;
        }, text),
        text,
      );
    };
    const output = path.join(root, ".next/parts-network-validation");
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "table-desktop.png") });
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
    await click("Members");
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
    await click("Find parts");
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
