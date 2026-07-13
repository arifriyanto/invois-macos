"use client";
import * as native from "@/lib/native";
import * as React from "react";
import type { BusinessSettings, InvoiceData, LineItem, TemplateId } from "./types";
import { TEMPLATES, PREMIUM_TEMPLATES } from "./format";
import { loadVersioned, saveVersioned, parseVersioned, type Migration } from "./persist";
import {
  getRaw, setRaw, ensureDefaultExportDir, takeExportDirRelocation, readVaultKey,
} from "./data-store";
import { readObject } from "./vault-read";
import { useI18n } from "./i18n";

const SETTINGS_KEY = "invois_settings";
const TPL_KEY = "invois_template";
const INVOICE_KEY = "invois_invoice";
// Single source of truth: derive valid IDs from the template lists in format.ts
// so adding/removing a template only requires editing that one place.
const VALID_TEMPLATES: string[] = [...TEMPLATES, ...PREMIUM_TEMPLATES].map((t) => t.id);

// Dev-only Pro override. Real entitlement will come from the StoreKit receipt;
// until billing lands, Pro is OFF in production. In a DEV build only, a flag
// toggled from Settings → Preferences ("Pro mode (dev)") flips it locally so
// both the free and Pro experiences can be tested without editing code.
export const DEV_PRO_KEY = "invois_dev_pro";
/**
 * True only while developing — gates the Developer section in Settings and the
 * fake Pro toggle. Deliberately guarded TWICE:
 *
 *   1. NODE_ENV — a build-time constant, inlined by `next build`.
 *   2. app.isPackaged — the truth from macOS, forwarded by electron/preload.js.
 *
 * Either alone would do the job today. Both together mean a mistake in the build
 * pipeline (a dev bundle packaged by accident) still cannot hand a paying customer
 * a free Pro switch. The dev tools are worth exactly nothing to us in production;
 * the cost of being wrong is a broken paywall.
 */
export function isDevBuild(): boolean {
  return process.env.NODE_ENV !== "production" && !native.isPackaged();
}
function readDevPro(): boolean {
  if (!isDevBuild()) return false; // production: always locked to real billing
  try {
    return localStorage.getItem(DEV_PRO_KEY) === "1";
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  logo: null,
  bizName: "",
  email: "",
  phone: "",
  address: "",
  color: "#1a1a2e",
  headerBrand: "logo",
  // Neutral fallback; onboarding writes the locale-detected currency (see
  // detectDefaultCurrency) or the adopted vault's currency.
  currency: "USD",
  invPrefix: "INV",
  bankName: "",
  bankAccount: "",
  bankOwner: "",
  paymentTermDays: 14,
  defaultTaxEnabled: false,
  defaultTaxRate: 11,
  // Empty = "not customized" → new invoices fall back to a language-following
  // default note (see resetInvoice). A non-empty value here is the user's own.
  defaultNote: "",
  numPadding: 3,
  numReset: "yearly",
  numFormat: "{PREFIX}-{YYYY}-{SEQ}",
  dateFormat: "long",
  exportDir: "", // absolute folder path from the OS picker; "" = browser download
  pdfEngine: "vector", // "vector" (native print → PDF, crisp/selectable) | "raster"
  palette: "corporate", // color theme (data-palette in palettes.css)
};

// Persisted-settings schema version + migrations (see lib/persist.ts). Bump the
// version and append a migration whenever the settings shape changes.
const SETTINGS_VERSION = 5;
// The palettes we still ship (see palettes.css / settings-view PALETTES). A saved
// palette outside this set is migrated back to the default.
const KEPT_PALETTES = ["corporate", "cool-neutral", "amber-cream", "ocean", "jewel", "midnight"];
// The note that used to be baked in as the default (pre v3). Installs still
// carrying it verbatim never customized it, so v2→v3 clears it back to "" — the
// default note now follows the app language instead.
const LEGACY_DEFAULT_NOTE =
  "Terima kasih atas kepercayaan Anda. Mohon lakukan pembayaran sebelum tanggal jatuh tempo.";
const SETTINGS_MIGRATIONS: Migration[] = [
  // v0 → v1: seed the default note for installs saved before it had a value.
  (d) => {
    const s = (d ?? {}) as Partial<BusinessSettings>;
    return { ...s, defaultNote: s.defaultNote || LEGACY_DEFAULT_NOTE };
  },
  // v1 → v2: exportDir became an absolute path (was a folder name under
  // Documents). Clear any non-absolute legacy value → fall back to download.
  (d) => {
    const s = (d ?? {}) as Partial<BusinessSettings>;
    return { ...s, exportDir: s.exportDir?.startsWith("/") ? s.exportDir : "" };
  },
  // v2 → v3: the default note is now language-following. Clear the old baked-in
  // Indonesian default so uncustomized installs follow the app language again.
  (d) => {
    const s = (d ?? {}) as Partial<BusinessSettings>;
    return { ...s, defaultNote: s.defaultNote === LEGACY_DEFAULT_NOTE ? "" : s.defaultNote };
  },
  // v3 → v4: vector is the new PDF default (crisper, selectable) and the picker
  // is hidden for now, so move everyone onto it.
  (d) => {
    const s = (d ?? {}) as Partial<BusinessSettings>;
    return { ...s, pdfEngine: "vector" };
  },
  // v4 → v5: the palette set was trimmed. Reset a removed palette to the default.
  (d) => {
    const s = (d ?? {}) as Partial<BusinessSettings>;
    return { ...s, palette: s.palette && KEPT_PALETTES.includes(s.palette) ? s.palette : "corporate" };
  },
];

/**
 * Write initial business settings straight to the active vault during
 * onboarding. The store provider isn't mounted yet at that point, so we persist
 * through the same versioned envelope the store hydrates from.
 *
 * `patch` is merged over the CURRENTLY persisted settings: DEFAULT_SETTINGS for
 * a fresh vault, or the EXISTING settings when onboarding adopted an existing
 * vault — so fields outside the onboarding form (bank details, prefix, notes…)
 * are never reset.
 */
export function persistInitialSettings(patch: Partial<BusinessSettings>): void {
  saveVersioned(SETTINGS_KEY, SETTINGS_VERSION, { ...loadSettings(), ...patch });
}

/**
 * Peek at the business profile stored in a vault folder WITHOUT adopting it, so
 * onboarding can prefill its profile form from an existing vault. Returns null
 * if the folder holds no vault (a fresh location).
 */
export async function peekVaultSettings(
  dir: string
): Promise<Partial<BusinessSettings> | null> {
  const raw = await readVaultKey(dir, SETTINGS_KEY);
  if (raw == null) return null;
  return parseVersioned<Partial<BusinessSettings> | null>(
    raw,
    SETTINGS_VERSION,
    SETTINGS_MIGRATIONS,
    null
  );
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

let itemSeq = 0;
function newItem(): LineItem {
  itemSeq += 1;
  return { id: `item-${itemSeq}-${Math.random().toString(36).slice(2, 7)}`, desc: "", qty: 1, price: 0 };
}

function isoDate(d: Date) {
  // Local calendar date (YYYY-MM-DD). Using toISOString() directly would convert
  // to UTC and roll back a day for positive-offset zones (e.g. WIB, UTC+7) in the
  // early morning — so a "new invoice today" could show yesterday's date.
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}
function genNumber(prefix: string) {
  const year = new Date().getFullYear();
  return `${prefix || "INV"}-${year}-001`;
}

function defaultInvoice(): InvoiceData {
  return {
    number: "",
    date: "",
    due: "",
    note: "",
    client: { name: "", email: "", phone: "", address: "" },
    items: [newItem()],
    discountEnabled: false,
    discount: 0,
    discountType: "pct",
    taxEnabled: false,
    taxRate: 11,
  };
}

interface StoreValue {
  hydrated: boolean;
  settings: BusinessSettings;
  setSettings: (patch: Partial<BusinessSettings>) => void;
  template: TemplateId;
  setTemplate: (t: TemplateId) => void;
  /** Whether the user has unlocked Pro (premium templates, watermark-free export).
   *  UI-only for now — wire to real billing/entitlement later. */
  isPro: boolean;
  /** Global upgrade modal: opened when a free user hits a Pro-gated action. */
  upgradeOpen: boolean;
  setUpgradeOpen: (o: boolean) => void;
  /** What triggered the upgrade modal — drives its contextual header. Defaults
   *  to "template" (the only gate today); other gates can pass "general". */
  upgradeContext: "template" | "general" | "invoiceLimit" | "vaultLimit";
  setUpgradeContext: (c: "template" | "general" | "invoiceLimit" | "vaultLimit") => void;
  invoice: InvoiceData;
  updateInvoice: (patch: Partial<InvoiceData>) => void;
  updateClient: (patch: Partial<InvoiceData["client"]>) => void;
  /** Replace the whole working invoice (used when opening a saved invoice). */
  loadInvoice: (data: InvoiceData, tpl?: TemplateId) => void;
  /** Start a fresh invoice with the given number (used for "new invoice"). */
  resetInvoice: (number: string) => void;
  addItem: () => void;
  /** Append a line item pre-filled from a catalog entry. */
  addItemWith: (desc: string, price: number) => void;
  focusItemId: string | null;
  clearFocusItem: () => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<Omit<LineItem, "id">>) => void;
  reorderItems: (activeId: string, overId: string) => void;
  /** Move an item one slot up (dir -1) or down (dir +1) — touch-friendly reorder. */
  moveItem: (id: string, dir: -1 | 1) => void;
}

// Initial-state loaders (client-only). Providers mount after DataBootstrap has
// initialized the data store, so these read the vault synchronously at init —
// no hydration effect (and no extra render) needed.
function loadSettings(): BusinessSettings {
  try {
    const stored = loadVersioned<Partial<BusinessSettings> | null>(
      SETTINGS_KEY,
      SETTINGS_VERSION,
      SETTINGS_MIGRATIONS,
      null
    );
    return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function loadTemplate(): TemplateId {
  try {
    const tpl = getRaw(TPL_KEY) as TemplateId | null;
    if (tpl && VALID_TEMPLATES.includes(tpl)) return tpl;
  } catch {
    /* ignore */
  }
  return "minimal";
}
function loadInvoiceDraft(): InvoiceData {
  // Merge over defaults so newly-added fields get sane values on old saves.
  // readObject validates the shape and puts the vault into safe mode if it is
  // wrong, instead of quietly handing back a fresh invoice as if nothing happened.
  const saved = readObject<Partial<InvoiceData>>(INVOICE_KEY, "Invoice draft");
  if (saved) return { ...defaultInvoice(), ...saved };
  const today = new Date();
  const due = new Date();
  due.setDate(due.getDate() + 14);
  return {
    ...defaultInvoice(),
    number: genNumber(loadSettings().invPrefix),
    date: isoDate(today),
    due: isoDate(due),
  };
}

const StoreContext = React.createContext<StoreValue | null>(null);

export function InvoiceProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [settings, setSettingsState] = React.useState<BusinessSettings>(loadSettings);
  const [template, setTemplateState] = React.useState<TemplateId>(loadTemplate);
  const [invoice, setInvoice] = React.useState<InvoiceData>(loadInvoiceDraft);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [upgradeContext, setUpgradeContext] =
    React.useState<"template" | "general" | "invoiceLimit" | "vaultLimit">("template");
  // TODO(billing): derive from the real StoreKit entitlement once billing lands.
  // Production is always false; a dev-only Settings toggle can flip it (readDevPro).
  const [isPro] = React.useState(readDevPro);

  // Persist the invoice draft on every change, skipping the initial mount so we
  // never clobber a saved draft with the just-loaded values.
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      setRaw(INVOICE_KEY, JSON.stringify(invoice));
    } catch {
      /* ignore */
    }
  }, [invoice]);

  const setSettings = React.useCallback((patch: Partial<BusinessSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveVersioned(SETTINGS_KEY, SETTINGS_VERSION, next);
      return next;
    });
  }, []);

  // Apply the chosen color theme to <html data-palette> (see palettes.css).
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const p = settings.palette;
    if (p) document.documentElement.setAttribute("data-palette", p);
    else document.documentElement.removeAttribute("data-palette");
  }, [settings.palette]);

  // Give exports a concrete default folder: on the desktop app, keep everything
  // together by seeding exportDir with an "Exports" subfolder inside the vault
  // folder (created on demand). If there's no vault (local/web mode), fall back
  // to the OS Downloads folder; on web both fail → stays empty (browser download).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Vault was just relocated (recovery): if the export folder was the
        // DEFAULT one inside the OLD vault, follow it to the new vault. A custom
        // folder the user picked elsewhere is left untouched.
        const reloc = takeExportDirRelocation();
        if (reloc && settings.exportDir.replace(/\/+$/, "") === `${reloc.from}/Exports`) {
          const moved = await ensureDefaultExportDir();
          if (!cancelled) setSettings({ exportDir: moved ?? `${reloc.to}/Exports` });
          return;
        }

        if (settings.exportDir) return;
        const vaultExports = await ensureDefaultExportDir();
        if (cancelled) return;
        if (vaultExports) {
          setSettings({ exportDir: vaultExports });
          return;
        }
        const { downloadDir } = native.path;
        const dir = (await downloadDir()).replace(/\/+$/, "");
        if (!cancelled && dir) setSettings({ exportDir: dir });
      } catch {
        /* plain browser: no native path API → keep empty (browser download) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.exportDir, setSettings]);

  const setTemplate = React.useCallback((t: TemplateId) => {
    setTemplateState(t);
    try {
      setRaw(TPL_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const updateInvoice = React.useCallback((patch: Partial<InvoiceData>) => {
    setInvoice((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateClient = React.useCallback((patch: Partial<InvoiceData["client"]>) => {
    setInvoice((prev) => ({ ...prev, client: { ...prev.client, ...patch } }));
  }, []);

  const loadInvoice = React.useCallback((data: InvoiceData, tpl?: TemplateId) => {
    setInvoice(data);
    if (tpl) setTemplate(tpl);
  }, [setTemplate]);

  const resetInvoice = React.useCallback((number: string) => {
    const today = new Date();
    const due = new Date();
    due.setDate(due.getDate() + (settings.paymentTermDays || 14));
    setInvoice({
      ...defaultInvoice(),
      number,
      date: isoDate(today),
      due: isoDate(due),
      // No custom note set → fall back to the language-following default.
      note: settings.defaultNote || t("inv.defaultNote"),
      taxEnabled: settings.defaultTaxEnabled,
      taxRate: settings.defaultTaxRate,
    });
  }, [settings, t]);

  const [focusItemId, setFocusItemId] = React.useState<string | null>(null);
  const addItem = React.useCallback(() => {
    const item = newItem();
    setInvoice((prev) => ({ ...prev, items: [...prev.items, item] }));
    setFocusItemId(item.id);
  }, []);
  const addItemWith = React.useCallback((desc: string, price: number) => {
    setInvoice((prev) => ({ ...prev, items: [...prev.items, { ...newItem(), desc, price }] }));
  }, []);
  const clearFocusItem = React.useCallback(() => setFocusItemId(null), []);

  const removeItem = React.useCallback((id: string) => {
    setInvoice((prev) =>
      prev.items.length === 1
        ? prev
        : { ...prev, items: prev.items.filter((i) => i.id !== id) }
    );
  }, []);

  const updateItem = React.useCallback(
    (id: string, patch: Partial<Omit<LineItem, "id">>) => {
      setInvoice((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      }));
    },
    []
  );

  const reorderItems = React.useCallback((activeId: string, overId: string) => {
    setInvoice((prev) => {
      const from = prev.items.findIndex((i) => i.id === activeId);
      const to = prev.items.findIndex((i) => i.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      return { ...prev, items: arrayMove(prev.items, from, to) };
    });
  }, []);

  const moveItem = React.useCallback((id: string, dir: -1 | 1) => {
    setInvoice((prev) => {
      const from = prev.items.findIndex((i) => i.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= prev.items.length) return prev;
      return { ...prev, items: arrayMove(prev.items, from, to) };
    });
  }, []);

  const value: StoreValue = {
    hydrated: true, settings, setSettings, template, setTemplate,
    isPro, upgradeOpen, setUpgradeOpen, upgradeContext, setUpgradeContext,
    invoice, updateInvoice, updateClient, loadInvoice, resetInvoice,
    addItem, addItemWith, removeItem, updateItem, reorderItems, moveItem,
    focusItemId, clearFocusItem,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within InvoiceProvider");
  return ctx;
}
