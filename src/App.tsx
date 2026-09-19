import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, ExternalLink, Settings } from "lucide-react";
import { AddItemDialog } from "./components/AddItemDialog";
import { ArchivePage } from "./components/ArchivePage";
import { SettingsPage } from "./components/SettingsPage";
import { NewTabLayout } from "./components/NewTabLayout";
import { PlanView, PrincipleCard, TodoSummaryCard } from "./components/PlanView";
import { useNavigation } from "./useNavigation";
import { changeNavigation, changeNewTabPreferences, type NewTabPreferences } from "./navigation";
import {
  archiveItem, createItem, defaultSettings, loadArchivedItems, loadItems, loadSettings,
  patchSettings, removeItem, restoreItem, saveTaskOrder, setCompleted, subscribeStorage, todayKey,
  updateItemTitle,
} from "./data";
import { queryHelper, restoreWallpaper, syncDesktop } from "./native";
import type { AppSettings, HelperStatus, NewPlanItem, PlanItem } from "./types";
import { visualDesignStyle } from "./visualDesign";
import { useBackground } from "./useBackground";
import { BackgroundLayer, backgroundClass, backgroundSettings, backgroundStyle } from "./components/BackgroundLayer";
import { BackgroundToolbar } from "./components/BackgroundToolbar";
import { WallpaperPage } from "./components/WallpaperPage";
import { AppearancePreviewControls } from "./components/AppearanceEditor";
import { saveBackground } from "./backgroundStore";
import { useAutosave } from "./useAutosave";
import type { SettingsSection } from "./components/SettingsNavigation";
const sidePanel = new URLSearchParams(location.search).get("view") === "sidepanel";
const fullPlan = new URLSearchParams(location.search).get("view") === "plan";

export default function App() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [archived, setArchived] = useState<PlanItem[]>([]);
  const [page, setPage] = useState<"main" | "archive" | "settings">("main");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("style");
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
  const saveSettingsPatch = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await patchSettings(patch);
    setSettings(next);
    if (next.desktopEnabled) setHelper(await syncDesktop());
  }, []);
  const settingsAutosave = useAutosave(settings, saveSettingsPatch);
  const saveBackgroundPatch = useCallback(async (patch: Partial<typeof background.preferences>) => { await saveBackground(patch); }, []);
  const backgroundAutosave = useAutosave(background.preferences, saveBackgroundPatch);
  const activeSettings = settingsAutosave.draft;
  const activeBackground = backgroundAutosave.draft;

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
      const updated = await patchSettings({ selectedMonitorId: next.monitors.find((monitor) => monitor.primary)?.id ?? next.monitors[0].id });
      setSettings(updated);
    }
  }, [settings]);

  useEffect(() => {
    if (page === "settings") refreshHelper();
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

  const restoreDesktop = async () => {
    const result = await restoreWallpaper();
    setHelper(result);
    await settingsAutosave.flush().catch(() => {});
    const next = await patchSettings({ desktopEnabled: false });
    setSettings(next);
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

  const uiSettings = backgroundSettings(activeSettings, newTabMain ? activeBackground : undefined);
  const plan = <PlanView settings={uiSettings} tasks={tasks} loading={loading} sidePanel={sidePanel}
    principleExpanded={sidePanel || preferences.principleExpanded}
    onTogglePrinciple={sidePanel ? undefined : () => void updatePreferences({ principleExpanded: !preferences.principleExpanded })}
    onToggleTasks={newTabMain ? () => void updatePreferences({ tasksVisible: false }) : undefined}
    onEditPrinciple={() => { setSettingsSection("principle"); setPage("settings"); }} onOpenArchive={openArchive} onAddDetailed={() => setAddOpen(true)}
    onCreate={add} onToggle={toggle} onRename={rename} onDelete={remove} onArchive={archiveTask} onReorder={reorder} />;

  const appearanceClass = `theme-${uiSettings.theme} font-${activeSettings.fontFamily} principle-theme-${activeSettings.principleTheme} principle-font-${activeSettings.principleFontFamily} principle-style-${activeSettings.principleTextStyle}`;

  return (
    <div
      className={`${sidePanel ? "app compact extension-app" : "app extension-app"} ${appearanceClass} ${newTabMain ? backgroundClass(activeBackground) : ""}`}
      style={{ ...visualDesignStyle(uiSettings), ...(newTabMain ? backgroundStyle(activeBackground,background.current) : {}), "--font-scale": activeSettings.fontScale, "--principle-font-scale": activeSettings.principleFontScale, "--card-radius": `${activeSettings.cardRadius}px` } as React.CSSProperties}
    >
      {newTabMain && <BackgroundLayer preferences={activeBackground} current={background.current}/>}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><CalendarCheck size={19} /></span>
          <span className="brand-copy"><strong>SchedulePin</strong><small className="desktop-status ready">{sidePanel ? "浏览器侧边栏" : fullPlan ? "完整计划" : "快捷访问 · 计划"}</small></span>
        </div>
        <div className="topbar-actions">
          {activeSettings.desktopEnabled && <span className="wallpaper-live">桌面同步已开启</span>}
          {sidePanel && <button type="button" className="open-full-page-button" onClick={openFullPage} aria-label="在新标签页打开完整页面" title="在新标签页打开完整页面"><ExternalLink size={15} /><span>完整页面</span></button>}
          <button className="icon-button" onClick={() => { setSettingsSection("style"); setPage("settings"); }} aria-label="设置"><Settings size={18} /></button>
        </div>
      </header>

      {page === "archive" ? (
        <ArchivePage items={archived} onBack={() => setPage("main")} onRestore={restoreArchived} onDelete={remove} />
      ) : page === "settings" ? (
        <SettingsPage settings={activeSettings} helper={helper} initialSection={settingsSection} onPatch={settingsAutosave.patch} onRefreshHelper={refreshHelper} onRestoreWallpaper={restoreDesktop} onBack={() => { void Promise.all([settingsAutosave.flush(), backgroundAutosave.flush()]).then(() => setPage("main")).catch(() => {}); }} onNavigate={setSettingsSection} background={activeBackground} onBackgroundPatch={backgroundAutosave.patch} status={settingsAutosave.status === "error" ? "error" : backgroundAutosave.status === "error" ? "error" : settingsAutosave.status === "saving" || backgroundAutosave.status === "saving" ? "saving" : "saved"} error={settingsAutosave.status === "error" ? settingsAutosave.error : backgroundAutosave.error} onRetry={() => { void (settingsAutosave.status === "error" ? settingsAutosave.flush() : backgroundAutosave.flush()).catch(() => {}); }} preview={<AppearancePreviewControls settings={activeSettings} tasks={tasks} navigation={navigation} preferences={preferences} background={activeBackground} wallpaper={background.current}/>} backgroundPage={<WallpaperPage autosave={backgroundAutosave} embedded current={background.current} preferences={activeBackground} wallpapers={background.wallpapers} settings={activeSettings} tasks={tasks} navigation={navigation} navigationPreferences={preferences} onBack={() => setSettingsSection("style")} onWindowCurrent={background.selectForWindow}/>} />
      ) : sidePanel || fullPlan ? <main className="todo-main">{plan}</main> : navigationReady ? (
        <NewTabLayout data={navigation} preferences={preferences} onAction={changeNavigation} onPreferences={changeNewTabPreferences}>
          {preferences.tasksVisible ? plan : <div className="newtab-quiet">
            <PrincipleCard settings={activeSettings} expanded={preferences.principleExpanded}
              onToggle={() => void updatePreferences({ principleExpanded: !preferences.principleExpanded })} onEdit={() => { setSettingsSection("principle"); setPage("settings"); }} />
            <TodoSummaryCard tasks={tasks} onExpand={() => void updatePreferences({ tasksVisible: true })} />
          </div>}
        </NewTabLayout>
      ) : <div className="newtab-loading">{navigationError || "正在打开新标签页…"}</div>}
      {(preferenceError || (navigationReady && navigationError)) && <div className="newtab-error" role="alert">{preferenceError || navigationError}</div>}
      {newTabMain && background.ready && <BackgroundToolbar preferences={activeBackground} wallpapers={background.wallpapers} current={background.current} onOpen={()=>{ setSettingsSection("background"); setPage("settings"); }} onWindowCurrent={background.selectForWindow}/>}
      {newTabMain && background.error && <div className="background-message" role="status">{background.error}<button type="button" onClick={()=>background.setError("")}>关闭</button></div>}

      <AddItemDialog open={addOpen} date={today} onClose={() => setAddOpen(false)} onSubmit={add} />
    </div>
  );
}
