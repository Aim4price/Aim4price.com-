const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const base = process.env.BUSINESS_TEST_URL || "http://127.0.0.1:3100";
const token = "a".repeat(64);
const view = {
  businessName: "George Tractor Services",
  message: "Hydraulic oil leak. Please contact me about a repair.",
  contact: {
    name: "Vasbyt Farm",
    email: "owner@example.com",
    phone: "082 000 0000",
    additional: "Ask for Kuyler",
  },
  umbrella: "",
  assets: [
    {
      title: "Landini tractor",
      details: [
        ["Brand", "Landini"],
        ["Year", "2020"],
        ["Hours", "2 400"],
      ],
      photos: [],
    },
  ],
};
async function main() {
  let server;
  if (!process.env.BUSINESS_TEST_URL) {
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "dev", "-p", "3100"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Next startup timed out")),
        60000,
      );
      server.stdout.on("data", (d) => {
        if (d.toString().includes("Ready")) {
          clearTimeout(timer);
          resolve();
        }
      });
      server.stderr.on("data", (d) => process.stderr.write(d));
      server.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Next exited ${code}`));
      });
    });
  }
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: true,
    pipe: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const output = path.resolve(".next/business-network-validation");
  await fs.mkdir(output, { recursive: true });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      let data = { ok: true };
      if (url.pathname === "/api/business-network/profile")
        data = {
          ok: true,
          business: {
            name: "George Tractor Services",
            email: "service@example.com",
            status: "invited",
            details: {
              town: "George",
              latitude: -33.96,
              longitude: 22.46,
              headings: ["Mechanic"],
              services: ["Brakes"],
              radiusKm: 100,
            },
          },
        };
      if (
        url.pathname === "/api/business-network/request" ||
        url.pathname === "/api/business-network/preview"
      )
        data = { ok: true, view };
      if (url.pathname === "/api/business-network/google")
        data = { ok: true, places: [] };
      if (url.pathname === "/api/me")
        data = { ok: true, signedIn: false, user: null };
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    }
    if (request.resourceType() === "media") return request.abort();
    return request.continue();
  });
  try {
    for (const width of [430, 1440]) {
      await page.setViewport({ width, height: 950, deviceScaleFactor: 1 });
      await page.goto(`${base}/business-network/join#${token}`, {
        waitUntil: "networkidle2",
        timeout: 120000,
      });
      await page.waitForFunction(() =>
        document.body.textContent.includes("Request email"),
      );
      assert.equal(
        await page.$eval("input[readonly]", (el) => el.value),
        "service@example.com",
      );
      assert.equal(await page.evaluate(() => location.hash), "");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "join must fit the screen",
      );
      await page.screenshot({
        path: path.join(output, `join-${width}.png`),
        fullPage: true,
      });
      await page.goto(`${base}/business-network/request#${token}`, {
        waitUntil: "networkidle2",
        timeout: 120000,
      });
      await page.waitForFunction(() =>
        document.body.textContent.includes("Hydraulic oil leak"),
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "request must fit the screen",
      );
      assert.equal(
        await page.$eval('a[href="mailto:owner@example.com"]', (el) => el.href),
        "mailto:owner@example.com",
      );
      assert.ok(
        await page.evaluate(() =>
          document.body.textContent.includes(
            "Reports, documents and ongoing asset access are not included.",
          ),
        ),
      );
      await page.screenshot({
        path: path.join(output, `request-${width}.png`),
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS business joining and read-only requests at 430px and 1440px; no browser runtime errors",
    );
  } finally {
    await browser.close();
    server?.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
