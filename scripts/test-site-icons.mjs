import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const { chromium } = await import(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH
  ? pathToFileURL(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH).href : "playwright");
await build({ logLevel: "error" });
const workspace = new URL(`../.tools/site-icons-${Date.now()}/`, import.meta.url);
const extension = new URL("extension/", workspace);
await mkdir(workspace, { recursive: true });
await cp(new URL("../dist/", import.meta.url), extension, { recursive: true });
const manifestPath = new URL("manifest.json", extension);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
// Only the isolated test copy disables native messaging; never contact the user's wallpaper helper.
manifest.permissions = manifest.permissions.filter(value => value !== "nativeMessaging");
await writeFile(manifestPath, JSON.stringify(manifest));
const image = await readFile(new URL("../public/icons/32x32.png", import.meta.url));
let nonstandardRequests = 0;
const fixture = createServer((request, response) => {
  if (request.url === "/brand.png") { nonstandardRequests++; response.writeHead(200, { "Content-Type": "image/png" }); response.end(image); }
  else if (request.url === "/known") { response.writeHead(200, { "Content-Type": "text/html" }); response.end('<link rel="icon" type="image/png" href="/brand.png"><title>Known icon fixture</title>'); }
  else { response.writeHead(404); response.end(); }
});
await new Promise(resolve => fixture.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${fixture.address().port}`;
let context;
try {
  const path = fileURLToPath(extension);
  context = await chromium.launchPersistentContext(fileURLToPath(new URL("profile/", workspace)), {
    headless: true, viewport: { width: 1280, height: 900 }, ignoreDefaultArgs: ["--disable-extensions"],
    ...(process.env.SCHEDULEPIN_BROWSER_PATH ? { executablePath: process.env.SCHEDULEPIN_BROWSER_PATH } : {}),
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const origin = `chrome-extension://${new URL(worker.url()).host}`;
  const site = await context.newPage();
  await site.goto(`${base}/known`);
  for (let i = 0; i < 40 && !nonstandardRequests; i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(nonstandardRequests, "browser discovers the website-declared nonstandard icon");
  const page = await context.newPage();
  await page.goto(`${origin}/index.html`);
  await page.getByRole("button", { name: "添加入口", exact: true }).waitFor();
  await page.evaluate(async ({ base }) => {
    await chrome.storage.local.set({ "schedulepin.navigation.v1": { groups: [], links: [
      { id: "known", title: "网站原始图标", url: `${base}/known`, pinned: true, groupId: null },
      { id: "missing", title: "", url: "http://localhost:1/missing", pinned: true, groupId: null },
    ] } });
  }, { base });
  await page.locator(`a[href="${base}/known"] .site-icon.has-image`).waitFor();
  const src = await page.locator(`a[href="${base}/known"] img`).getAttribute("src");
  assert.ok(src.includes("/_favicon/"), "real website icon comes from the browser cache");
  await page.waitForTimeout(3500);
  const fallback = page.locator('a[href="http://localhost:1/missing"] .site-icon');
  assert.equal(await fallback.locator("img").count(), 0, "generic globe falls back to the domain initial");
  assert.equal(await fallback.textContent(), "L");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator(".appearance-entry").click();
  await page.frameLocator(".appearance-preview-frame").locator(".site-icon.has-image").waitFor();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.locator(".background-entry").click();
  await page.getByRole("tab", { name: "我的壁纸", exact: true }).click();
  await page.locator('input[accept="image/jpeg,image/png,image/webp"]').setInputFiles({ name: "离线壁纸.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "预览 离线壁纸.png", exact: true }).waitFor();
  await page.getByRole("tab", { name: "风格", exact: true }).click();
  await page.getByLabel("换图方式", { exact: true }).selectOption("fixed");
  await page.getByRole("button", { name: "保存背景", exact: true }).click();
  await page.locator(".background-layer img").waitFor();
  await context.setOffline(true); await page.reload();
  await page.locator(".background-layer img").waitFor();
  assert.ok(await page.locator(".background-layer img").evaluate(el => el.complete && el.naturalWidth > 0), "extension wallpaper survives offline reload");
  console.log("PASS: wallpaper upload and offline extension reload with IndexedDB image.");
  console.log("PASS: unpacked extension, real browser favicon at nonstandard path, generic-globe fallback, and shared iframe preview. Native messaging disabled in isolated test copy.");
} finally {
  await context?.close();
  await new Promise(resolve => fixture.close(resolve));
}
