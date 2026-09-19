import { useCallback, useEffect, useRef, useState } from "react";

// Keep only changed fields, serialize writes, and merge edits made during a save.
export function useAutosave<T extends object>(value: T, save: (patch: Partial<T>) => Promise<unknown>) {
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const pending = useRef<Partial<T>>({});
  const saving = useRef<Partial<T>>({});
  const task = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => { setDraft({ ...value, ...saving.current, ...pending.current }); }, [value]);

  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    if (task.current) return task.current;
    if (!Object.keys(pending.current).length) return Promise.resolve();
    setStatus("saving");
    setError("");
    const run = async () => {
      while (Object.keys(pending.current).length) {
        const changes = pending.current;
        pending.current = {};
        saving.current = changes;
        try { await saveRef.current(changes); }
        catch (cause) {
          pending.current = { ...changes, ...pending.current };
          const message = cause instanceof Error ? cause.message : "保存失败，请重试。";
          setError(message); setStatus("error");
          throw cause;
        } finally { saving.current = {}; }
      }
      setStatus("saved");
    };
    task.current = run().finally(() => { task.current = null; });
    return task.current;
  }, []);

  const patch = useCallback((changes: Partial<T>) => {
    pending.current = { ...pending.current, ...changes };
    setDraft(previous => ({ ...previous, ...changes }));
    setStatus("saving"); setError("");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush().catch(() => {}); }, 160);
  }, [flush]);

  useEffect(() => {
    const leave = () => { void flush().catch(() => {}); };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); leave(); };
  }, [flush]);

  return { draft, patch, flush, status, error };
}
