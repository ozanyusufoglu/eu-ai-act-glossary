"use client";

import { useGraph } from "@/components/GraphContext";

/**
 * The side panel's shell. Its content is server-rendered by the page, so it is in
 * the HTML before any JavaScript runs; this wrapper only hides it while nothing
 * is selected and wires the close button to the graph.
 */
export default function PanelFrame({ label, children }: { label: string; children: React.ReactNode }) {
  const { panelOpen, setPanelOpen, apiRef } = useGraph();

  return (
    <aside
      aria-label={label}
      hidden={!panelOpen}
      className="absolute z-20 bg-white/75 backdrop-blur-2xl border-black/10 overflow-y-auto flex flex-col gap-6
        sm:top-0 sm:right-0 sm:h-full sm:w-104 sm:border-l sm:p-10
        max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-[58%] max-sm:border-t max-sm:p-6"
      style={{ animation: "slideIn 0.4s cubic-bezier(.4,0,.2,1)" }}
    >
      <button
        type="button"
        // Before the graph has loaded there is nothing to deselect; just hide the panel.
        onClick={() => (apiRef.current ? apiRef.current.deselect() : setPanelOpen(false))}
        aria-label="Close"
        className="absolute top-4 right-4 w-8 h-8 rounded-full text-black/40 hover:bg-black/5 hover:text-black text-lg leading-none"
      >
        ×
      </button>
      {children}
    </aside>
  );
}
