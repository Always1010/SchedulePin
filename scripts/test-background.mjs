import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../src/backgroundModel.ts",import.meta.url),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const model=await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
test("固定模式不自动更换，每日模式只在跨日时更换",()=>{
  const now=new Date(2026,8,19,12);const prefs={...model.defaultBackground,style:"photo",currentId:"a",lastDay:model.backgroundDay(now)};
  assert.equal(model.shouldRotate(prefs,now),false);
  assert.equal(model.shouldRotate(prefs,new Date(2026,8,20)),true);
  assert.equal(model.shouldRotate({...prefs,mode:"fixed"},new Date(2026,8,20)),false);
  assert.equal(model.shouldRotate({...prefs,mode:"open"},now),true);
  assert.equal(model.shouldRotate({...prefs,style:"gradient",mode:"open"},now),false);
});
test("裁切和透明度限制在可读范围，旧数据可补齐",()=>{
  const prefs=model.cleanBackground({panelOpacity:0,blur:100,overlay:-1,positions:{a:{portrait:{x:200,y:-50}}}});
  assert.equal(prefs.panelOpacity,60);assert.equal(prefs.blur,20);assert.equal(prefs.overlay,0);
  assert.deepEqual(prefs.positions.a,{landscape:{x:50,y:50},portrait:{x:100,y:0}});
  assert.equal(model.cleanBackground({}).style,"paper");
});
