import { useEffect, useState } from "react";
import { defaultNewTabPreferences, emptyNavigation, loadNavigation, loadNewTabPreferences, subscribeNavigation } from "./navigation";

export function useNavigation() {
  const [navigation, setNavigation] = useState(emptyNavigation);
  const [preferences, setPreferences] = useState(defaultNewTabPreferences);
  const [navigationReady, setReady] = useState(false);
  const [navigationError, setError] = useState("");
  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = async () => {
      const request = ++revision;
      try {
        const [data, prefs] = await Promise.all([loadNavigation(), loadNewTabPreferences()]);
        if (active && request === revision) { setNavigation(data); setPreferences(prefs); setReady(true); setError(""); }
      } catch { if (active) setError("无法读取快捷访问，请重新打开页面重试。"); }
    };
    const unsubscribe = subscribeNavigation(refresh);
    void refresh();
    return () => { active = false; unsubscribe(); };
  }, []);
  return { navigation, preferences, navigationReady, navigationError };
}
