import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";

const { chromium } = await import(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH ? pathToFileURL(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH).href : "playwright");
const image = await readFile(new URL("../public/icons/128x128.png", import.meta.url));
const markup = '<!doctype html><div id="root"></div><script type="module" src="/scripts/wallpaper-race-harness.tsx"></script>';
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 }, logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client"] },
  plugins: [{ name: "wallpaper-race-test", configureServer(dev) {
    dev.middlewares.use("/__wallpaper_race_test__", async (request, response) => {
      response.setHeader("Content-Type", "text/html");
      response.end(await dev.transformIndexHtml(request.url ?? "/", markup));
    });
  } }],
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/__wallpaper_race_test__`;
const browser = await chromium.launch({ headless: true, ...(process.env.SCHEDULEPIN_BROWSER_PATH ? { executablePath: process.env.SCHEDULEPIN_BROWSER_PATH } : {}) });

try {
  await test("刷新 open 模式排除 session 中上一张图片", { timeout: 30000 }, async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); await page.goto(base);
      await page.waitForFunction(() => typeof window.mountBackground === "function");
      await page.evaluate(async () => {
        const store = await import("/src/backgroundStore.ts");
        const item = id => ({ id, title: id, source: "commons", favorite: true, createdAt: Date.now(), blob: new Blob([id]), thumbnail: new Blob([id]), author: "", sourceUrl: "", license: "", licenseUrl: "", accent: "" });
        await store.saveBackground({ style: "photo", mode: "open", pool: "favorites", currentId: "a" }, [item("a"), item("b")]);
        sessionStorage.setItem("schedulepin.background.window-current.v1", "b");
        Math.random = () => 0;
        window.mountBackground();
      });
      // The persisted fallback is also a; waiting for session to change proves rotation finished.
      await page.waitForFunction(() => sessionStorage.getItem("schedulepin.background.window-current.v1") === "a");
      assert.equal(await page.locator("output").getAttribute("data-current"), "a");
      assert.equal(await page.evaluate(() => window.background.error), "");
    } finally { await context.close(); }
  });

  for (const operation of ["pin", "reset"]) {
    await test(`下载中另一窗口${operation === "pin" ? "固定" : "恢复默认"}后丢弃过期图片`, { timeout: 30000 }, async () => {
      const context = await browser.newContext();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      try {
        const page = await context.newPage(), other = await context.newPage();
        await context.route("https://commons.wikimedia.org/w/api.php*", route => route.fulfill({ json: { query: { pages: { 7: { pageid: 7, title: "File:stale.jpg", imageinfo: [{ mime: "image/jpeg", width: 1800, thumburl: "https://thumb.wikimedia.org/stale.jpg", descriptionurl: "https://commons.wikimedia.org/wiki/File:stale.jpg", extmetadata: { Artist: { value: "tester" }, LicenseShortName: { value: "CC0" } } }] } } } } }));
        await context.route("https://thumb.wikimedia.org/stale.jpg", async route => { await gate; await route.fulfill({ contentType: "image/png", body: image }); });
        await page.goto(base); await other.goto(base); await page.bringToFront();
        await page.waitForFunction(() => typeof window.mountBackground === "function");
        const downloading = page.waitForRequest("https://thumb.wikimedia.org/stale.jpg", { timeout: 10000 });
        await page.evaluate(async () => {
          const store = await import("/src/backgroundStore.ts");
          await store.saveBackground({ style: "photo", mode: "open", pool: "online", currentId: null });
          window.mountBackground();
        });
        await downloading;
        await other.evaluate(async operation => {
          const store = await import("/src/backgroundStore.ts");
          if (operation === "reset") await store.resetBackground();
          else await store.pinWallpaper({ id: "pin", title: "pin", source: "local", favorite: false, createdAt: Date.now(), blob: new Blob(["pin"]), thumbnail: new Blob(["pin"]), author: "", sourceUrl: "", license: "", licenseUrl: "", accent: "" });
        }, operation);
        await page.waitForFunction(operation => window.background.preferences.mode === (operation === "pin" ? "fixed" : "daily"), operation);
        await page.evaluate(() => {
          window.finishedWallpaperTransactions = 0;
          const transaction = IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction = function (...args) {
            const tx = transaction.apply(this, args);
            tx.addEventListener("complete", () => { window.finishedWallpaperTransactions++; });
            return tx;
          };
        });
        release();
        // Wait for the actual post-download revision-check transaction, not an arbitrary delay.
        await page.waitForFunction(() => window.finishedWallpaperTransactions > 0);
        assert.equal(await page.locator("output").getAttribute("data-current"), operation === "pin" ? "pin" : "");
        assert.equal(await page.evaluate(() => window.background.error), "", "image decoded successfully before stale result was rejected");
        assert.equal(await page.evaluate(async () => (await (await import("/src/backgroundStore.ts")).readBackground()).wallpapers.some(item => item.id === "commons-7")), false);
      } finally { release(); await context.close(); }
    });
  }
} finally { await browser.close(); server.httpServer.closeAllConnections?.(); await server.close(); }
