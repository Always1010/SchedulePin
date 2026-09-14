const HOST_NAME = "com.schedulepin.helper";
const ITEMS_KEY = "schedulepin.items.v2";
const SETTINGS_KEY = "schedulepin.settings.v2";
let syncTimer;

function nativeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(HOST_NAME, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function snapshot() {
  const stored = await chrome.storage.local.get([ITEMS_KEY, SETTINGS_KEY]);
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  return {
    protocolVersion: 1,
    date,
    generatedAt: now.toISOString(),
    items: (stored[ITEMS_KEY] || []).filter((item) => !item.archivedAt && item.kind !== "note"),
    settings: stored[SETTINGS_KEY] || {
      opacity: 0.86,
      displayMode: "single",
      selectedMonitorId: null,
      desktopEnabled: false,
      layouts: {},
    },
  };
}

async function status() {
  try {
    const response = await nativeMessage({ type: "status", protocolVersion: 1 });
    return { connected: true, monitors: [], ...response };
  } catch (error) {
    return {
      connected: false,
      monitors: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function syncNow() {
  try {
    const response = await nativeMessage({ type: "sync", snapshot: await snapshot() });
    return { connected: true, monitors: [], ...response };
  } catch (error) {
    return {
      connected: false,
      monitors: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  chrome.alarms.create("schedulepin-refresh", { periodInMinutes: 15 });
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes[ITEMS_KEY] && !changes[SETTINGS_KEY]) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), 450);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "schedulepin-refresh") syncNow();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "helper-status") {
    status().then(sendResponse);
    return true;
  }
  if (message?.type === "sync-now") {
    syncNow().then(sendResponse);
    return true;
  }
  if (message?.type === "restore-wallpaper") {
    nativeMessage({ type: "restore", protocolVersion: 1 })
      .then((response) => sendResponse({ connected: true, monitors: [], ...response }))
      .catch((error) => sendResponse({ connected: false, monitors: [], error: error.message }));
    return true;
  }
  return false;
});
