import { useEffect, useRef, useState } from "react";
import { Heart, Image, Lock, Shuffle, X } from "lucide-react";
import { backgroundDay, type BackgroundPreferences, type Wallpaper } from "../backgroundModel";
import { favoriteWallpaper, saveBackground, trimBackgroundCache } from "../backgroundStore";
import { nextWallpaper, useBlobUrl } from "../useBackground";

function Candidate({ item, busy, onApply, onClose }: { item: Wallpaper; busy: boolean; onApply: ()=>void; onClose:()=>void }) {
  const dialog=useRef<HTMLDialogElement>(null); const url=useBlobUrl(item.blob);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="background-candidate" onCancel={e=>{if(busy)e.preventDefault();}} onClose={onClose} aria-label="预览替换壁纸"><img src={url} alt={item.title}/><p>{item.title}</p><p>{item.author} · {item.license}</p><div><button type="button" disabled={busy} onClick={()=>dialog.current?.close()}>取消</button><button type="button" disabled={busy} onClick={onApply}>替换并固定</button></div></dialog>;
}
export function BackgroundToolbar({ preferences, wallpapers, current, onOpen }: { preferences: BackgroundPreferences; wallpapers: Wallpaper[]; current?: Wallpaper; onOpen:()=>void }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(""); const [candidate,setCandidate]=useState<Wallpaper|null>(null);
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"换图失败，已保留当前背景。");}finally{setBusy(false);}};
  return <>
    {error&&<div className="background-message" role="alert">{error}<button onClick={()=>setError("")} aria-label="关闭壁纸提示"><X size={14}/></button></div>}
    <div className="background-toolbar" aria-label="壁纸操作">
      {current?.sourceUrl&&<a href={current.sourceUrl} target="_blank" rel="noreferrer" title={`${current.author} · ${current.license}`}>{current.author || "图片来源"} · {current.license}</a>}
      <button type="button" disabled={busy} onClick={()=>void run(async()=>{const item=await nextWallpaper(preferences,wallpapers);if(preferences.mode==="fixed")setCandidate(item);else{await saveBackground({style:"photo",currentId:item.id,lastDay:backgroundDay()},[item],preferences.revision);await trimBackgroundCache();}})}><Shuffle size={14}/>{busy?"加载中…":"换一张"}</button>
      <button type="button" disabled={busy||!current} aria-pressed={current?.favorite??false} onClick={()=>current&&void run(()=>favoriteWallpaper(current.id,!current.favorite))}><Heart size={14}/>{current?.favorite?"已收藏":"收藏"}</button>
      <button type="button" disabled={busy||!current} aria-pressed={preferences.mode==="fixed"} onClick={()=>void run(async()=>{await saveBackground({mode:preferences.mode==="fixed"?"daily":"fixed",lastDay:backgroundDay()});})}><Lock size={14}/>{preferences.mode==="fixed"?"已固定":"固定"}</button>
      <button type="button" onClick={onOpen}><Image size={14}/>壁纸库</button>
    </div>
    {candidate&&<Candidate item={candidate} busy={busy} onClose={()=>setCandidate(null)} onApply={()=>void run(async()=>{await saveBackground({style:"photo",mode:"fixed",currentId:candidate.id,lastDay:backgroundDay()},[candidate]);setCandidate(null);await trimBackgroundCache();})}/>}
  </>;
}
