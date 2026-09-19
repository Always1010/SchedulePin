import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, ExternalLink, PanelRight, Settings } from "lucide-react";
import { AddItemDialog } from "./components/AddItemDialog";
import { AppearanceEditor } from "./components/AppearanceEditor";
import { ArchivePage } from "./components/ArchivePage";
import { SettingsPage } from "./components/SettingsPage";
import { NewTabLayout } from "./components/NewTabLayout";
import { PlanView, PrincipleCard } from "./components/PlanView";
import { useNavigation } from "./useNavigation";
import { changeNavigation, changeNewTabPreferences, type NewTabPreferences } from "./navigation";
import {
  archiveItem, createItem, defaultSettings, loadArchivedItems, loadItems, loadSettings,
  removeItem, restoreItem, saveSettings, saveTaskOrder, setCompleted, subscribeStorage, todayKey,
  updateItemTitle,
} from "./data";
import { queryHelper, restoreWallpaper, syncDesktop } from "./native";
import type { AppSettings, HelperStatus, NewPlanItem, PlanItem } from "./types";
import { visualDesignStyle } from "./visualDesign";
import { useBackground } from "./useBackground";
import { BackgroundLayer, backgroundClass, backgroundSettings, backgroundStyle } from "./components/BackgroundLayer";
import { BackgroundToolbar } from "./components/BackgroundToolbar";
import { WallpaperPage } from "./components/WallpaperPage";
const sidePanel = new URLSearchParams(location.search).get("view") === "sidepanel";
const fullPlan = new URLSearchParams(location.search).get("view") === "plan";

export default function App() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [archived, setArchived] = useState<PlanItem[]>([]);
  const [page, setPage] = useState<"main" | "archive" | "settings" | "principle" | "appearance" | "background">("main");
  const newTabMain = page === "main" && !sidePanel && !fullPlan;
  const background = useBackground(newTabMain);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [helper, setHelper] = useState<HelperStatus>({ connected: false, monitors: [] });
  const today = todayKey();
  const { navigation, preferences, navigationReady, navigationError } = useNavigation();
  const [preferenceError, setPreferenceError] = useState("");
  const updatePreferences = async (patch: Partial<NewTabPreferences>) => {
    setPreferenceError("");
    try { await changeNewTabPreferences(patch); }
    catch { setPreferenceError("无法保存页面偏好，请重试。"); }
  };

  const refresh = useCallback(async () => {
    const [nextItems, nextSettings] = await Promise.all([loadItems(today), loadSettings()]);
    setItems(nextItems);
    setSettings(nextSettings);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    refresh();
    return subscribeStorage(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!loading && settings.desktopEnabled) syncDesktop().then(setHelper);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshHelper = useCallback(async () => {
    const next = await queryHelper();
    setHelper(next);
    if (next.connected && next.monitors.length && !settings.selectedMonitorId) {
      const updated = { ...settings, selectedMonitorId: next.monitors.find((monitor) => monitor.primary)?.id ?? next.monitors[0].id };
      setSettings(updated);
      await saveSettings(updated);
    }
  }, [settings]);

  useEffect(() => {
    if (page === "settings" || page === "principle") refreshHelper();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const tasks = useMemo(() => items
    .filter((item) => item.kind === "task")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)), [items]);

  const toggle = async (item: PlanItem) => {
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, completed: !row.completed, completedDate: !row.completed ? today : null } : row));
    await setCompleted(item.id, today, !item.completed);
  };

  const rename = async (id: string, title: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, title } : item));
    await updateItemTitle(id, title);
  };

  const remove = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setArchived((current) => current.filter((item) => item.id !== id));
    await removeItem(id);
  };

  const add = async (input: NewPlanItem) => {
    await createItem(input);
    await refresh();
  };

  const reorder = async (ids: string[]) => {
    const order = new Map(ids.map((id, index) => [id, index]));
    setItems(current => current.map(item => order.has(item.id) ? { ...item, sortOrder: order.get(item.id)! } : item));
    await saveTaskOrder(ids);
  };

  const archiveTask = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    await archiveItem(id);
  };

  const openArchive = async () => {
    setArchived(await loadArchivedItems());
    setPage("archive");
  };

  const restoreArchived = async (id: string) => {
    await restoreItem(id);
    setArchived((current) => current.filter((item) => item.id !== id));
    await refresh();
  };

  const updateSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const saveAppearance = async (next: AppSettings) => {
    await updateSettings(next);
    if (next.desktopEnabled) setHelper(await syncDesktop());
    setPage("settings");
  };

  const restoreDesktop = async () => {
    const result = await restoreWallpaper();
    setHelper(result);
    const next = { ...settings, desktopEnabled: false };
    setSettings(next);
    await saveSettings(next);
  };

  const openFullPage = async () => {
    const fullPageUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("index.html?view=plan")
      : new URL(`${location.pathname}?view=plan`, location.origin).toString();
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      await chrome.tabs.create({ url: fullPageUrl });
      return;
    }
    window.open(fullPageUrl, "_blank", "noopener,noreferrer");
  };

  const uiSettings = backgroundSettings(settings, newTabMain ? background.preferences : undefined);
  const plan = <PlanView settings={uiSettings} tasks={tasks} loading={loading} sidePanel={sidePanel}
    principleExpanded={sidePanel || preferences.principleExpanded}
    onTogglePrinciple={sidePanel ? undefined : () => void updatePreferences({ principleExpanded: !preferences.principleExpanded })}
    onEditPrinciple={() => setPage("principle")} onOpenArchive={openArchive} onAddDetailed={() => setAddOpen(true)}
    onCreate={add} onToggle={toggle} onRename={rename} onDelete={remove} onArchive={archiveTask} onReorder={reorder} />;

  const appearanceClass = `theme-${uiSettings.theme} font-${settings.fontFamily} principle-theme-${settings.principleTheme} principle-font-${settings.principleFontFamily} principle-style-${settings.principleTextStyle}`;

  return (
    <div
      className={`${sidePanel ? "app compact extension-app" : "app extension-app"} ${appearanceClass} ${newTabMain ? backgroundClass(background.preferences) : ""}`}
      style={{ ...visualDesignStyle(uiSettings), ...(newTabMain ? backgroundStyle(background.preferences,background.current) : {}), "--font-scale": settings.fontScale, "--principle-font-scale": settings.principleFontScale, "--card-radius": `${settings.cardRadius}px` } as React.CSSProperties}
    >
      {newTabMain && <BackgroundLayer preferences={background.preferences} current={background.current}/>}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><CalendarCheck size={19} /></span>
          <span className="brand-copy"><strong>SchedulePin</strong><small className="desktop-status ready">{sidePanel ? "浏览器侧边栏" : fullPlan ? "完整计划" : "快捷访问 · 计划"}</small></span>
        </div>
        <div className="topbar-actions">
          {settings.desktopEnabled && <span className="wallpaper-live">桌面同步已开启</span>}
          {sidePanel && <button type="button" className="open-full-page-button" onClick={openFullPage} aria-label="在新标签页打开完整页面" title="在新标签页打开完整页面"><ExternalLink size={15} /><span>完整页面</span></button>}
          {!sidePanel && !fullPlan && page === "main" && <button type="button" className="open-full-page-button todo-visibility" disabled={!navigationReady} aria-expanded={preferences.tasksVisible} onClick={() => void updatePreferences({ tasksVisible: !preferences.tasksVisible })}><PanelRight size={15} /><span>{preferences.tasksVisible ? "收起待办" : "展开全部待办"}</span></button>}
          <button className="icon-button" onClick={() => setPage("settings")} aria-label="设置"><Settings size={18} /></button>
        </div>
      </header>

      {page === "background" ? <WallpaperPage preferences={background.preferences} wallpapers={background.wallpapers} settings={settings} tasks={tasks} navigation={navigation} navigationPreferences={preferences} onBack={()=>setPage("main")} onWindowCurrent={background.selectForWindow}/> : page === "archive" ? (
        <ArchivePage items={archived} onBack={() => setPage("main")} onRestore={restoreArchived} onDelete={remove} />
      ) : page === "appearance" ? (
        <AppearanceEditor
          settings={settings}
          items={items}
          navigation={navigation}
          preferences={preferences}
          background={background.preferences}
          wallpaper={background.current}
          onSave={saveAppearance}
          onCancel={() => setPage("settings")}
        />
      ) : page === "settings" || page === "principle" ? (
        <SettingsPage settings={settings} helper={helper} initialSection={page === "principle" ? "principle" : "hub"} onChange={updateSettings} onRefreshHelper={refreshHelper} onRestoreWallpaper={restoreDesktop} onOpenAppearance={() => setPage("appearance")} onOpenBackground={()=>setPage("background")} onBack={() => setPage("main")} />
      ) : sidePanel || fullPlan ? <main className="todo-main">{plan}</main> : navigationReady ? (
        <NewTabLayout data={navigation} preferences={preferences} onAction={changeNavigation} onPreferences={changeNewTabPreferences}>
          {preferences.tasksVisible ? plan : <div className="newtab-quiet">
            <PrincipleCard settings={settings} expanded={preferences.principleExpanded}
              onToggle={() => void updatePreferences({ principleExpanded: !preferences.principleExpanded })} onEdit={() => setPage("principle")} />
            <p>计划已收起，需要时可以展开完整待办。</p>
            <button type="button" onClick={() => void updatePreferences({ tasksVisible: true })}><PanelRight size={16} />展开全部待办</button>
          </div>}
        </NewTabLayout>
      ) : <div className="newtab-loading">{navigationError || "正在打开新标签页…"}</div>}
      {(preferenceError || (navigationReady && navigationError)) && <div className="newtab-error" role="alert">{preferenceError || navigationError}</div>}
      {newTabMain && background.ready && <BackgroundToolbar preferences={background.preferences} wallpapers={background.wallpapers} current={background.current} onOpen={()=>setPage("background")} onWindowCurrent={background.selectForWindow}/>}
      {newTabMain && background.error && <div className="background-message" role="status">{background.error}<button type="button" onClick={()=>background.setError("")}>关闭</button></div>}

      <AddItemDialog open={addOpen} date={today} onClose={() => setAddOpen(false)} onSubmit={add} />
    </div>
  );
}
