"use client";
import * as React from "react";
import { setRaw } from "./data-store";
import { readArray } from "./vault-read";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export type CustomerInput = Omit<Customer, "id">;

const KEY = "invois_customers";

function genId() {
  return `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Read once from the vault at provider init (client-only — the provider mounts
// after DataBootstrap has initialized the data store).
function loadCustomers(): Customer[] {
  return readArray<Customer>(KEY, "Clients");
}

interface CustomersValue {
  hydrated: boolean;
  customers: Customer[];
  addCustomer: (data: CustomerInput) => void;
  updateCustomer: (id: string, patch: Partial<CustomerInput>) => void;
  removeCustomer: (id: string) => void;
}

const Ctx = React.createContext<CustomersValue | null>(null);

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = React.useState<Customer[]>(loadCustomers);

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
    const next = JSON.stringify(customers);
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
  }, [customers]);

  const addCustomer = React.useCallback((data: CustomerInput) => {
    setCustomers((cs) => [...cs, { ...data, id: genId() }]);
  }, []);
  const updateCustomer = React.useCallback((id: string, patch: Partial<CustomerInput>) => {
    setCustomers((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);
  const removeCustomer = React.useCallback((id: string) => {
    setCustomers((cs) => cs.filter((c) => c.id !== id));
  }, []);

  const value: CustomersValue = { hydrated: true, customers, addCustomer, updateCustomer, removeCustomer };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomers(): CustomersValue {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useCustomers must be used within CustomersProvider");
  return c;
}
