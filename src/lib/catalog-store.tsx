"use client";
import * as React from "react";
import { getRaw, setRaw } from "./data-store";

export interface CatalogItem {
  id: string;
  desc: string;
  price: number;
}
export type CatalogInput = Omit<CatalogItem, "id">;

const KEY = "invois_catalog";

function genId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Read once from the vault at provider init (client-only — the provider mounts
// after DataBootstrap has initialized the data store).
function loadCatalog(): CatalogItem[] {
  try {
    const raw = getRaw(KEY);
    return raw ? (JSON.parse(raw) as CatalogItem[]) : [];
  } catch {
    return [];
  }
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

  // Persist on change, skipping the initial mount (data was just loaded).
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      setRaw(KEY, JSON.stringify(items));
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
