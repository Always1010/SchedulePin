import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";

// Use a normal Playwright installation, or an existing desktop runtime without copying its files.
const { chromium } = await import(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH
  ? pathToFileURL(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH).href : "playwright");
const server = await createServer({ server: { host: "127.0.0.1", port: 0, strictPort: false }, logLevel: "error" });
await server.listen();
const address = server.httpServer.address();
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true,
  ...(process.env.SCHEDULEPIN_BROWSER_PATH ? { executablePath: process.env.SCHEDULEPIN_BROWSER_PATH } : {}) });
const output = new URL("../.tools/ui-tests/", import.meta.url);
await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole("button", { name: "添加入口", exact: true }).waitFor();
  assert.equal(await page.locator(".shortcut-row").count(), 0, "fresh install has no invented links");
  await page.getByRole("button", { name: "添加入口", exact: true }).click();
  await page.getByLabel("名称", { exact: true }).fill("项目入口");
  await page.getByLabel("网址", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".shortcut-dialog [role=alert]").waitFor();
  await page.getByLabel("网址", { exact: true }).fill("example.com/project");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".shortcut-dialog").waitFor({ state: "detached" });
  assert.equal(await page.locator(".shortcut-row a").first().getAttribute("href"), "https://example.com/project");
  await page.evaluate(() => {
    const now = new Date();
    const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    const tasks = Array.from({ length: 35 }, (_, i) => ({ id: `qa-${i}`, kind: "task", title: i === 2 ? "检查竖屏下长任务标题换行，完整内容应当可以阅读，不能被省略号截断。" : `待办任务 ${i + 1}`,
      scheduledDate: day, createdAt: now.toISOString(), startTime: null, endTime: null, priority: 0, recurringDaily: false, sortOrder: i,
      completed: false, completedDate: null, completedAt: null, archivedAt: null }));
    localStorage.setItem("schedulepin.items.v2", JSON.stringify(tasks));
    const navigation = { groups: [{ id: "work", name: "工作" }], links: Array.from({ length: 18 }, (_, i) => ({ id: `link-${i}`, title: `网站入口 ${i + 1}`, url: `https://example.com/${i}`, pinned: true, groupId: null })) };
    localStorage.setItem("schedulepin.navigation.v1", JSON.stringify(navigation));
  });
  await page.reload(); await page.locator(".task-row").first().waitFor();
  const oldSettings = await page.evaluate(() => localStorage.getItem("schedulepin.settings.v2"));
  const beside = async () => {
    const bounds = await page.evaluate(() => {
      const nav = document.querySelector(".newtab-navigation").getBoundingClientRect();
      const plan = document.querySelector(".newtab-plan-region").getBoundingClientRect();
      return { nav: { x: nav.x, right: nav.right, y: nav.y, width: nav.width }, plan: { x: plan.x, y: plan.y }, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(bounds.plan.x >= bounds.nav.right - 1 && Math.abs(bounds.plan.y - bounds.nav.y) < 1, "large portrait keeps columns beside each other");
    assert.ok(bounds.nav.width <= 261, "navigation stays compact");
    assert.equal(bounds.overflow, false);
  };
  for (const [width, height] of [[1920, 1080], [2560, 1440], [1080, 1920], [1440, 2560], [864, 1536], [736, 1000]]) {
    await page.setViewportSize({ width, height }); await beside();
    assert.equal(await page.locator(".task-row").count(), 35, "all tasks rendered");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: new URL("landscape.png", output).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
  await page.setViewportSize({ width: 1080, height: 1500 });
  await page.screenshot({ path: new URL("portrait.png", output).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
  await page.setViewportSize({ width: 864, height: 800 });
  await page.locator(".newtab-plan-region").evaluate(el => { el.scrollTop = 500; });
  assert.equal(await page.locator(".newtab-navigation").evaluate(el => el.scrollTop), 0, "plan scrolling does not scroll navigation");
  await page.locator(".newtab-navigation").evaluate(el => { el.scrollTop = 200; });
  assert.equal(await page.locator(".newtab-plan-region").evaluate(el => el.scrollTop), 500, "navigation scrolling does not move plan");
  await page.getByRole("button", { name: "收起待办", exact: true }).click();
  await page.locator(".newtab-quiet").waitFor();
  await page.reload(); await page.locator(".newtab-quiet").waitFor();
  const side = await context.newPage(); await side.goto(`${base}/?view=sidepanel`);
  await side.locator(".task-row").first().waitFor();
  assert.equal(await side.locator(".shortcut-panel").count(), 0);
  assert.equal(await side.locator(".task-row").count(), 35, "new-tab collapse does not hide side panel tasks");
  const full = await context.newPage(); await full.goto(`${base}/?view=plan`);
  await full.locator(".task-row").first().waitFor();
  assert.equal(await full.locator(".task-row").count(), 35, "full plan entry ignores new-tab collapse");
  await full.close();
  await side.close();
  await page.getByRole("button", { name: "展开全部待办", exact: true }).first().click();
  await page.locator(".plan-view").waitFor();
  await page.getByRole("button", { name: "收起 Principle", exact: true }).click();
  await page.reload(); await page.getByRole("button", { name: "展开 Principle", exact: true }).waitFor();
  await page.getByRole("button", { name: "展开 Principle", exact: true }).click();
  const row = page.locator('[data-task-id="qa-0"]');
  await row.getByRole("button", { name: "标记为完成", exact: true }).click();
  await row.getByRole("button", { name: "标记为未完成", exact: true }).waitFor();
  await row.locator(".task-title-button").click();
  await row.locator(".task-title-input").fill("重命名后的任务"); await row.locator(".task-title-input").press("Enter");
  await row.getByRole("button", { name: "归档 重命名后的任务", exact: true }).click();
  await row.waitFor({ state: "detached" });
  const input = page.getByRole("textbox", { name: "快速添加 To-Do", exact: true });
  await input.fill("新增待办验证"); await input.press("Enter");
  await page.getByRole("button", { name: "新增待办验证", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("schedulepin.settings.v2")), oldSettings, "layout and navigation preserve theme settings");
  assert.deepEqual(errors, []);
  console.log("PASS: URL editing, old settings, all tasks, six desktop sizes, independent scroll, preferences, side panel, task rename/archive/add.");
} finally { await browser.close(); await server.close(); }
