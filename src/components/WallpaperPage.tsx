import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, Upload, Download, Trash2, Check, Lock, RotateCcw } from "lucide-react";
import type { AppSettings, PlanItem } from "../types";
import type { NavigationData, NewTabPreferences } from "../navigation";
import { backgroundDay, isSavedWallpaper, type BackgroundPreferences, type Wallpaper } from "../backgroundModel";
import { discoverWallpapers, downloadWallpaper, prepareWallpaper, type OnlineWallpaper } from "../backgroundSource";
import { cacheWallpapers, deleteWallpaper, favoriteWallpaper, pinWallpaper, readBackground, resetBackground, resumeWallpaperRotation, retainWallpapers, saveBackground, trimBackgroundCache } from "../backgroundStore";
import { exportWallpapers, importWallpapers } from "../backgroundBackup";
import { useBlobUrl } from "../useBackground";
import { useAutosave } from "../useAutosave";
import { AppearancePreview, type PreviewMode } from "./AppearancePreview";
import "./wallpaper-page.css";

function WallpaperThumb({ item }: { item: Wallpaper }) {
  const src = useBlobUrl(item.thumbnail);
  return <img src={src} alt="" loading="lazy" />;
}
interface Props {
  preferences: BackgroundPreferences; wallpapers: Wallpaper[]; current?: Wallpaper;
  settings: AppSettings; tasks: PlanItem[]; navigation: NavigationData; navigationPreferences: NewTabPreferences;
  onBack: () => void; onWindowCurrent: (item?: Wallpaper) => void; embedded?: boolean;
  autosave?: ReturnType<typeof useAutosave<BackgroundPreferences>>;
}
export function WallpaperPage({ preferences, wallpapers, current, settings, tasks, navigation, navigationPreferences, onBack, onWindowCurrent, embedded = false, autosave: sharedAutosave }: Props) {
  const localAutosave = useAutosave(preferences, saveBackground);
  const autosave = sharedAutosave ?? localAutosave;
  const { draft, patch } = autosave;
  const [selected, setSelected] = useState(current ?? wallpapers.find(w => w.id === preferences.currentId));
  const [tab, setTab] = useState<"style" | "rotation" | "library" | "online">("style");
  const [mode, setMode] = useState<PreviewMode>("newtab");
  const [online, setOnline] = useState<OnlineWallpaper[]>([]);
  const [offset, setOffset] = useState(0);
  const [onlineCategory, setOnlineCategory] = useState(preferences.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const upload = useRef<HTMLInputElement>(null), backup = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const operationRevision = useRef(preferences.revision);
  const committed = (ok: boolean) => { if (!ok) throw new Error("设置已在其他页面更新，本次操作未覆盖新设置，请重试。"); };
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setSelected(current ?? wallpapers.find(w => w.id === preferences.currentId)); }, [current, wallpapers, preferences.currentId]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await autosave.flush(); operationRevision.current = (await readBackground()).preferences.revision; await fn(); }
    catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : "操作失败，请重试。"); }
    finally { if (active.current) setBusy(false); }
  };
  const choose = async (item: Wallpaper, fixed = false) => {
    if (!active.current) return;
    if (fixed || draft.mode === "fixed") {
      committed(await pinWallpaper(item, operationRevision.current)); onWindowCurrent(undefined);
    } else {
      committed(await saveBackground({ style: "photo", currentId: item.id, lastDay: backgroundDay() }, [item], operationRevision.current));
      onWindowCurrent(draft.mode === "open" ? item : undefined);
    }
    setSelected(item); setPhotoFailed(false); await trimBackgroundCache();
  };
  const selectPhoto = () => void run(async () => {
    let item = selected ?? [...wallpapers].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!item) {
      try { const [source] = await discoverWallpapers(draft.category); item = await downloadWallpaper(source); }
      catch { setPhotoFailed(true); throw new Error("壁纸未能加载，当前背景未更改。请重试，或上传本地图片。"); }
    }
    await choose(item);
  });
  const onlineAction = (source: OnlineWallpaper, action: "use" | "favorite" | "pin") => void run(async () => {
    const item = wallpapers.find(w => w.id === source.id) ?? await downloadWallpaper(source);
    if (!active.current) return;
    if (action === "favorite") { await favoriteWallpaper(item, true); setNotice("已加入我的壁纸。"); }
    else await choose(item, action === "pin");
  });
  const restore = () => void run(async () => {
    committed(await resetBackground(operationRevision.current)); onWindowCurrent(undefined); setSelected(undefined); setPhotoFailed(false);
    setNotice("已恢复背景默认设置，保留我的壁纸。");
  });
  const library = wallpapers.filter(isSavedWallpaper);
  const selectedRecord = selected && (wallpapers.find(w => w.id === selected.id) ?? selected);
  const positionMode = mode === "portrait" ? "portrait" : "landscape";
  const positions = draft.positions[selected?.id ?? ""] ?? { landscape: { x: 50, y: 50 }, portrait: { x: 50, y: 50 } };
  const fixed = draft.mode === "fixed" && draft.style === "photo";
  return <section className={`wallpaper-page${embedded ? " wallpaper-embedded" : ""}`} aria-label="页面背景设置">
    <div className="wallpaper-page-topbar">
      <header className="wallpaper-page-heading">
        {!embedded && <><button type="button" disabled={busy} onClick={() => void run(async () => onBack())}><ArrowLeft size={16} />返回</button><div><h1>页面背景</h1><p>仅新标签页 · 修改后自动保存</p></div></>}
        <p className="wallpaper-save-status" role="status">{busy ? "正在处理，请稍候…" : autosave.status === "saving" ? "保存中…" : autosave.status === "error" ? "尚未保存" : "已保存"}</p>
        <button type="button" disabled={busy} onClick={restore}><RotateCcw size={15} />恢复背景默认设置</button>
      </header>
      {busy && !selected && <p className="wallpaper-feedback" role="status">正在准备壁纸，首次加载可能需要一些时间…</p>}
      {(error || autosave.error) && <p className="wallpaper-feedback" role="alert">{error || autosave.error}{autosave.status === "error" && <button type="button" onClick={() => void run(async () => {})}>重试保存</button>}</p>}
      {notice && <p className="wallpaper-feedback" role="status">{notice}</p>}
    </div>
    <div className="wallpaper-workspace">
      <section className="wallpaper-controls">
        <div className="wallpaper-tabs" role="tablist" aria-label="背景设置">
          {([["style", "背景效果"], ["rotation", "自动更换"], ["library", "我的壁纸"], ["online", "在线精选"]] as const).map(([value, label]) => <button type="button" role="tab" aria-selected={tab === value} key={value} onClick={() => setTab(value)}>{label}</button>)}
        </div>
        <fieldset disabled={busy}>
          {tab === "style" && <>
            <div className="wallpaper-style-options">{([["paper", "清爽纸感"], ["gradient", "流彩渐变"], ["photo", "风景沉浸"]] as const).map(([value, label]) => <button key={value} type="button" className={`wallpaper-style-swatch ${value}`} aria-pressed={draft.style === value} onClick={() => value === "photo" ? selectPhoto() : patch({ style: value })}><span />{label}{draft.style === value && <Check size={14} />}</button>)}</div>
            {(photoFailed || (draft.style === "photo" && !selected)) && <div className="wallpaper-photo-empty"><p className="wallpaper-help">图片加载成功后才会替换当前背景。</p><div className="wallpaper-library-actions"><button type="button" onClick={selectPhoto}>重新加载壁纸</button><button type="button" onClick={() => setTab("library")}>使用本地图片</button></div></div>}
            {draft.style === "photo" ? <>
              {([["overlay", "背景遮罩", 0, 80], ["blur", "壁纸模糊", 0, 20]] as const).map(([key, label, min, max]) => <label key={key}>{label} · {draft[key]}{key === "blur" ? "px" : "%"}<input aria-label={label} type="range" min={min} max={max} value={draft[key]} onChange={e => patch({ [key]: Number(e.target.value) })} /></label>)}
              {selected && <><h2 className="wallpaper-section-title">图片裁切</h2><p className="wallpaper-help">{positionMode === "portrait" ? "竖屏" : "横屏"}位置 · 切换预览可分别设置</p>{(["x", "y"] as const).map(axis => <label key={axis}>{axis === "x" ? "水平位置" : "垂直位置"}<input type="range" aria-label={axis === "x" ? "壁纸水平位置" : "壁纸垂直位置"} min="0" max="100" value={positions[positionMode][axis]} onChange={e => patch({ positions: { ...draft.positions, [selected.id]: { ...positions, [positionMode]: { ...positions[positionMode], [axis]: Number(e.target.value) } } } })} /></label>)}</>}
            </> : <p className="wallpaper-help">选择纸感或渐变即可应用。图片背景还可以调整遮罩、模糊和横竖屏裁切。</p>}
          </>}
          {tab === "rotation" && (draft.style !== "photo" ? <p className="wallpaper-help">使用图片背景后，可设置自动更换。</p> : <>
            <label className="wallpaper-check"><input type="checkbox" aria-label="自动更换壁纸" checked={!fixed} disabled={!selected} onChange={e => void run(async () => { if (e.target.checked) await resumeWallpaperRotation(); else if (selected) await pinWallpaper(selected); onWindowCurrent(undefined); })} />自动更换壁纸</label>
            {fixed ? <p className="wallpaper-help">当前图片已固定并加入我的壁纸。开启自动更换后，图片仍会保留。</p> : <>
              <label>更换频率<select aria-label="更换频率" value={draft.mode} onChange={e => { const value = e.target.value as "daily" | "open"; patch({ mode: value, rotationMode: value, lastDay: backgroundDay() }); }}><option value="daily">每日更换</option><option value="open">每次打开或刷新时更换</option></select></label>
              <label>轮换来源<select aria-label="轮换来源" value={draft.pool} onChange={e => patch({ pool: e.target.value as BackgroundPreferences["pool"] })}><option value="online">在线精选</option><option value="favorites">我的壁纸</option></select></label>
              {draft.pool === "online" && <label>在线分类<select aria-label="在线分类" value={draft.category} onChange={e => patch({ category: e.target.value as BackgroundPreferences["category"] })}><option value="nature">自然</option><option value="city">城市</option><option value="abstract">抽象</option></select></label>}
              <p className="wallpaper-help">自动更换不会加入我的壁纸。每次打开或刷新时更换，仅改变当前标签页的图片。</p>
            </>}
          </>)}
          {tab === "library" && <>
            <div className="wallpaper-library-actions"><button type="button" onClick={() => upload.current?.click()}><Upload size={15} />上传图片</button><button type="button" onClick={() => void run(async () => { await exportWallpapers(library); setNotice("已导出我的壁纸，包含图片和来源信息。"); })}><Download size={15} />导出我的壁纸</button><button type="button" onClick={() => backup.current?.click()}>导入备份</button></div>
            <p className="wallpaper-help">只保留你收藏、固定、上传或导入的图片，可离线使用。上传支持 20 MB 以内的 JPG / PNG / WebP。</p>
            {!library.length && <p className="wallpaper-help">还没有保留的壁纸。收藏或固定喜欢的图片，也可以上传自己的图片。</p>}
            <div className="wallpaper-grid">{library.map(item => <article key={item.id} className={draft.style === "photo" && selected?.id === item.id ? "selected" : ""}>
              <button type="button" className="wallpaper-thumbnail" aria-label={`使用 ${item.title}`} onClick={() => void run(() => choose(item))}><WallpaperThumb item={item} /><span>{item.title}</span></button>
              <div className="wallpaper-card-actions"><button type="button" aria-label={`${item.favorite ? "取消收藏" : "收藏"} ${item.title}`} aria-pressed={item.favorite} onClick={() => void run(() => favoriteWallpaper(item, !item.favorite))}><Heart size={14} /></button><small>{draft.style === "photo" && selected?.id === item.id ? fixed ? "已固定" : "正在使用" : item.favorite ? "已收藏" : "已保留"}</small><button type="button" aria-label={`固定 ${item.title}`} onClick={() => void run(() => choose(item, true))}><Lock size={14} /></button><button type="button" disabled={selected?.id === item.id || preferences.currentId === item.id} aria-label={`删除 ${item.title}`} onClick={() => void run(() => deleteWallpaper(item.id))}><Trash2 size={14} /></button></div>
            </article>)}</div>
          </>}
          {tab === "online" && <>
            <label>浏览分类<select aria-label="浏览分类" value={onlineCategory} onChange={e => { setOnlineCategory(e.target.value as BackgroundPreferences["category"]); setOnline([]); setOffset(0); }}><option value="nature">自然</option><option value="city">城市</option><option value="abstract">抽象</option></select></label>
            <button type="button" onClick={() => void run(async () => { const list = await discoverWallpapers(onlineCategory, offset); if (active.current) { setOnline(list); setOffset(offset + 12); } })}>{online.length ? "换一批" : "加载在线精选"}</button>
            <p className="wallpaper-help">来自 Wikimedia Commons。使用图片保持当前换图规则；收藏或固定才会加入我的壁纸。</p>
            <div className="wallpaper-grid">{online.map(item => <article key={item.id}>
              <button type="button" className="wallpaper-thumbnail" aria-label={`使用 ${item.title}`} onClick={() => onlineAction(item, "use")}><img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /><span>{item.title}</span></button>
              <small>{item.author} · {item.license}</small><a href={item.sourceUrl} target="_blank" rel="noreferrer">来源与许可</a>
              <div className="wallpaper-card-actions"><button type="button" aria-label={`收藏 ${item.title}`} onClick={() => onlineAction(item, "favorite")}><Heart size={14} />收藏</button><button type="button" aria-label={`固定 ${item.title}`} onClick={() => onlineAction(item, "pin")}><Lock size={14} />固定</button></div>
            </article>)}</div>
          </>}
          <input ref={upload} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void run(async () => { const item = await prepareWallpaper(file, { id: crypto.randomUUID(), title: file.name, source: "local", author: "", sourceUrl: "", license: "个人上传", licenseUrl: "", favorite: true, retained: true }); if (!active.current) return; await cacheWallpapers([item]); await choose(item); }); }} />
          <input ref={backup} hidden type="file" accept="application/json" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void run(async () => { const items = await importWallpapers(file); if (!active.current) return; await retainWallpapers(items); setNotice(`已导入 ${items.length} 张壁纸。`); }); }} />
        </fieldset>
      </section>
      <section className="wallpaper-preview">
        <div className="wallpaper-preview-modes">{([["newtab", "横屏"], ["portrait", "竖屏"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>
        <AppearancePreview settings={settings} tasks={tasks} navigation={navigation} preferences={navigationPreferences} mode={mode} background={draft} wallpaper={selectedRecord} />
        {draft.style === "photo" && selectedRecord && <div className="wallpaper-attribution">
          <strong>当前背景 · {selectedRecord.title}</strong><span>{selectedRecord.author && `${selectedRecord.author} · `}{selectedRecord.license} · {fixed ? "已固定" : "正在使用"}</span>
          {selectedRecord.sourceUrl && <a href={selectedRecord.sourceUrl} target="_blank" rel="noreferrer">图片来源</a>}{selectedRecord.licenseUrl && <a href={selectedRecord.licenseUrl} target="_blank" rel="noreferrer">许可说明</a>}
          <button type="button" disabled={busy} aria-pressed={selectedRecord.favorite} onClick={() => void run(async () => { await favoriteWallpaper(selectedRecord, !selectedRecord.favorite); setNotice(selectedRecord.favorite ? "已取消收藏。" : "已收藏图片，可离线使用。"); })}><Heart size={14} />{selectedRecord.favorite ? "取消收藏" : "收藏这张"}</button>
          <button type="button" disabled={busy} aria-pressed={fixed} onClick={() => void run(async () => { if (fixed) await resumeWallpaperRotation(); else await pinWallpaper(selectedRecord); onWindowCurrent(undefined); })}><Lock size={14} />{fixed ? "恢复自动更换" : "固定为壁纸"}</button>
        </div>}
      </section>
    </div>
  </section>;
}
