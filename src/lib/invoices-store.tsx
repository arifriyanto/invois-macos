"use client";
import * as React from "react";
import type { InvoiceData, TemplateId } from "./types";
import { setRaw } from "./data-store";
import { readArray } from "./vault-read";

/** A saved invoice in the history. No "draft" state — saving = a real record. */
export interface SavedInvoice {
  id: string;
  data: InvoiceData;
  template: TemplateId;
  paid: boolean;
  /** ISO "YYYY-MM-DD" the invoice was marked paid; cleared when unpaid. Absent
   *  on legacy records (dashboard can fall back to updatedAt for those). */
  paidAt?: string;
  updatedAt: number;
}

const KEY = "invois_history";

function genId() {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Local calendar date as ISO "YYYY-MM-DD" (no timezone drift). */
function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Numbering format presets. `id` maps to an i18n label (`num.<id>`, rendered in
 *  Settings); `template` is the format string. "custom" = user-edited (not here). */
export const NUM_PRESETS: { id: string; template: string }[] = [
  { id: "tahun", template: "{PREFIX}-{YYYY}-{SEQ}" },
  { id: "bulan", template: "{PREFIX}-{YYYY}{MM}-{SEQ}" },
  { id: "klien", template: "{PREFIX}-{CLIENT}-{SEQ}" },
  { id: "berkelanjutan", template: "{PREFIX}-{SEQ}" },
];

// Short month codes for the {MMM} number token. Kept English (not localized) so
// invoice numbers stay language-neutral and stable regardless of the UI language.
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Which preset a template matches, else "custom". */
export function presetOf(template: string): string {
  return NUM_PRESETS.find((p) => p.template === template)?.id ?? "custom";
}

/** Short code from a client name: initials, up to 4 chars. */
function clientCode(name?: string): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Fill every token except {SEQ}. */
function fillNonSeq(format: string, prefix: string, clientName: string | undefined, now: Date): string {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return format
    .replace(/\{PREFIX\}/g, prefix || "INV")
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(2))
    .replace(/\{MMM\}/g, MONTHS_SHORT[now.getMonth()])
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{CLIENT\}/g, clientCode(clientName));
}

/**
 * Next number COMPUTED from existing invoices. The sequence scope = the format
 * with all tokens filled EXCEPT {SEQ}; the counter resets automatically per
 * scope (so a format with {MM} resets monthly, {CLIENT} counts per client, etc.).
 */
export function computeNextNumber(
  list: SavedInvoice[],
  opts: { format: string; prefix: string; padding: number; clientName?: string }
): string {
  const format = opts.format || "{PREFIX}-{YYYY}-{SEQ}";
  const scope = fillNonSeq(format, opts.prefix, opts.clientName, new Date())
    // Collapse separators left by an empty token (e.g. no client yet → "--")
    // and trim any stray leading/trailing dash.
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  const pad = Math.max(1, opts.padding || 3);
  const re = new RegExp("^" + escapeRegex(scope).replace(escapeRegex("{SEQ}"), "(\\d+)") + "$");
  let max = 0;
  for (const inv of list) {
    const m = re.exec(inv.data.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return scope.replace("{SEQ}", String(max + 1).padStart(pad, "0"));
}

interface InvoicesValue {
  hydrated: boolean;
  invoices: SavedInvoice[];
  /** Create (id omitted) or update (id given). Returns the record id. */
  saveInvoice: (data: InvoiceData, template: TemplateId, id?: string | null) => string;
  removeInvoice: (id: string) => void;
  /** Flip paid status (list quick-action); sets paidAt=today when marking paid. */
  togglePaid: (id: string) => void;
  /** Set paid status with an explicit paid date (editor). Clears paidAt on unpaid. */
  setPaid: (id: string, paid: boolean, at?: string) => void;
}

const Ctx = React.createContext<InvoicesValue | null>(null);

// Read once from the vault at provider init (client-only — the provider mounts
// after DataBootstrap has initialized the data store).
function loadInvoices(): SavedInvoice[] {
  return readArray<SavedInvoice>(KEY, "Invoice history");
}

export function InvoicesProvider({ children }: { children: React.ReactNode }) {
  const [invoices, setInvoices] = React.useState<SavedInvoice[]>(loadInvoices);

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
    const next = JSON.stringify(invoices);
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
  }, [invoices]);

  const saveInvoice = React.useCallback(
    (data: InvoiceData, template: TemplateId, id?: string | null) => {
      if (id) {
        setInvoices((list) =>
          list.map((r) => (r.id === id ? { ...r, data, template, updatedAt: Date.now() } : r))
        );
        return id;
      }
      const newId = genId();
      setInvoices((list) => [
        ...list,
        { id: newId, data, template, paid: false, updatedAt: Date.now() },
      ]);
      return newId;
    },
    []
  );

  const removeInvoice = React.useCallback((id: string) => {
    setInvoices((l) => l.filter((r) => r.id !== id));
  }, []);
  const setPaid = React.useCallback((id: string, paid: boolean, at?: string) => {
    setInvoices((l) =>
      l.map((r) =>
        r.id === id ? { ...r, paid, paidAt: paid ? at ?? todayISO() : undefined } : r
      )
    );
  }, []);
  const togglePaid = React.useCallback((id: string) => {
    setInvoices((l) =>
      l.map((r) =>
        r.id === id ? { ...r, paid: !r.paid, paidAt: !r.paid ? todayISO() : undefined } : r
      )
    );
  }, []);

  const value: InvoicesValue = { hydrated: true, invoices, saveInvoice, removeInvoice, togglePaid, setPaid };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInvoices(): InvoicesValue {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useInvoices must be used within InvoicesProvider");
  return c;
}
