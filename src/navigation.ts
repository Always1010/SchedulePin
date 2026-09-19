export interface QuickLink {
  id: string;
  // Empty means follow the URL's domain; existing custom titles remain untouched.
  title: string;
  url: string;
  groupId: string | null;
  pinned: boolean;
}
export interface LinkGroup { id: string; name: string }
export interface NavigationData { links: QuickLink[]; groups: LinkGroup[] }
export interface NewTabPreferences {
  side: "left" | "right";
  showDomains: boolean;
  tasksVisible: boolean;
  principleExpanded: boolean;
  expandedGroups: string[];
}
export const NAVIGATION_KEY = "schedulepin.navigation.v1";
export const NEWTAB_KEY = "schedulepin.newtab.v1";
export const defaultNewTabPreferences: NewTabPreferences = {
  side: "left", showDomains: false, tasksVisible: true, principleExpanded: true, expandedGroups: [],
};
export const emptyNavigation = (): NavigationData => ({ links: [], groups: [] });

export function normalizeLinkUrl(input: string): string {
  const text = input.trim();
  if (!text || /\s/.test(text)) throw new Error("请输入有效的网址，例如 https://example.com");
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(text) && !/^[^/?#:]+:\d+(?:[/?#]|$)/.test(text);
  if (hasScheme && !/^https?:\/\//i.test(text)) throw new Error("仅支持 http 和 https 网站链接");
  try {
    const url = new URL(hasScheme ? text : `https://${text}`);
    if (!url.hostname || url.username || url.password || !["https:", "http:"].includes(url.protocol)) throw new Error();
    return url.href;
  } catch { throw new Error("请输入有效的网址，不要包含账户密码"); }
}

export function linkDomain(url: string): string {
  return new URL(url).hostname.replace(/^www\./i, "");
}

export function linkTitle(link: Pick<QuickLink, "title" | "url">): string {
  return link.title.trim() || linkDomain(link.url);
}

export type NavigationAction =
  | { type: "save-link"; link: QuickLink }
  | { type: "delete-link"; id: string }
  | { type: "pin-link"; id: string; pinned: boolean }
  | { type: "move-link"; id: string; neighborId: string }
  | { type: "save-group"; group: LinkGroup }
  | { type: "delete-group"; id: string };

export function applyNavigationAction(data: NavigationData, action: NavigationAction): NavigationData {
  switch (action.type) {
    case "save-link": {
      const title = action.link.title.trim();
      const link = { ...action.link, title, url: normalizeLinkUrl(action.link.url),
        groupId: data.groups.some(group => group.id === action.link.groupId) ? action.link.groupId : null };
      return { ...data, links: data.links.some(row => row.id === link.id)
        ? data.links.map(row => row.id === link.id ? link : row) : [...data.links, link] };
    }
    case "delete-link": return { ...data, links: data.links.filter(link => link.id !== action.id) };
    case "pin-link": return { ...data, links: data.links.map(link => link.id === action.id ? { ...link, pinned: action.pinned } : link) };
    case "move-link": {
      const links = [...data.links];
      const a = links.findIndex(link => link.id === action.id);
      const b = links.findIndex(link => link.id === action.neighborId);
      if (a < 0 || b < 0) return data;
      [links[a], links[b]] = [links[b], links[a]];
      return { ...data, links };
    }
    case "save-group": {
      const name = action.group.name.trim();
      if (!name) throw new Error("请填写分组名称");
      if (data.groups.some(group => group.id !== action.group.id && group.name === name)) throw new Error("已有同名分组");
      const group = { ...action.group, name };
      return { ...data, groups: data.groups.some(row => row.id === group.id)
        ? data.groups.map(row => row.id === group.id ? group : row) : [...data.groups, group] };
    }
    case "delete-group": return {
      groups: data.groups.filter(group => group.id !== action.id),
      links: data.links.map(link => link.groupId === action.id ? { ...link, groupId: null } : link),
    };
  }
}

const extensionStorage = () => typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
async function read<T>(key: string): Promise<T | null> {
  if (extensionStorage()) return (await chrome.storage.local.get(key))[key] as T ?? null;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as T : null;
}
async function write(key: string, value: unknown) {
  if (extensionStorage()) await chrome.storage.local.set({ [key]: value });
  else {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("schedulepin-navigation"));
  }
}
export async function loadNavigation(): Promise<NavigationData> {
  return await read<NavigationData>(NAVIGATION_KEY) ?? emptyNavigation();
}
export async function loadNewTabPreferences(): Promise<NewTabPreferences> {
  return { ...defaultNewTabPreferences, ...await read<Partial<NewTabPreferences>>(NEWTAB_KEY) };
}
// Web Locks serializes read-modify-write operations across extension tabs.
function locked<T>(key: string, run: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(key, run) : run();
}
export async function changeNavigation(action: NavigationAction): Promise<void> {
  await locked(NAVIGATION_KEY, async () => write(NAVIGATION_KEY, applyNavigationAction(await loadNavigation(), action)));
}
export async function changeNewTabPreferences(patch: Partial<NewTabPreferences>): Promise<void> {
  await locked(NEWTAB_KEY, async () => write(NEWTAB_KEY, { ...await loadNewTabPreferences(), ...patch }));
}
export function subscribeNavigation(listener: () => void): () => void {
  if (extensionStorage()) {
    const callback = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[NAVIGATION_KEY] || changes[NEWTAB_KEY]) listener();
    };
    chrome.storage.onChanged.addListener(callback);
    return () => chrome.storage.onChanged.removeListener(callback);
  }
  const onStorage = (event: StorageEvent) => { if (!event.key || [NAVIGATION_KEY, NEWTAB_KEY].includes(event.key)) listener(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener("schedulepin-navigation", listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("schedulepin-navigation", listener);
  };
}
