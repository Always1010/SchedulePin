import type { HelperStatus } from "./types";

const disconnected = (error?: string): HelperStatus => ({
  connected: false,
  monitors: [],
  error: error || "尚未安装或连接 SchedulePin 桌面助手",
});

async function extensionMessage<T>(message: object): Promise<T> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    throw new Error("浏览器预览模式未连接桌面助手");
  }
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

export async function queryHelper(): Promise<HelperStatus> {
  try {
    const result = await extensionMessage<HelperStatus>({ type: "helper-status" });
    return result?.connected ? result : disconnected(result?.error);
  } catch (error) {
    return disconnected(error instanceof Error ? error.message : String(error));
  }
}

export async function syncDesktop(): Promise<HelperStatus> {
  try {
    return await extensionMessage<HelperStatus>({ type: "sync-now" });
  } catch (error) {
    return disconnected(error instanceof Error ? error.message : String(error));
  }
}

export async function restoreWallpaper(): Promise<HelperStatus> {
  try {
    return await extensionMessage<HelperStatus>({ type: "restore-wallpaper" });
  } catch (error) {
    return disconnected(error instanceof Error ? error.message : String(error));
  }
}
