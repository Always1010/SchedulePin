import { useRef, useState } from "react";
import { ArrowLeft, Heart, Upload, Download, Trash2, Check } from "lucide-react";
import type { AppSettings, PlanItem } from "../types";
import type { NavigationData, NewTabPreferences } from "../navigation";
import { backgroundDay, type BackgroundPreferences, type Wallpaper } from "../backgroundModel";
import { discoverWallpapers, downloadWallpaper, prepareWallpaper, type OnlineWallpaper } from "../backgroundSource";
import { deleteWallpaper, favoriteWallpaper, saveBackground } from "../backgroundStore";
import { exportWallpapers, importWallpapers } from "../backgroundBackup";
import { useBlobUrl } from "../useBackground";
import { AppearancePreview, type PreviewMode } from "./AppearancePreview";
import "./wallpaper-page.css";

function WallpaperThumb({ item }: { item: Wallpaper }) { const src = useBlobUrl(item.thumbnail); return <img src={src} alt="" loading="lazy" />; }
export function WallpaperPage({ preferences, wallpapers, settings, tasks, navigation, navigationPreferences, onBack }: {
  preferences: BackgroundPreferences; wallpapers: Wallpaper[]; settings: AppSettings; tasks: PlanItem[]; navigation: NavigationData; navigationPreferences: NewTabPreferences; onBack: () => void;
}) {
  const [draft,setDraft] = useState(preferences); const [selected,setSelected] = useState<Wallpaper | undefined>(wallpapers.find(w=>w.id===preferences.currentId));
  const [tab,setTab] = useState<"style"|"library"|"online">("style"); const [mode,setMode] = useState<PreviewMode>("newtab");
  const [online,setOnline] = useState<OnlineWallpaper[]>([]); const [offset,setOffset] = useState(0); const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [notice,setNotice] = useState("");
  const upload = useRef<HTMLInputElement>(null), backup = useRef<HTMLInputElement>(null);
  const patch = (value: Partial<BackgroundPreferences>) => setDraft(p=>({...p,...value}));
  const run = async (fn:()=>Promise<void>) => { setBusy(true); setError(""); setNotice(""); try { await fn(); } catch(e) { setError(e instanceof Error ? e.message : "操作失败，请重试。"); } finally { setBusy(false); } };
  const choose = (item: Wallpaper) => { setSelected(item); patch({ style:"photo",currentId:item.id }); };
  const loadOnline = () => void run(async()=>{ const list = await discoverWallpapers(draft.category,offset); setOnline(list); setOffset(offset+12); });
  const positionMode = mode === "portrait" ? "portrait" : "landscape";
  const positions = draft.positions[draft.currentId ?? ""] ?? {landscape:{x:50,y:50},portrait:{x:50,y:50}};
  const favorite = selected && (wallpapers.find(w=>w.id===selected.id)?.favorite || selected.favorite);
  return <main className="wallpaper-page">
    <header className="wallpaper-page-heading"><button type="button" disabled={busy} onClick={onBack}><ArrowLeft size={16}/>取消</button><div><h1>背景与壁纸</h1><p>选择一种氛围，让新标签页更像你。</p></div><button type="button" className="wallpaper-save" disabled={busy || (draft.style==="photo"&&!selected)} onClick={()=>void run(async()=>{await saveBackground({...draft,lastDay:backgroundDay()},selected?[selected]:[]);onBack();})}>保存背景</button></header>
    {error && <p className="wallpaper-feedback" role="alert">{error}</p>}{notice && <p className="wallpaper-feedback" role="status">{notice}</p>}
    <div className="wallpaper-workspace"><section className="wallpaper-controls"><div className="wallpaper-tabs" role="tablist" aria-label="背景设置"><button role="tab" aria-selected={tab==="style"} onClick={()=>setTab("style")}>风格</button><button role="tab" aria-selected={tab==="library"} onClick={()=>setTab("library")}>我的壁纸</button><button role="tab" aria-selected={tab==="online"} onClick={()=>setTab("online")}>在线精选</button></div>
      <fieldset disabled={busy}>
      {tab==="style" && <>
        <div className="wallpaper-style-options">{([["paper","清爽纸感"],["gradient","流彩渐变"],["photo","风景沉浸"]] as const).map(([value,label])=><button key={value} type="button" className={`wallpaper-style-swatch ${value}`} aria-pressed={draft.style===value} onClick={()=>patch({style:value})}><span/>{label}{draft.style===value&&<Check size={14}/>}</button>)}</div>
        {draft.style==="photo"&&!selected&&<p className="wallpaper-help">从“我的壁纸”上传图片，或从“在线精选”选择一张。</p>}
        <label>明暗模式<select aria-label="明暗模式" value={draft.appearance} onChange={e=>patch({appearance:e.target.value as BackgroundPreferences["appearance"]})}><option value="inherit">沿用原有主题</option><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option></select></label>
        <label>强调色<select aria-label="强调色" value={draft.accent} onChange={e=>patch({accent:e.target.value as BackgroundPreferences["accent"]})}><option value="original">原有主题色</option><option value="auto">从壁纸取色</option><option value="green">青绿</option><option value="blue">海蓝</option><option value="violet">紫色</option><option value="orange">暖橙</option></select></label>
        <label className="wallpaper-check"><input type="checkbox" checked={draft.principleFollow} onChange={e=>patch({principleFollow:e.target.checked})}/>Principle 跟随背景配色</label>
        <div className="wallpaper-presets"><button type="button" onClick={()=>patch({panelOpacity:94,overlay:36,blur:0})}>清晰度优先</button><button type="button" onClick={()=>patch({panelOpacity:70,overlay:18,blur:0})}>通透优先</button></div>
        {([["panelOpacity","面板不透明度",60,100],["overlay","背景遮罩",0,80],["blur","壁纸模糊",0,20]] as const).map(([key,label,min,max])=><label key={key}>{label} · {draft[key]}{key==="blur"?"px":"%"}<input aria-label={label} type="range" min={min} max={max} value={draft[key]} onChange={e=>patch({[key]:Number(e.target.value)})}/></label>)}
        {draft.style==="photo" && <><label>换图方式<select aria-label="换图方式" value={draft.mode} onChange={e=>patch({mode:e.target.value as BackgroundPreferences["mode"]})}><option value="fixed">固定当前壁纸</option><option value="daily">每日更换</option><option value="open">每次打开或刷新时更换</option></select></label><label>轮换来源<select aria-label="轮换来源" value={draft.pool} onChange={e=>patch({pool:e.target.value as BackgroundPreferences["pool"]})}><option value="online">在线精选</option><option value="favorites">仅我的收藏</option></select></label><label>在线分类<select aria-label="在线分类" value={draft.category} onChange={e=>patch({category:e.target.value as BackgroundPreferences["category"]})}><option value="nature">自然</option><option value="city">城市</option><option value="abstract">抽象</option></select></label>
        <p className="wallpaper-help">{positionMode==="portrait"?"竖屏":"横屏"}裁切位置 · 切换右侧预览可分别设置</p>{(["x","y"] as const).map(axis=><label key={axis}>{axis==="x"?"水平位置":"垂直位置"}<input type="range" aria-label={axis==="x"?"壁纸水平位置":"壁纸垂直位置"} min="0" max="100" value={positions[positionMode][axis]} onChange={e=>patch({positions:{...draft.positions,[draft.currentId!]:{...positions,[positionMode]:{...positions[positionMode],[axis]:Number(e.target.value)}}}})}/></label>)}</>}
      </>}
      {tab==="library" && <><div className="wallpaper-library-actions"><button type="button" onClick={()=>upload.current?.click()}><Upload size={15}/>上传图片</button><button type="button" onClick={()=>void run(async()=>{await exportWallpapers(wallpapers);setNotice("已导出收藏备份，包含图片和来源信息。");})}><Download size={15}/>导出收藏</button><button type="button" onClick={()=>backup.current?.click()}>导入备份</button></div><p className="wallpaper-help">收藏保存在本机，可离线使用。上传支持 20 MB 以内的 JPG / PNG / WebP，会优化为适合壁纸的尺寸。</p>
        <input ref={upload} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void run(async()=>{const item=await prepareWallpaper(file,{id:crypto.randomUUID(),title:file.name,source:"local",author:"",sourceUrl:"",license:"个人上传",licenseUrl:"",favorite:true});await saveBackground({},[item]);choose(item);});}}/>
        <input ref={backup} hidden type="file" accept="application/json" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void run(async()=>{const items=await importWallpapers(file);await saveBackground({},items);setNotice(`已导入 ${items.length} 张壁纸。`);});}}/>
        {!wallpapers.length&&<p className="wallpaper-help">还没有壁纸，上传一张喜欢的图片开始吧。</p>}
        <div className="wallpaper-grid">{wallpapers.map(item=><article key={item.id} className={draft.currentId===item.id?"selected":""}><button type="button" className="wallpaper-thumbnail" aria-label={`预览 ${item.title}`} onClick={()=>choose(item)}><WallpaperThumb item={item}/><span>{item.title}</span></button><div className="wallpaper-card-actions"><button type="button" aria-label={`${item.favorite?"取消收藏":"收藏"} ${item.title}`} aria-pressed={item.favorite} onClick={()=>void run(async()=>{await favoriteWallpaper(item.id,!item.favorite);if(selected?.id===item.id)setSelected({...selected,favorite:!item.favorite});})}><Heart size={14}/></button><small>{item.favorite?"已收藏":"最近使用"}</small><button type="button" disabled={preferences.currentId===item.id||draft.currentId===item.id} aria-label={`删除 ${item.title}`} onClick={()=>void run(()=>deleteWallpaper(item.id))}><Trash2 size={14}/></button></div></article>)}</div>
      </>}
      {tab==="online" && <><label>分类<select aria-label="在线分类" value={draft.category} onChange={e=>{patch({category:e.target.value as BackgroundPreferences["category"]});setOnline([]);setOffset(0);}}><option value="nature">自然</option><option value="city">城市</option><option value="abstract">抽象</option></select></label><button type="button" onClick={loadOnline}>{online.length?"换一批":"加载在线精选"}</button><p className="wallpaper-help">来自 Wikimedia Commons。选择后下载到本地，收藏可长期保留。</p><div className="wallpaper-grid">{online.map(item=><article key={item.id}><button type="button" className="wallpaper-thumbnail" onClick={()=>void run(async()=>{choose(wallpapers.find(w=>w.id===item.id)??await downloadWallpaper(item));})}><img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer"/><span>{item.title}</span></button><small>{item.author} · {item.license}</small><a href={item.sourceUrl} target="_blank" rel="noreferrer">来源与许可</a></article>)}</div></>}
      </fieldset>
    </section><section className="wallpaper-preview"><div className="wallpaper-preview-modes">{([["newtab","横屏"],["portrait","竖屏"],["sidepanel","侧边栏"]] as const).map(([value,label])=><button type="button" key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{label}</button>)}</div>
      <AppearancePreview settings={settings} tasks={tasks} navigation={navigation} preferences={navigationPreferences} mode={mode} background={draft} wallpaper={selected}/>
      {selected&&<div className="wallpaper-attribution"><strong>{selected.title}</strong><span>{selected.author} · {selected.license} · 已优化尺寸</span>{selected.sourceUrl&&<a href={selected.sourceUrl} target="_blank" rel="noreferrer">图片来源</a>}{selected.licenseUrl&&<a href={selected.licenseUrl} target="_blank" rel="noreferrer">许可说明</a>}<button type="button" disabled={busy} aria-pressed={Boolean(favorite)} onClick={()=>void run(async()=>{await saveBackground({},[{...selected,favorite:true}]);setSelected({...selected,favorite:true});setNotice("已收藏图片，可离线使用。");})}><Heart size={14}/>{favorite?"已收藏":"收藏这张"}</button></div>}
      <p className="wallpaper-help">风格调整在保存后生效；上传、收藏和删除即时保存到壁纸库。</p>
    </section></div>
  </main>;
}
