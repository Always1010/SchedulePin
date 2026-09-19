import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/navigation.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const nav = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const link = (id, groupId = null) => ({ id, title: id, url: "https://example.com", groupId, pinned: false });

test("规范化网站地址，拒绝脚本协议和账户信息", () => {
  assert.equal(nav.normalizeLinkUrl(" example.com/docs "), "https://example.com/docs");
  assert.equal(nav.normalizeLinkUrl("localhost:3000/test"), "https://localhost:3000/test");
  assert.equal(nav.normalizeLinkUrl("http://localhost:3000"), "http://localhost:3000/");
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///C:/secret", "ftp://example.com", "https://user:password@example.com", "hello world", ""]) {
    assert.throws(() => nav.normalizeLinkUrl(url));
  }
});
test("删除分组保留链接及其固定状态", () => {
  const original = { groups: [{ id: "g", name: "工作" }], links: [{ ...link("a", "g"), pinned: true }, link("b")] };
  const next = nav.applyNavigationAction(original, { type: "delete-group", id: "g" });
  assert.equal(next.links.length, 2);
  assert.equal(next.links[0].groupId, null);
  assert.equal(next.links[0].pinned, true);
  assert.equal(original.links[0].groupId, "g");
});
test("名称留空跟随域名，编辑网址不会固化旧域名，自定义名称保留", () => {
  const saved = nav.applyNavigationAction(nav.emptyNavigation(), { type: "save-link", link: { ...link("a"), title: "  ", url: "https://www.example.com/article/123" } });
  assert.equal(saved.links[0].title, "");
  assert.equal(nav.linkTitle(saved.links[0]), "example.com");
  const updated = nav.applyNavigationAction(saved, { type: "save-link", link: { ...saved.links[0], url: "docs.example.org/start" } });
  assert.equal(nav.linkTitle(updated.links[0]), "docs.example.org");
  assert.equal(nav.linkTitle({ title: "我的文档", url: "https://docs.example.org" }), "我的文档");
  assert.equal(nav.linkDomain("https://www2.example.org/path"), "www2.example.org");
  assert.throws(() => nav.applyNavigationAction(saved, { type: "save-group", group: { id: "g", name: "  " } }));
});
test("编辑、排序和固定不改变链接身份或其他记录", () => {
  const data = { groups: [], links: [link("a"), link("b"), link("c")] };
  const moved = nav.applyNavigationAction(data, { type: "move-link", id: "a", neighborId: "c" });
  assert.deepEqual(moved.links.map(row => row.id), ["c", "b", "a"]);
  const edited = nav.applyNavigationAction(moved, { type: "save-link", link: { ...link("b", "removed"), title: " 编辑后 ", url: "example.org" } });
  assert.equal(edited.links[1].title, "编辑后");
  assert.equal(edited.links[1].url, "https://example.org/");
  assert.equal(edited.links[1].groupId, null);
  assert.equal(nav.applyNavigationAction(edited, { type: "pin-link", id: "b", pinned: true }).links[1].pinned, true);
  assert.throws(() => nav.applyNavigationAction({ groups: [{ id: "g", name: "工作" }], links: [] }, { type: "save-group", group: { id: "new", name: "工作" } }));
});
test("并发写入合并最新数据，导航写入不触及任务和主题", async () => {
  const values = { "schedulepin.items.v2": [{ id: "old-task" }], "schedulepin.settings.v2": { theme: "dark" } };
  const original = structuredClone(values);
  const changed = [];
  const listeners = new Set();
  const queues = new Map();
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request(key, run) {
    const promise = (queues.get(key) ?? Promise.resolve()).then(run);
    queues.set(key, promise.catch(() => {})); return promise;
  } } } });
  globalThis.chrome = { storage: {
    local: { async get(key) { return structuredClone({ [key]: values[key] }); }, async set(patch) {
      Object.assign(values, structuredClone(patch)); changed.push(...Object.keys(patch));
      for (const listener of listeners) listener(patch);
    } },
    onChanged: { addListener(fn) { listeners.add(fn); }, removeListener(fn) { listeners.delete(fn); } },
  } };
  let refreshes = 0;
  const unsubscribe = nav.subscribeNavigation(() => refreshes++);
  await Promise.all(["a", "b"].map(id => nav.changeNavigation({ type: "save-link", link: link(id) })));
  assert.equal((await nav.loadNavigation()).links.length, 2);
  await Promise.all([nav.changeNewTabPreferences({ side: "right" }), nav.changeNewTabPreferences({ tasksVisible: false })]);
  const prefs = await nav.loadNewTabPreferences();
  assert.equal(prefs.side, "right"); assert.equal(prefs.tasksVisible, false);
  assert.equal(prefs.principleExpanded, true);
  assert.deepEqual(values["schedulepin.items.v2"], original["schedulepin.items.v2"]);
  assert.deepEqual(values["schedulepin.settings.v2"], original["schedulepin.settings.v2"]);
  assert.ok(changed.every(key => [nav.NAVIGATION_KEY, nav.NEWTAB_KEY].includes(key)));
  assert.equal(refreshes, 4); unsubscribe(); assert.equal(listeners.size, 0);
});
