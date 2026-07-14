"use client";
import * as React from "react";
import { setRaw } from "./data-store";
import { readArray } from "./vault-read";

export interface CatalogItem {
  id: string;
  desc: string;
  /** Integer minor units — see lib/money.ts. */
  priceMinor: number;
}
export type CatalogInput = Omit<CatalogItem, "id">;

const KEY = "invois_catalog";

function genId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Read once from the vault at provider init (client-only — the provider mounts
// after DataBootstrap has initialized the data store).
function loadCatalog(): CatalogItem[] {
  return readArray<CatalogItem>(KEY, "Catalog");
}

interface CatalogValue {
  hydrated: boolean;
  items: CatalogItem[];
  addItem: (data: CatalogInput) => void;
  updateItem: (id: string, patch: Partial<CatalogInput>) => void;
  removeItem: (id: string) => void;
}

const Ctx = React.createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CatalogItem[]>(loadCatalog);

  // Persist on change — and NOTHING on load.
  //
  // This used to be a `firstRun` ref: skip the first effect run, write on every
  // one after. React StrictMode invokes effects TWICE in development — run, clean
  // up, run again — so the first invocation flipped the flag and the second one
  // WROTE. Merely opening the app persisted this collection, and on a legacy vault
  // that write dragged the format-3 migration along with it, converting a file the
  // user had never touched. Arif caught it with an md5 (QA 9.2), three times.
  //
  // A one-shot boolean is not a guard against work that can be replayed. So we hold
  // the value we LOADED and compare against it: identical means the user has changed
  // nothing, whatever React did to our effects. That is idempotent by construction,
  // which is exactly what StrictMode is asking for.
  const loaded = React.useRef<string | null>(null);
  React.useEffect(() => {
    const next = JSON.stringify(items);
    if (loaded.current === null) {
      loaded.current = next; // what came off disk — nothing to save yet
      return;
    }
    if (next === loaded.current) return; // unchanged → the vault stays untouched
    try {
      setRaw(KEY, next);
      loaded.current = next;
    } catch {
      /* ignore */
    }
  }, [items]);

  const addItem = React.useCallback((data: CatalogInput) => {
    setItems((l) => [...l, { ...data, id: genId() }]);
  }, []);
  const updateItem = React.useCallback((id: string, patch: Partial<CatalogInput>) => {
    setItems((l) => l.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);
  const removeItem = React.useCallback((id: string) => {
    setItems((l) => l.filter((it) => it.id !== id));
  }, []);

  const value: CatalogValue = { hydrated: true, items, addItem, updateItem, removeItem };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogValue {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useCatalog must be used within CatalogProvider");
  return c;
}
