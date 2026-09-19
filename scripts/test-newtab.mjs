import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, preview } from "vite";

// Use a normal Playwright installation, or an existing desktop runtime without copying its files.
const { chromium } = await import(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH
  ? pathToFileURL(process.env.SCHEDULEPIN_PLAYWRIGHT_PATH).href : "playwright");
await build({ logLevel: "error" });
const server = await preview({ preview: { host: "127.0.0.1", port: 0, strictPort: false }, logLevel: "error" });
const address = server.httpServer.address();
const base = `http://127.0.0.1:${address.port}`;
const icon = await readFile(new URL("../public/icons/32x32.png", import.meta.url));
const iconServer = createServer((_request, response) => { response.writeHead(200, { "Content-Type": "image/png" }); response.end(icon); });
await new Promise(resolve => iconServer.listen(0, "127.0.0.1", resolve));
const iconBase = `http://127.0.0.1:${iconServer.address().port}`;
const browser = await chromium.launch({ headless: true,
  // Block external test hosts at DNS level. Request interception can stall Chromium favicon loads.
  args: ["--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost"],
  ...(process.env.SCHEDULEPIN_BROWSER_PATH ? { executablePath: process.env.SCHEDULEPIN_BROWSER_PATH } : {}) });
const output = new URL("../.tools/ui-tests/", import.meta.url);
await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log("Loaded isolated app.");
  await page.getByRole("button", { name: "添加入口", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "查找网站入口", exact: true }).focus();
  assert.equal(await page.locator(".shortcut-search input").evaluate(el => getComputedStyle(el).outlineStyle), "none");
  assert.notEqual(await page.locator(".shortcut-search").evaluate(el => getComputedStyle(el).boxShadow), "none", "the whole search field retains a visible focus indicator");
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
  await page.getByRole("button", { name: "添加入口", exact: true }).click();
  await page.getByLabel("网址", { exact: true }).fill("https://www.example.org/article/1");
  assert.equal(await page.locator(".shortcut-entry-preview .shortcut-copy").textContent(), "example.org");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".shortcut-dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "整理", exact: true }).click();
  await page.getByRole("button", { name: "编辑 example.org", exact: true }).click();
  assert.equal(await page.getByLabel("名称", { exact: true }).inputValue(), "");
  await page.getByLabel("网址", { exact: true }).fill("https://docs.example.org/start");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".shortcut-dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "编辑 docs.example.org", exact: true }).waitFor();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "添加入口", exact: true }).click();
  await page.getByLabel("网址", { exact: true }).fill(iconBase);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".shortcut-dialog").waitFor({ state: "detached" });
  await page.locator(`a[href="${iconBase}/"] .site-icon.has-image`).waitFor();
  assert.equal(await page.locator('a[href="https://docs.example.org/start"] .site-icon-letter').textContent(), "D");
  assert.equal(await page.locator(`a[href="${iconBase}/"] img`).getAttribute("referrerpolicy"), "no-referrer");
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
  await page.screenshot({ path: fileURLToPath(new URL("landscape.png", output)), fullPage: true });
  await page.setViewportSize({ width: 1080, height: 1500 });
  await page.screenshot({ path: fileURLToPath(new URL("portrait.png", output)), fullPage: true });
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
  const handle = page.getByRole("button", { name: "拖动 待办任务 2 调整顺序", exact: true });
  await handle.focus(); await handle.press("Space");
  await page.locator('[data-task-id="qa-1"].dragging').waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await handle.press("ArrowDown");
  await page.waitForFunction(() => [...document.querySelectorAll('[aria-live]')].some(el => el.textContent.includes("over droppable area qa-2")));
  await handle.press("Space");
  await page.waitForFunction(() => {
    const tasks = JSON.parse(localStorage.getItem("schedulepin.items.v2"));
    return tasks.find(row => row.id === "qa-1").sortOrder === 2;
  });
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
  await page.setViewportSize({ width: 1440, height: 1100 });
  console.log("PASS: layout, task editing and keyboard reorder.");
  await page.getByRole("button", { name: "整理", exact: true }).click();
  await page.getByRole("button", { name: "编辑 网站入口 1", exact: true }).click();
  await page.getByLabel("名称", { exact: true }).fill("办公文档");
  await page.getByLabel("分组", { exact: true }).selectOption("work");
  await page.getByLabel("固定到常用入口", { exact: true }).uncheck();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".shortcut-dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "重命名分组 工作", exact: true }).click();
  await page.getByLabel("名称", { exact: true }).fill("办公");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".shortcut-dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "删除分组 办公，保留链接", exact: true }).click();
  await page.getByRole("button", { name: "编辑 办公文档", exact: true }).waitFor();
  const storedLink = await page.evaluate(() => JSON.parse(localStorage.getItem("schedulepin.navigation.v1")).links.find(row => row.id === "link-0"));
  assert.equal(storedLink.groupId, null); assert.equal(storedLink.pinned, false);
  await page.getByRole("button", { name: "下移 网站入口 2", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("schedulepin.navigation.v1")).links[1].id === "link-2");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("textbox", { name: "查找网站入口", exact: true }).fill("办公");
  assert.equal(await page.locator(".shortcut-row").count(), 1);
  await page.getByRole("button", { name: "清除查找", exact: true }).click();
  const other = await context.newPage(); await other.goto(base); await other.locator(".shortcut-row").first().waitFor();
  await page.getByRole("button", { name: "整理", exact: true }).click();
  await page.getByRole("button", { name: "删除 网站入口 3", exact: true }).click();
  await other.locator('.shortcut-row a[href="https://example.com/2"]').waitFor({ state: "detached" });
  await other.close();
  await page.getByRole("button", { name: "完成", exact: true }).click();

  console.log("PASS: navigation groups, ordering and cross-tab update.");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator(".appearance-entry").click();
  const preview = page.frameLocator(".appearance-preview-frame");
  await preview.locator(".newtab-workspace").waitFor();
  const settingsBeforePreview = await page.evaluate(() => localStorage.getItem("schedulepin.settings.v2"));
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await preview.locator(".app.theme-dark").waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("schedulepin.settings.v2")), settingsBeforePreview, "theme draft does not write storage");
  await page.getByRole("slider").first().press("End");
  await page.getByRole("slider", { name: "布局间距", exact: true }).press("End");
  await page.getByRole("button", { name: "竖屏", exact: true }).click();
  assert.equal(await preview.locator(".newtab-workspace").count(), 1);
  const previewColumns = await preview.locator(".newtab-workspace").evaluate(el => getComputedStyle(el).gridTemplateColumns);
  assert.ok(previewColumns.split(" ").length === 2);
  assert.equal(await preview.locator(".app").evaluate(el => el.style.getPropertyValue("--font-scale")), "1.25");
  await page.screenshot({ path: fileURLToPath(new URL("appearance-portrait.png", output)), fullPage: true });
  await page.getByRole("button", { name: "侧边栏", exact: true }).click();
  await preview.locator(".sidepanel-plan").waitFor();
  assert.equal(await preview.locator(".shortcut-panel").count(), 0);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem("schedulepin.settings.v2")), settingsBeforePreview);
  await page.locator(".appearance-entry").click();
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator(".settings-hub").waitFor();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.locator(".app.theme-dark .newtab-workspace").waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("dark.png", output)), fullPage: true });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator(".appearance-entry").click();
  await page.getByRole("button", { name: "明亮", exact: true }).click();
  await preview.locator(".app.theme-light").waitFor();
  const lightSurface = await preview.locator(".todo-card").evaluate(el => getComputedStyle(el).backgroundColor);
  assert.ok(lightSurface.includes("255, 255, 255"), "dark editor does not override light preview");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem("schedulepin.settings.v2"));
    localStorage.setItem("schedulepin.settings.v2", JSON.stringify({ ...settings, theme: "system", fontScale: 1.25, densityLevel: 100 }));
  });
  await page.emulateMedia({ colorScheme: "dark" }); await page.reload();
  await page.locator(".newtab-workspace").waitFor();
  const systemColor = await page.locator(".shortcut-panel").evaluate(el => getComputedStyle(el).color);
  assert.equal(systemColor, "rgb(238, 242, 239)");
  await page.setViewportSize({ width: 864, height: 1536 }); await beside();
  await page.setViewportSize({ width: 320, height: 700 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(({ iconBase }) => {
    const settings = JSON.parse(localStorage.getItem("schedulepin.settings.v2"));
    localStorage.setItem("schedulepin.settings.v2", JSON.stringify({ ...settings, theme: "warm", fontScale: 1, densityLevel: 50 }));
    const tasks = JSON.parse(localStorage.getItem("schedulepin.items.v2")).slice(0, 4);
    tasks[0].completed = true;
    localStorage.setItem("schedulepin.items.v2", JSON.stringify(tasks));
    localStorage.setItem("schedulepin.navigation.v1", JSON.stringify({ groups: [{ id: "work", name: "工作与学习" }], links: [
      { id: "real", title: "图标加载示例", url: iconBase, pinned: true, groupId: null },
      { id: "docs", title: "", url: "https://docs.example.com/start", pinned: true, groupId: null },
      { id: "read", title: "阅读笔记", url: "https://read.example.com", pinned: true, groupId: null },
      { id: "music", title: "", url: "https://music.example.com", pinned: false, groupId: "work" },
    ] }));
    localStorage.setItem("schedulepin.newtab.v1", JSON.stringify({ side: "right", showDomains: true, tasksVisible: true, principleExpanded: true, expandedGroups: ["work"] }));
  }, { iconBase });
  await page.setViewportSize({ width: 1080, height: 1400 });
  await page.reload(); await page.locator(".site-icon.has-image").waitFor();
  assert.ok(await page.evaluate(() => document.querySelector(".newtab-navigation").getBoundingClientRect().x >= document.querySelector(".newtab-plan-region").getBoundingClientRect().right - 1), "right-side navigation keeps portrait columns");
  assert.equal(await page.locator('a[href="https://docs.example.com/start"] .shortcut-copy small').count(), 0, "default domain is not repeated");
  assert.equal(await page.locator('a[href="https://read.example.com"] .shortcut-copy small').textContent(), "read.example.com");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const entry = page.locator(".shortcut-row a").first();
  await entry.hover();
  assert.equal(await entry.evaluate(el => getComputedStyle(el).transform), "none");
  await page.evaluate(() => { const prefs = JSON.parse(localStorage.getItem("schedulepin.newtab.v1")); localStorage.setItem("schedulepin.newtab.v1", JSON.stringify({ ...prefs, side: "left" })); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload(); await page.locator(".site-icon.has-image").waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("navigation-refresh.png", output)), fullPage: true });
  await page.getByRole("button", { name: "添加入口", exact: true }).click();
  await page.getByLabel("网址", { exact: true }).fill("https://www.example.com/article/1");
  await page.screenshot({ path: fileURLToPath(new URL("entry-editor.png", output)), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS: navigation editing/groups/order/cross-tab sync, three shared previews, draft cancel/save, dark/light/system themes, large text and compact fallback.");
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) await page.screenshot({ path: fileURLToPath(new URL("failure.png", output)), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); await server.close(); await new Promise(resolve => iconServer.close(resolve)); }
