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
test("旧轮换设置可迁移，并记住解除固定后要恢复的方式",()=>{
  assert.equal(model.cleanBackground({mode:"open"}).rotationMode,"open");
  assert.equal(model.cleanBackground({mode:"fixed"}).rotationMode,"daily");
  assert.equal(model.cleanBackground({mode:"fixed",rotationMode:"open"}).rotationMode,"open");
});
test("我的壁纸只包含主动保留的图片",()=>{
  const wallpaper={id:"a",title:"",author:"",sourceUrl:"",license:"",licenseUrl:"",source:"commons",favorite:false,createdAt:0,blob:{},thumbnail:{},accent:""};
  assert.equal(model.isSavedWallpaper(wallpaper),false);
  assert.equal(model.isSavedWallpaper({...wallpaper,favorite:true}),true);
  assert.equal(model.isSavedWallpaper({...wallpaper,retained:true}),true);
  assert.equal(model.isSavedWallpaper({...wallpaper,source:"local"}),true);
});
test("恢复背景默认值保留全局外观和图库无关设置",()=>{
  const current=model.cleanBackground({revision:7,style:"photo",appearance:"dark",accent:"violet",mode:"fixed",rotationMode:"open",currentId:"wall",overlay:70,blur:12,panelOpacity:73,principleFollow:true,positions:{wall:{landscape:{x:2,y:3},portrait:{x:4,y:5}}}});
  const reset=model.resetBackgroundPreferences(current);
  assert.equal(reset.revision,8);assert.equal(reset.style,"paper");assert.equal(reset.mode,"daily");assert.equal(reset.currentId,null);
  assert.equal(reset.overlay,28);assert.equal(reset.blur,0);assert.deepEqual(reset.positions,{});
  assert.equal(reset.appearance,"dark");assert.equal(reset.accent,"violet");assert.equal(reset.panelOpacity,73);assert.equal(reset.principleFollow,true);
});
