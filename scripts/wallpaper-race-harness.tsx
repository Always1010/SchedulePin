import React from "react";
import { createRoot } from "react-dom/client";
import { useBackground } from "../src/useBackground";

declare global {
  interface Window { background?: ReturnType<typeof useBackground>; mountBackground?: () => void }
}

function Harness() {
  const value=useBackground(true); window.background=value;
  return <output data-ready={String(value.ready)} data-current={value.current?.id??""}/>;
}
window.mountBackground=()=>createRoot(document.getElementById("root")!).render(<Harness/>);
