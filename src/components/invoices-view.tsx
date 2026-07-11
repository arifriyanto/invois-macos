"use client";
import * as React from "react";
import { Editor } from "@/components/editor/editor";
import { InvoiceHistory, type HistoryFilter } from "@/components/invoice-history";
import { InvoiceSuccessModal } from "@/components/invoice-success-modal";
import { EditorActionsProvider } from "@/lib/editor-actions";
import { useStore } from "@/lib/store";
import { computeNextNumber, useInvoices, type SavedInvoice } from "@/lib/invoices-store";
import { useCatalog } from "@/lib/catalog-store";
import { FREE_INVOICE_LIMIT } from "@/lib/limits";

// Module-level (survives remounts of InvoicesView): the highest New Invoice
// token already acted on, and whether the first-run walkthrough is done. This
// view unmounts when you leave the Invoices tab, so component refs would reset.
let processedNewInvoiceToken = 0;
let coachDone = false;

export function InvoicesView({
  filter,
  onClearFilter,
  firstRun,
  newInvoiceToken,
}: {
  filter?: HistoryFilter | null;
  onClearFilter?: () => void;
  /** True only for the onboarding first-run session (drives the beacons). */
  firstRun?: boolean;
  /** Bumps each time "New Invoice" is requested (onboarding boot + File → New). */
  newInvoiceToken?: number;
} = {}) {
  const {
    invoice, template, settings, loadInvoice, resetInvoice, updateInvoice,
    isPro, setUpgradeOpen, setUpgradeContext,
  } = useStore();
  const { invoices, saveInvoice, setPaid: setRecordPaid } = useInvoices();
  const { items: catalogItems, addItem: addCatalogItem } = useCatalog();
  const [mode, setMode] = React.useState<"list" | "editor">("list");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // First-invoice walkthrough (pulsing field beacons). On for the onboarding
  // first-run until the first successful save (coachDone survives remounts).
  const [coach, setCoach] = React.useState(() => Boolean(firstRun) && !coachDone);
  const [saveToken, setSaveToken] = React.useState(0);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const successTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  const nextNum = React.useCallback(
    (clientName?: string) =>
      computeNextNumber(invoices, {
        format: settings.numFormat,
        prefix: settings.invPrefix,
        padding: settings.numPadding,
        clientName,
      }),
    [invoices, settings.numFormat, settings.invPrefix, settings.numPadding]
  );

  // Auto-generated number for a NEW invoice. Regenerate whenever the numbering
  // settings (or client, for {CLIENT} formats) change — but stop once the user
  // has manually edited it (via the pencil), so a hand-set number isn't clobbered.
  const autoNum = React.useRef("");
  React.useEffect(() => {
    if (mode !== "editor" || editingId !== null) return;
    const n = nextNum(invoice.client.name);
    if (n !== invoice.number && invoice.number === autoNum.current) {
      autoNum.current = n;
      updateInvoice({ number: n });
    }
  }, [
    mode,
    editingId,
    settings.numFormat,
    settings.invPrefix,
    settings.numPadding,
    invoice.client.name,
    invoice.number,
    nextNum,
    updateInvoice,
  ]);

  // Free-tier cap, enforced at CREATION time (kinder than blocking at save, after
  // the user has filled everything in). Returns false + opens the upgrade popup
  // when a free user at the limit tries to start another invoice. Covers every
  // "new record" entry point (New, Duplicate, ⌘N/File→New); editing an existing
  // invoice is never gated. commit() keeps a matching backstop for the rare
  // persisted-draft case (a 4th draft started before the gate existed).
  const gateNewInvoice = React.useCallback((): boolean => {
    if (!isPro && invoices.length >= FREE_INVOICE_LIMIT) {
      setUpgradeContext("invoiceLimit");
      setUpgradeOpen(true);
      return false;
    }
    return true;
  }, [isPro, invoices.length, setUpgradeContext, setUpgradeOpen]);

  const openNew = React.useCallback(() => {
    if (!gateNewInvoice()) return;
    const n = nextNum();
    autoNum.current = n;
    resetInvoice(n);
    setEditingId(null);
    setMode("editor");
  }, [gateNewInvoice, nextNum, resetInvoice]);
  function openExisting(rec: SavedInvoice) {
    loadInvoice(rec.data, rec.template);
    setEditingId(rec.id);
    setMode("editor");
  }
  function duplicate(rec: SavedInvoice) {
    if (!gateNewInvoice()) return;
    const n = nextNum(rec.data.client.name);
    autoNum.current = n;
    loadInvoice({ ...rec.data, number: n }, rec.template);
    setEditingId(null);
    setMode("editor");
  }
  function commit(silent?: boolean) {
    const wasNew = editingId === null;
    // Backstop for the free-tier cap. The primary gate is at creation time
    // (gateNewInvoice); this catches the edge where a 4th invoice was already
    // open as a persisted draft before the gate existed. Editing an existing
    // invoice is never gated.
    if (wasNew && !isPro && invoices.length >= FREE_INVOICE_LIMIT) {
      setUpgradeContext("invoiceLimit");
      setUpgradeOpen(true);
      return;
    }
    const id = saveInvoice(invoice, template, editingId);
    setEditingId(id);
    if (coach) { coachDone = true; setCoach(false); } // walkthrough ends at the first save

    // File any brand-new line items into the catalog for reuse next time.
    // Match on description (case-insensitive) so existing entries aren't duped
    // or overwritten; a blank description is skipped.
    const seen = new Set(catalogItems.map((c) => c.desc.trim().toLowerCase()));
    for (const it of invoice.items) {
      const desc = it.desc.trim();
      if (!desc || seen.has(desc.toLowerCase())) continue;
      seen.add(desc.toLowerCase());
      addCatalogItem({ desc, price: it.price });
    }
    if (silent) return;
    // First save = a milestone → celebrate with the success modal. Re-saves are
    // routine → plain toast.
    if (wasNew) {
      // Wait for the Save button's ~500ms Menyimpan… → ✓ Tersimpan animation
      // to settle before the modal appears, so the transition feels smooth.
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccessOpen(true), 550);
    } else setSaveToken((n) => n + 1);
  }

  // Open a blank editor whenever the New Invoice token advances (onboarding boot
  // + File → New Invoice / ⌘N). Guarded by a module-level marker so navigating
  // back to this view (a remount) doesn't re-fire on an already-handled token.
  React.useEffect(() => {
    if (newInvoiceToken && newInvoiceToken > processedNewInvoiceToken) {
      processedNewInvoiceToken = newInvoiceToken;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: react to an external New-Invoice signal.
      openNew();
    }
  }, [newInvoiceToken, openNew]);

  // Dirty-state: the export gate. Compare the live invoice against its saved
  // snapshot so "what you export always equals what's saved".
  const savedRec = editingId ? invoices.find((r) => r.id === editingId) ?? null : null;
  const saved = savedRec !== null;
  const dirty =
    !savedRec ||
    savedRec.template !== template ||
    JSON.stringify(savedRec.data) !== JSON.stringify(invoice);
  const canExport = saved && !dirty;
  const paid = savedRec?.paid ?? false;
  const paidAt = savedRec?.paidAt;
  const setPaid = React.useCallback(
    (p: boolean, at?: string) => {
      if (editingId) setRecordPaid(editingId, p, at);
    },
    [editingId, setRecordPaid]
  );

  if (mode === "list") {
    return (
      <InvoiceHistory
        onNew={openNew}
        onOpen={openExisting}
        onDuplicate={duplicate}
        filter={filter}
        onClearFilter={onClearFilter}
      />
    );
  }
  return (
    <EditorActionsProvider
      value={{ onBack: () => setMode("list"), onNew: openNew, onCommit: commit, saved, dirty, canExport, paid, paidAt, setPaid, saveToken, coach }}
    >
      <Editor />
      <InvoiceSuccessModal
        open={successOpen}
        onClose={() => { setSuccessOpen(false); setMode("list"); }}
        onCreateAnother={() => { setSuccessOpen(false); openNew(); }}
      />
    </EditorActionsProvider>
  );
}
