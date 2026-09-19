import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ExternalLink, FolderPlus, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";
import type { LinkGroup, NavigationAction, NavigationData, NewTabPreferences, QuickLink } from "../navigation";
import { linkDomain, linkTitle, normalizeLinkUrl } from "../navigation";
import { SiteIcon } from "./SiteIcon";
import { ShortcutSortArea, SortableShortcut } from "./SortableShortcuts";
import "./shortcuts.css";

interface Props {
  data: NavigationData;
  preferences: NewTabPreferences;
  onAction?: (action: NavigationAction) => Promise<void>;
  onPreferences?: (patch: Partial<NewTabPreferences>) => Promise<void>;
}
type Editor = { kind: "link"; value: QuickLink } | { kind: "group"; value: LinkGroup };

function ShortcutEditor({ editor, groups, onSave, onClose }: {
  editor: Editor; groups: LinkGroup[]; onSave: (action: NavigationAction) => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(editor.kind === "link" ? editor.value.title : editor.value.name);
  const [url, setUrl] = useState(editor.kind === "link" ? editor.value.url : "");
  const [groupId, setGroupId] = useState(editor.kind === "link" ? editor.value.groupId ?? "" : "");
  const [pinned, setPinned] = useState(editor.kind === "link" ? editor.value.pinned : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  let previewUrl = "";
  try { if (url.trim()) previewUrl = normalizeLinkUrl(url); } catch { /* Validate on save. */ }
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="shortcut-dialog" aria-labelledby="shortcut-editor-title" onCancel={event => { if (saving) event.preventDefault(); }} onClose={onClose}>
    <form onSubmit={async event => {
      event.preventDefault(); setSaving(true); setError("");
      try {
        await onSave(editor.kind === "link"
          ? { type: "save-link", link: { id: editor.value.id, title: name, url, groupId: groupId || null, pinned } }
          : { type: "save-group", group: { id: editor.value.id, name } });
        dialog.current?.close();
      } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请重试"); }
      finally { setSaving(false); }
    }}>
      <div className="shortcut-editor-heading"><h2 id="shortcut-editor-title">{editor.kind === "link" ? "网站入口" : "网站分组"}</h2><button type="button" disabled={saving} onClick={() => dialog.current?.close()} aria-label="关闭"><X size={18} /></button></div>
      {editor.kind === "link" && <label>网址<input autoFocus required value={url} onChange={event => setUrl(event.target.value)} placeholder="example.com" inputMode="url" /></label>}
      <label>{editor.kind === "link" ? "名称（选填）" : "名称"}<input aria-label="名称" autoFocus={editor.kind === "group"} required={editor.kind === "group"} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder={editor.kind === "link" ? "留空使用域名" : undefined} /></label>
      {editor.kind === "link" && <>
        {previewUrl && <div className="shortcut-entry-preview" aria-live="polite"><SiteIcon url={previewUrl} preview /><span className="shortcut-copy">{linkTitle({ title: name, url: previewUrl })}</span></div>}
        <label>分组<select aria-label="分组" value={groupId} onChange={event => setGroupId(event.target.value)}><option value="">未分组</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label className="shortcut-checkbox"><input type="checkbox" checked={pinned} onChange={event => setPinned(event.target.checked)} />固定到常用入口</label>
      </>}
      {error && <p role="alert" className="shortcut-error">{error}</p>}
      <div className="shortcut-editor-actions"><button type="button" disabled={saving} onClick={() => dialog.current?.close()}>取消</button><button type="submit" disabled={saving || !(editor.kind === "link" ? url.trim() : name.trim())}>{saving ? "保存中…" : "保存"}</button></div>
    </form>
  </dialog>;
}

export function ShortcutPanel({ data, preferences, onAction, onPreferences }: Props) {
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!onAction) return;
    const doc = searchInput.current?.ownerDocument;
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented
        || target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
        || doc?.querySelector('dialog[open], [role="dialog"]')) return;
      event.preventDefault(); searchInput.current?.focus();
    };
    doc?.addEventListener("keydown", focusSearch);
    return () => doc?.removeEventListener("keydown", focusSearch);
  }, [onAction]);
  const [query, setQuery] = useState("");
  const [managing, setManaging] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const q = query.trim().toLocaleLowerCase();
  const match = (link: QuickLink) => !q || `${linkTitle(link)} ${link.url} ${data.groups.find(group => group.id === link.groupId)?.name ?? ""}`.toLocaleLowerCase().includes(q);
  const act = async (action: NavigationAction) => {
    setBusy(true); setError("");
    try { await onAction?.(action); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败，请重试"); }
    finally { setBusy(false); }
  };
  const rows = (links: QuickLink[]) => <ShortcutSortArea ids={links.map(link => link.id)} disabled={busy || Boolean(q) || !onAction} onMove={(id, overId) => void act({ type: "reorder-link", id, overId })}><div className="shortcut-links">{links.map((link, index) => <SortableShortcut id={link.id} title={linkTitle(link)} key={link.id} disabled={busy || Boolean(q) || !onAction} editable={Boolean(onAction)}>
    <a href={link.url} onClick={onAction ? undefined : event => event.preventDefault()} aria-label={`${linkTitle(link)}，${link.url}`}>
      <SiteIcon url={link.url} /><span className="shortcut-copy">{linkTitle(link)}{preferences.showDomains && linkTitle(link) !== linkDomain(link.url) && <small>{linkDomain(link.url)}</small>}</span><ExternalLink size={12} />
    </a>
    {managing && <div className="shortcut-row-actions">
      <button type="button" disabled={busy} onClick={() => setEditor({ kind: "link", value: link })} aria-label={`编辑 ${linkTitle(link)}`}><Pencil size={14} /></button>
      <button type="button" disabled={busy} onClick={() => void act({ type: "pin-link", id: link.id, pinned: !link.pinned })} aria-label={`${link.pinned ? "取消固定" : "固定"} ${linkTitle(link)}`} aria-pressed={link.pinned}><Pin size={14} /></button>
      <button type="button" disabled={busy || index === 0 || Boolean(q)} onClick={() => void act({ type: "move-link", id: link.id, neighborId: links[index - 1].id })} aria-label={`上移 ${linkTitle(link)}`}><ArrowUp size={14} /></button>
      <button type="button" disabled={busy || index === links.length - 1 || Boolean(q)} onClick={() => void act({ type: "move-link", id: link.id, neighborId: links[index + 1].id })} aria-label={`下移 ${linkTitle(link)}`}><ArrowDown size={14} /></button>
      <button type="button" disabled={busy} onClick={() => void act({ type: "delete-link", id: link.id })} aria-label={`删除 ${linkTitle(link)}`}><Trash2 size={14} /></button>
    </div>}
  </SortableShortcut>)}</div></ShortcutSortArea>;
  const pinned = data.links.filter(link => link.pinned && match(link));
  const sections = [...data.groups, { id: "", name: "未分组" }];
  return <nav className="shortcut-panel" aria-label="快捷访问">
    <div className="shortcut-heading"><h2>快捷访问</h2>{onAction && <button type="button" onClick={() => setManaging(!managing)} aria-pressed={managing}>{managing ? <><Check size={14} />完成</> : "整理"}</button>}</div>
    <label className="shortcut-search"><Search size={15} /><input ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="查找入口…" aria-label="查找网站入口" aria-keyshortcuts="/" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="清除查找"><X size={14} /></button> : <kbd aria-hidden="true">/</kbd>}</label>
    {pinned.length > 0 && <section><h3 className="shortcut-section-label"><Pin size={13} aria-hidden="true" />已固定<small>{pinned.length}</small></h3>{rows(pinned)}</section>}
    {sections.map(group => {
      const links = data.links.filter(link => !link.pinned && (link.groupId ?? "") === group.id && match(link));
      if (!links.length && (!managing || !group.id || q)) return null;
      const expanded = Boolean(q) || managing || preferences.expandedGroups.includes(group.id);
      return <section className="shortcut-group" key={group.id}>
        <div className="shortcut-group-heading"><button type="button" aria-expanded={expanded} onClick={() => {
          if (!onPreferences || managing || q) return;
          void onPreferences({ expandedGroups: expanded ? preferences.expandedGroups.filter(id => id !== group.id) : [...preferences.expandedGroups, group.id] }).catch(() => setError("无法保存分组状态，请重试"));
        }}><span className="shortcut-group-dot" aria-hidden="true" /><span className="shortcut-group-name">{group.name}</span><small>{links.length}</small><ChevronDown size={14} className={expanded ? "" : "closed"} /></button>
        {managing && group.id && <><button type="button" disabled={busy} onClick={() => setEditor({ kind: "group", value: group })} aria-label={`重命名分组 ${group.name}`}><Pencil size={13} /></button><button type="button" disabled={busy} onClick={() => void act({ type: "delete-group", id: group.id })} aria-label={`删除分组 ${group.name}，保留链接`}><Trash2 size={13} /></button></>}
        </div>
        {expanded && (links.length ? rows(links) : <p className="shortcut-hint">编辑链接时可选择此分组。</p>)}
      </section>;
    })}
    {!data.links.length && <p className="shortcut-hint">把常用的网站或具体页面放在这里。</p>}
    {q && !data.links.some(match) && <p className="shortcut-hint">没有找到匹配的入口。</p>}
    {onAction && <div className="shortcut-footer"><button type="button" onClick={() => setEditor({ kind: "link", value: { id: crypto.randomUUID(), title: "", url: "", pinned: true, groupId: null } })}><Plus size={15} />添加入口</button>{managing && <button type="button" onClick={() => setEditor({ kind: "group", value: { id: crypto.randomUUID(), name: "" } })}><FolderPlus size={15} />新建分组</button>}</div>}
    {error && <p role="alert" className="shortcut-error">{error}</p>}
    {editor && onAction && <ShortcutEditor editor={editor} groups={data.groups} onSave={onAction} onClose={() => setEditor(null)} />}
  </nav>;
}
