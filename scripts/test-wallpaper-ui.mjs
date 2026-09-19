import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, preview } from "vite";

const { chromium } = await import(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH ? pathToFileURL(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH).href : "playwright");
await build({ logLevel: "error" });
const server = await preview({ preview: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.SCHEDULEPIN_BROWSER_PATH ? { executablePath: process.env.SCHEDULEPIN_BROWSER_PATH } : {}) });
const image = await readFile(new URL("../public/icons/128x128.png", import.meta.url));
const output = new URL("../.tools/wallpaper-tests/", import.meta.url);
await mkdir(output, { recursive: true });
const button = (page, name) => page.getByRole("button", { name, exact: true });
const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const saved = item => item.favorite || item.retained || item.source === "local";
const readState = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open("schedulepin.background.v1", 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction(["preferences", "wallpapers"]);
    const p = tx.objectStore("preferences").get("current"), w = tx.objectStore("wallpapers").getAll();
    tx.oncomplete = () => { resolve({ preferences: p.result, wallpapers: w.result.map(({ blob, thumbnail, ...item }) => ({ ...item, blobSize: blob.size })) }); db.close(); };
  };
}));
async function waitState(page, check, message) {
  const until = Date.now() + 8000;
  let state;
  while (Date.now() < until) { state = await readState(page); if (check(state)) return state; await new Promise(resolve => setTimeout(resolve, 40)); }
  assert.fail(`${message}: ${JSON.stringify(state)}`);
}
async function mockOnline(context, fail = () => false, gate = Promise.resolve()) {
  await context.route("https://commons.wikimedia.org/w/api.php*", async route => {
    await gate;
    if (fail()) return route.abort();
    const pages = Object.fromEntries([321, 322, 323].map(id => [id, { pageid: id, title: `File:风景${id}.jpg`, imageinfo: [{ mime: "image/jpeg", width: 2000, thumburl: `https://thumb.wikimedia.org/${id}.jpg`, descriptionurl: `https://commons.wikimedia.org/wiki/File:${id}.jpg`, extmetadata: { Artist: { value: "测试作者" }, LicenseShortName: { value: "CC BY 4.0" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by/4.0/" } } }] }]));
    return route.fulfill({ json: { query: { pages } } });
  });
  await context.route("https://thumb.wikimedia.org/*.jpg", route => route.fulfill({ contentType: "image/png", body: image }));
}
async function openBackground(page) { await button(page, "壁纸库").click(); await page.getByRole("heading", { name: "页面背景", exact: true }).waitFor(); }
async function back(page) { await button(page, "返回").click(); }

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let failing = false, release;
  await mockOnline(context, () => failing, new Promise(resolve => { release = resolve; }));
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base); await openBackground(page);
  assert.equal(await button(page, "保存背景").count(), 0);
  assert.equal(await button(page, "取消").count(), 0);
  await button(page, "风景沉浸").click();
  await page.getByRole("status").filter({ hasText: "正在准备壁纸" }).waitFor();
  assert.equal((await readState(page)).preferences?.style ?? "paper", "paper", "pending download does not replace background");
  release();
  await waitState(page, s => s.preferences?.style === "photo", "photo applies automatically");
  await page.frameLocator(".appearance-preview-frame").locator(".background-layer img").waitFor();
  await tab(page, "我的壁纸").click();
  assert.equal(await page.locator(".wallpaper-grid article").count(), 0, "downloaded current image is not a saved wallpaper");
  await button(page, "固定为壁纸").click();
  let state = await waitState(page, s => s.preferences.mode === "fixed" && s.wallpapers.some(w => w.retained), "pin retains image");
  const fixedId = state.preferences.currentId;
  await button(page, "使用 风景321.jpg").waitFor();
  await back(page); await page.reload();
  await page.locator(`.background-layer[data-wallpaper-id="${fixedId}"] img`).waitFor();
  await openBackground(page); await tab(page, "我的壁纸").click();
  await button(page, "使用 风景321.jpg").waitFor();
  await button(page, "恢复自动更换").click();
  await waitState(page, s => s.preferences.mode === "daily", "unpin resumes original frequency");
  assert.equal((await readState(page)).wallpapers.filter(saved).length, 1, "unpin retains image in library");
  await tab(page, "在线精选").click(); await button(page, "加载在线精选").click();
  await button(page, "使用 风景322.jpg").click();
  await waitState(page, s => s.preferences.currentId === "commons-322", "online use applies");
  await tab(page, "我的壁纸").click();
  assert.equal(await button(page, "使用 风景322.jpg").count(), 0, "using does not favorite");
  await button(page, "收藏这张").click(); await button(page, "使用 风景322.jpg").waitFor();
  await button(page, "取消收藏").click(); await button(page, "使用 风景322.jpg").waitFor({ state: "detached" });
  await button(page, "固定为壁纸").click(); await button(page, "使用 风景322.jpg").waitFor();

  // Rapid sliders preserve the latest values, including independent portrait crops.
  await tab(page, "背景效果").click();
  await page.getByRole("slider", { name: "背景遮罩", exact: true }).fill("40");
  await page.getByRole("slider", { name: "背景遮罩", exact: true }).fill("51");
  await page.getByRole("slider", { name: "壁纸模糊", exact: true }).fill("4");
  await page.getByRole("slider", { name: "壁纸水平位置", exact: true }).fill("80");
  await button(page, "竖屏").click(); await page.getByRole("slider", { name: "壁纸水平位置", exact: true }).fill("20");
  await waitState(page, s => s.preferences.overlay === 51 && s.preferences.blur === 4 && s.preferences.positions["commons-322"]?.portrait.x === 20, "sliders persist final changes");
  assert.equal((await readState(page)).preferences.positions["commons-322"].landscape.x, 80);
  const frame = page.frameLocator(".appearance-preview-frame");
  await frame.locator(".background-layer img").waitFor();
  assert.equal(await frame.locator(".background-layer img").evaluate(el => getComputedStyle(el).objectPosition), "20% 50%");
  await page.screenshot({ path: fileURLToPath(new URL("settings-background.png", output)) });
  await back(page); await page.reload(); await page.locator(".background-layer img").waitFor();
  assert.equal(await page.locator(".background-layer img").evaluate(el => getComputedStyle(el).objectPosition), "80% 50%");
  await page.setViewportSize({ width: 1000, height: 1500 });
  assert.equal(await page.locator(".background-layer img").evaluate(el => getComputedStyle(el).objectPosition), "20% 50%");

  // Fixed replacement requires confirmation and keeps both explicitly pinned images.
  await button(page, "换一张").click(); await page.getByRole("dialog", { name: "预览替换壁纸" }).waitFor();
  assert.equal((await readState(page)).preferences.currentId, "commons-322");
  await button(page, "取消").click();
  await button(page, "换一张").click(); await button(page, "替换并固定").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  state = await readState(page); assert.notEqual(state.preferences.currentId, "commons-322");
  assert.ok(state.wallpapers.find(w => w.id === state.preferences.currentId).retained);

  await openBackground(page); await tab(page, "我的壁纸").click();
  const upload = page.locator('input[accept="image/jpeg,image/png,image/webp"]');
  await upload.setInputFiles({ name: "山海.png", mimeType: "image/png", buffer: image });
  await button(page, "使用 山海.png").waitFor();
  state = await readState(page); assert.ok(state.wallpapers.find(w => w.title === "山海.png").blobSize > 0);
  const downloadEvent = page.waitForEvent("download"); await button(page, "导出我的壁纸").click();
  const download = await downloadEvent, backup = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(backup.wallpapers.length, state.wallpapers.filter(saved).length, "backup includes pinned non-favorites");
  await page.locator('input[accept="application/json"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("status").filter({ hasText: `已导入 ${backup.wallpapers.length} 张` }).waitFor();
  await button(page, "使用 山海.png").nth(1).waitFor();
  const beforeReset = await readState(page);
  await button(page, "恢复背景默认设置").click();
  await waitState(page, s => s.preferences.style === "paper" && s.preferences.currentId === null, "reset default background");
  assert.equal((await readState(page)).wallpapers.length, beforeReset.wallpapers.length);
  assert.equal(await page.locator(".wallpaper-grid article").count(), beforeReset.wallpapers.filter(saved).length, "reset preserves library");

  // Open-mode rotation remains per-window. Set rule in UI and retain no automatic images.
  await button(page, "使用 风景321.jpg").first().click();
  await tab(page, "自动更换").click();
  await page.getByLabel("更换频率", { exact: true }).selectOption("open");
  await waitState(page, s => s.preferences.mode === "open", "open frequency persists");
  await back(page);
  const globalId = (await readState(page)).preferences.currentId;
  const savedBefore = (await readState(page)).wallpapers.filter(saved).length;
  await page.reload(); await page.locator(`.background-layer[data-wallpaper-id]:not([data-wallpaper-id="${globalId}"]) img`).waitFor();
  const firstOpen = await page.locator(".background-layer").getAttribute("data-wallpaper-id");
  const sibling = await context.newPage(); await sibling.goto(base);
  await sibling.locator(`.background-layer[data-wallpaper-id]:not([data-wallpaper-id="${globalId}"]) img`).waitFor();
  const siblingId = await sibling.locator(".background-layer").getAttribute("data-wallpaper-id");
  assert.equal(await page.locator(".background-layer").getAttribute("data-wallpaper-id"), firstOpen);
  await button(page, "换一张").click();
  await page.locator(`.background-layer[data-wallpaper-id]:not([data-wallpaper-id="${firstOpen}"]) img`).waitFor();
  const manual = await page.locator(".background-layer").getAttribute("data-wallpaper-id");
  await page.reload(); await page.locator(`.background-layer[data-wallpaper-id]:not([data-wallpaper-id="${manual}"]) img`).waitFor();
  assert.equal(await sibling.locator(".background-layer").getAttribute("data-wallpaper-id"), siblingId);
  assert.equal((await readState(page)).preferences.currentId, globalId);
  assert.equal((await readState(page)).wallpapers.filter(saved).length, savedBefore);
  await sibling.close();
  await button(page, "固定").click();
  await waitState(page, s => s.preferences.mode === "fixed", "toolbar pin");
  await openBackground(page); await button(page, "恢复自动更换").click();
  await waitState(page, s => s.preferences.mode === "open", "pin remembers open frequency");
  await button(page, "固定为壁纸").click();
  await waitState(page, s => s.preferences.mode === "fixed", "pin before offline check");
  await context.setOffline(true); await tab(page, "我的壁纸").click();
  await button(page, "使用 山海.png").first().click();
  await frame.locator(".background-layer img").waitFor();
  assert.ok(await frame.locator(".background-layer img").evaluate(el => el.complete && el.naturalWidth > 0));
  await context.setOffline(false);
  await page.setViewportSize({ width: 320, height: 750 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: fileURLToPath(new URL("settings-background-narrow.png", output)), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: immediate save, retained-only library, favorite/pin distinctions, crops, fixed replacement, backup/reset, offline, open-mode window isolation and narrow layout.");
  await context.close();

  const failure = await browser.newContext({ viewport: { width: 320, height: 750 } });
  await mockOnline(failure, () => true);
  const failed = await failure.newPage(); await failed.goto(base); await openBackground(failed);
  await button(failed, "风景沉浸").click();
  await failed.getByRole("alert").filter({ hasText: "壁纸未能加载" }).waitFor();
  assert.equal((await readState(failed)).preferences?.style ?? "paper", "paper");
  await button(failed, "重新加载壁纸").click();
  await failed.getByRole("alert").filter({ hasText: "壁纸未能加载" }).waitFor();
  await button(failed, "使用本地图片").click();
  await failed.locator('input[accept="image/jpeg,image/png,image/webp"]').setInputFiles({ name: "离线恢复.png", mimeType: "image/png", buffer: image });
  await button(failed, "使用 离线恢复.png").waitFor(); await back(failed);
  await failed.locator(".background-photo .background-layer img").waitFor();
  console.log("PASS: failed download leaves original background and supports upload recovery.");
  await failure.close();

  const retryContext = await browser.newContext();
  const retryPage = await retryContext.newPage();
  await retryPage.goto(base); await openBackground(retryPage);
  await retryPage.evaluate(() => {
    window.originalWallpaperPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "preferences") throw new DOMException("存储空间不足", "QuotaExceededError");
      return window.originalWallpaperPut.apply(this, args);
    };
  });
  await button(retryPage, "流彩渐变").click();
  await retryPage.getByRole("alert").filter({ hasText: "存储空间不足" }).first().waitFor();
  await button(retryPage, "整体样式").click();
  await retryPage.getByRole("alert").filter({ hasText: "存储空间不足" }).waitFor();
  await retryPage.evaluate(() => { IDBObjectStore.prototype.put = window.originalWallpaperPut; });
  await button(retryPage, "重试").click();
  await waitState(retryPage, s => s.preferences?.style === "gradient", "background failures survive navigation and retry");
  await retryPage.reload(); await retryPage.locator(".background-gradient").waitFor();
  console.log("PASS: failed background writes remain retryable after section navigation.");
  await retryContext.close();
} catch (error) {
  for (const context of browser.contexts()) { const page = context.pages()[0]; if (page) await page.screenshot({ path: fileURLToPath(new URL("failure.png", output)), fullPage: true }).catch(() => {}); }
  throw error;
} finally { await browser.close(); await server.close(); }
