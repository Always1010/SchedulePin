import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/data.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const data = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
globalThis.window = new EventTarget();

test("首次启动没有旧原则时显示默认原则", async () => {
  values.clear();
  assert.equal((await data.loadSettings()).principle, data.defaultSettings.principle);
});
test("旧原则迁移保留内容并补全句号", async () => {
  values.clear();
  values.set(data.ITEMS_KEY, JSON.stringify([{ id: "legacy", kind: "discipline", title: "先完成再优化" }]));
  assert.equal((await data.loadSettings()).principle, "先完成再优化。");
});
test("用户已保存的文字、空字符串和主题不被默认值覆盖", async () => {
  for (const principle of ["我的原则", "", "。"]) {
    values.clear();
    values.set(data.SETTINGS_KEY, JSON.stringify({ principle, theme: "dark", fontScale: 1.2 }));
    const settings = await data.loadSettings();
    assert.equal(settings.principle, principle);
    assert.equal(settings.theme, "dark"); assert.equal(settings.fontScale, 1.2);
  }
});

test("连续局部保存不会覆盖其他设置或原则内容", async () => {
  values.clear();
  await data.saveSettings({ ...data.defaultSettings, principle: "保留我的原则", desktopEnabled: true });
  await Promise.all([
    data.patchSettings({ theme: "dark" }),
    data.patchSettings({ fontScale: 1.2 }),
    data.patchSettings({ cardRadius: 14 }),
  ]);
  const settings = await data.loadSettings();
  assert.equal(settings.theme, "dark");
  assert.equal(settings.fontScale, 1.2);
  assert.equal(settings.cardRadius, 14);
  assert.equal(settings.principle, "保留我的原则");
  assert.equal(settings.desktopEnabled, true);
});

test("局部保存失败后仍可重试，后续写入不会被失败队列阻断", async () => {
  values.clear();
  await data.saveSettings(data.defaultSettings);
  const original = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error("存储不可用"); };
  await assert.rejects(data.patchSettings({ theme: "dark" }), /存储不可用/);
  globalThis.localStorage.setItem = original;
  await data.patchSettings({ theme: "light" });
  assert.equal((await data.loadSettings()).theme, "light");
});
