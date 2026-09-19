// The browser's favicon store can resolve icons declared at non-standard paths.
// The website fallback requests only /favicon.ico, never a third-party icon service.
const TIMEOUT = 3000;
const cache = new Map<string, { expires: number; result: Promise<string | null> }>();
let defaultIcon: Promise<string | null> | undefined;

function cached(key: string, resolve: () => Promise<string | null>): Promise<string | null> {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.result;
  const entry = { expires: Infinity, result: resolve().catch(() => null) };
  cache.set(key, entry);
  void entry.result.then(value => { entry.expires = Date.now() + (value ? 3600000 : 300000); });
  if (cache.size > 128) cache.delete(cache.keys().next().value!);
  return entry.result;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    const finish = (result: HTMLImageElement | null) => {
      clearTimeout(timer); img.onload = null; img.onerror = null;
      if (!result) img.removeAttribute("src");
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), TIMEOUT);
    img.onload = () => finish(img.naturalWidth && img.naturalHeight ? img : null);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

async function signature(url: string): Promise<string | null> {
  const img = await loadImage(url);
  if (!img) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(img, 0, 0, 32, 32);
    return canvas.toDataURL();
  } catch { return null; }
}

function browserIconUrl(pageUrl: string): string | null {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return null;
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "32");
  return url.href;
}

export function resolveSiteIcon(input: string): Promise<string | null> {
  let page: URL;
  try {
    page = new URL(input);
    if (!["http:", "https:"].includes(page.protocol) || page.username || page.password) return Promise.resolve(null);
    page.hash = "";
  } catch { return Promise.resolve(null); }
  return cached(page.href, async () => {
    const browserUrl = browserIconUrl(page.href);
    if (browserUrl) {
      // _favicon returns a generic globe for unknown sites, even on HTTP success.
      // Compare decoded pixels so that this placeholder becomes our domain initial.
      defaultIcon ??= signature(browserIconUrl("https://schedulepin-no-favicon.invalid/")!);
      const [candidate, placeholder] = await Promise.all([signature(browserUrl), defaultIcon]);
      if (candidate && placeholder && candidate !== placeholder) return browserUrl;
    }
    const siteUrl = new URL("/favicon.ico", page.origin).href;
    return cached(`site:${page.origin}`, async () => await loadImage(siteUrl) ? siteUrl : null);
  });
}
