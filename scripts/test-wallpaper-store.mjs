import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";

const playwrightPath=process.env.SCHEDULEPIN_PLAYWRIGHT_PATH??"C:/Users/always$$$/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs";
const {chromium}=await import(pathToFileURL(playwrightPath).href);
const server=await createServer({
  server:{host:"127.0.0.1",port:0},logLevel:"error",
  optimizeDeps:{noDiscovery:true},
  plugins:[{name:"wallpaper-store-test-page",configureServer(dev){dev.middlewares.use("/__wallpaper_store_test__",(_request,response)=>{response.setHeader("Content-Type","text/html");response.end("<!doctype html><title>store test</title>");});}}],
});
await server.listen();
const address=server.httpServer.address();
const base=`http://127.0.0.1:${typeof address==="object"&&address?address.port:5173}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.SCHEDULEPIN_BROWSER_PATH??"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});

const page=await browser.newPage();
await page.goto(`${base}/__wallpaper_store_test__`);
const result=await page.evaluate(async()=>{
  const store=await import("/src/backgroundStore.ts");
  const wallpaper=(id,extra={})=>({id,title:id,author:"",sourceUrl:"",license:"",licenseUrl:"",source:"commons",favorite:false,createdAt:Number(id.replace(/\D/g,""))||0,blob:new Blob([id]),thumbnail:new Blob([id]),accent:"",...extra});

  const pinned=wallpaper("pin");
  await store.saveBackground({style:"photo",mode:"open",appearance:"dark",accent:"violet",panelOpacity:73,principleFollow:true});
  const beforePin=await store.readBackground();
  const pinOk=await store.pinWallpaper(pinned,beforePin.preferences.revision);
  const afterPin=await store.readBackground();
  const resumeOk=await store.resumeWallpaperRotation(afterPin.preferences.revision);
  const afterResume=await store.readBackground();

  const staleRevision=afterResume.preferences.revision;
  await store.pinWallpaper(pinned,staleRevision);
  const staleCacheAccepted=await store.cacheWallpaperForWindow(wallpaper("stale-after-pin"),staleRevision);
  const afterStalePin=await store.readBackground();
  await store.resumeWallpaperRotation(afterStalePin.preferences.revision);

  const recovered=wallpaper("recovered");
  await store.favoriteWallpaper(recovered,true);
  const afterFavorite=await store.readBackground();

  const cache=Array.from({length:9},(_,index)=>wallpaper(`cache-${index+1}`));
  const retained=wallpaper("retained",{retained:true});
  await store.cacheWallpapers([...cache,retained]);
  await store.trimBackgroundCache();
  const afterTrim=await store.readBackground();

  let libraryChanges=0;const stop=store.subscribeBackground(change=>{if(change==="library")libraryChanges++;});
  await store.retainWallpapers([wallpaper("imported")]);stop();

  const legacy=wallpaper("legacy-fixed");
  await store.saveBackground({mode:"fixed",currentId:legacy.id},[legacy]);
  const migratedLegacy=await store.readBackground();

  const resetOk=await store.resetBackground(migratedLegacy.preferences.revision);
  const afterReset=await store.readBackground();
  await store.saveBackground({style:"photo",mode:"open"});
  const beforeConcurrentReset=await store.readBackground();
  await store.resetBackground(beforeConcurrentReset.preferences.revision);
  const staleAfterResetAccepted=await store.cacheWallpaperForWindow(wallpaper("stale-after-reset"),beforeConcurrentReset.preferences.revision);
  const afterConcurrentReset=await store.readBackground();
  return {
    pinOk,resumeOk,resetOk,
    staleCacheAccepted,
    staleCached:Boolean(afterStalePin.wallpapers.find(item=>item.id==="stale-after-pin")),
    staleAfterResetAccepted,
    staleAfterResetCached:Boolean(afterConcurrentReset.wallpapers.find(item=>item.id==="stale-after-reset")),
    pinned:afterPin.wallpapers.find(item=>item.id==="pin"),
    pinMode:afterPin.preferences.mode,
    resumedMode:afterResume.preferences.mode,
    recovered:afterFavorite.wallpapers.find(item=>item.id==="recovered"),
    cacheCount:afterTrim.wallpapers.filter(item=>item.id.startsWith("cache-")).length,
    retained:Boolean(afterTrim.wallpapers.find(item=>item.id==="retained")),
    libraryChanges,
    migratedLegacy:migratedLegacy.wallpapers.find(item=>item.id==="legacy-fixed"),
    reset:afterConcurrentReset.preferences,
    libraryIds:afterConcurrentReset.wallpapers.map(item=>item.id),
  };
});

test("固定、解除固定、收藏恢复和缓存清理写入 IndexedDB",()=>{
  assert.equal(result.pinOk,true);assert.equal(result.pinMode,"fixed");assert.equal(result.pinned.retained,true);
  assert.equal(result.resumeOk,true);assert.equal(result.resumedMode,"open");
  assert.equal(result.staleCacheAccepted,false);assert.equal(result.staleCached,false);
  assert.equal(result.staleAfterResetAccepted,false);assert.equal(result.staleAfterResetCached,false);
  assert.equal(result.recovered.favorite,true);
  assert.equal(result.cacheCount,6);assert.equal(result.retained,true);
  assert.equal(result.libraryChanges,1);assert.equal(result.migratedLegacy.retained,true);
});
test("恢复默认只重置背景域并保留壁纸库",()=>{
  assert.equal(result.resetOk,true);assert.equal(result.reset.style,"paper");assert.equal(result.reset.currentId,null);
  assert.equal(result.reset.appearance,"dark");assert.equal(result.reset.accent,"violet");assert.equal(result.reset.panelOpacity,73);assert.equal(result.reset.principleFollow,true);
  assert.ok(result.libraryIds.includes("pin"));assert.ok(result.libraryIds.includes("recovered"));assert.ok(result.libraryIds.includes("retained"));assert.ok(result.libraryIds.includes("legacy-fixed"));assert.ok(result.libraryIds.includes("imported"));
});

await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,2000))]);
server.httpServer.closeAllConnections?.();
await Promise.race([server.close(),new Promise(resolve=>setTimeout(resolve,2000))]);
process.exit(0);
