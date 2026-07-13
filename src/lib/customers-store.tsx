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

  // Persist on change, skipping the initial mount (data was just loaded).
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      setRaw(KEY, JSON.stringify(customers));
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
