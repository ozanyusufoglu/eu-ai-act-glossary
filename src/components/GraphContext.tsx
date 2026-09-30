"use client";

import { createContext, useContext, useMemo, useRef, useState, type RefObject } from "react";

/** What the WebGL graph exposes to the rest of the page once it has mounted. */
export interface GraphApi {
  /** A person picked this term: select it and move the URL to its page. */
  select: (id: string) => void;
  /** The URL changed: select its term without navigating again. */
  sync: (id: string, fresh: boolean) => void;
  deselect: () => void;
  reset: () => void;
}

interface GraphState {
  /** False while nothing is selected (whole-graph view), which hides the term panel. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  apiRef: RefObject<GraphApi | null>;
}

const GraphContext = createContext<GraphState | null>(null);

/**
 * Lives in the root layout, so the graph and the server-rendered term panel
 * (siblings under it) can talk across page navigations.
 */
export function GraphProvider({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const apiRef = useRef<GraphApi | null>(null);
  const value = useMemo(() => ({ panelOpen, setPanelOpen, apiRef }), [panelOpen]);
  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>;
}

export function useGraph() {
  const state = useContext(GraphContext);
  if (!state) throw new Error("useGraph must be used inside <GraphProvider>");
  return state;
}
