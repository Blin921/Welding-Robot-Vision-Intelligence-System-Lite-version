"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AcquisitionHttpApi, AcquisitionDemoApi } from "../lib/acquisition/api";
import { WorkspaceStore } from "./workspace";
import type { AppMode } from "../lib/types";
const Context = createContext<WorkspaceStore | null>(null);
export function WorkspaceProvider({
  mode,
  children,
}: {
  mode: AppMode;
  children: ReactNode;
}) {
  const store = useMemo(
    () =>
      new WorkspaceStore(
        mode === "demo" ? new AcquisitionDemoApi() : new AcquisitionHttpApi(),
        mode,
      ),
    [mode],
  );
  useEffect(() => {
    void store.start();
    const visibility = () => store.setVisible(!document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      store.dispose();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const store = useContext(Context);
  if (!store) throw new Error("WorkspaceProvider is required");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return { store, state };
}
