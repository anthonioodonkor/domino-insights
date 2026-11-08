import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import type { DominoState } from "./types";
import { createPreviewStore } from "./preview/store";
const DominoContext = createContext<DominoState | null>(null);
/** Replace this provider's adapter when the new backend contract is available. */
export function DominoProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPreviewStore);
  const portfolio = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const value: DominoState = {
    portfolio, identity: store.identity,
    member: portfolio.members.find(member => member.identity === store.identity),
    connectionStatus: "preview", connectionError: undefined,
    actions: store.actions, reconnect: () => window.location.reload(),
  };
  return <DominoContext.Provider value={value}>{children}</DominoContext.Provider>;
}
export function useDomino(): DominoState {
  const value = useContext(DominoContext);
  if (!value) throw new Error("useDomino must be called inside DominoProvider.");
  return value;
}
