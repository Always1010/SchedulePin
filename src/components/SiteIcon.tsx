import { useEffect, useState } from "react";
import { linkDomain } from "../navigation";
import { resolveSiteIcon } from "../siteIcons";

export function SiteIcon({ url, preview = false }: { url: string; preview?: boolean }) {
  const [resolved, setResolved] = useState<{ url: string; src: string } | null>(null);
  const [loaded, setLoaded] = useState("");
  const domain = linkDomain(url);
  const hash = Array.from(domain).reduce((value, char) => (value * 31 + char.codePointAt(0)!) >>> 0, 0);
  const src = resolved?.url === url ? resolved.src : "";
  useEffect(() => {
    let active = true;
    // Avoid requesting a new host for each keystroke in the entry editor.
    const timer = setTimeout(() => {
      void resolveSiteIcon(url).then(icon => { if (active) setResolved(icon ? { url, src: icon } : null); });
    }, preview ? 450 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [url, preview]);
  return <span className={`site-icon site-icon-tone-${hash % 3}${src && loaded === src ? " has-image" : ""}`} aria-hidden="true">
    <span className="site-icon-letter">{Array.from(domain)[0]?.toLocaleUpperCase() || "?"}</span>
    {src && <img key={src} src={src} alt="" referrerPolicy="no-referrer" draggable={false}
      onLoad={() => setLoaded(src)} onError={() => { setResolved(null); setLoaded(""); }} />}
  </span>;
}
