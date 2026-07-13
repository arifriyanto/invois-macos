"use client";
/**
 * InvoiceForm — the form-first (flat, line-separated sections) invoice form.
 * Wired to the real store; reuses <LineItems/> from components/line-items.tsx.
 */
import * as React from "react";
import { Check, ChevronsUpDown, Pencil, Plus, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCustomers, type Customer, type CustomerInput } from "@/lib/customers-store";
import { LineItems } from "@/components/line-items";
import { Field } from "@/components/field";
import { DateField } from "@/components/date-field";
import { CurrencyInput } from "@/components/currency-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Beacon } from "@/components/ui/beacon";
import { CURRENCY_SYMBOLS, PHONE_PLACEHOLDER } from "@/lib/format";
import type { DiscountType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useEditorActions } from "@/lib/editor-actions";
import { cn } from "@/lib/utils";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[13px] font-semibold text-foreground">{children}</h3>;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function ClientCombobox({
  customers,
  currentName,
  currentEmail,
  onPick,
  onAddNew,
}: {
  customers: Customer[];
  currentName: string;
  currentEmail: string;
  onPick: (c: Customer) => void;
  onAddNew: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const hasClient = Boolean(currentName.trim());
  const showSearch = customers.length > 8;
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? customers.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s))
      : customers;
    return base.slice(0, 50);
  }, [customers, q]);

  if (!hasClient && customers.length === 0) {
    return (
      <Button variant="outline" className="w-full justify-start gap-2 border-input bg-card" onClick={onAddNew}>
        <UserPlus className="size-4" /> {t("cust.add")}
      </Button>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        {hasClient ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg border border-input bg-card px-3 py-2.5 text-left transition-colors hover:border-input bg-card"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
              {initials(currentName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{currentName}</div>
              {currentEmail && <div className="truncate text-xs text-muted-foreground">{currentEmail}</div>}
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-input bg-card"
          >
            <span className="flex items-center gap-2">
              <UserPlus className="size-4" /> {t("cust.pickOrAdd")}
            </span>
            <ChevronsUpDown className="size-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        {showSearch && (
          <div className="border-b p-2">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("cust.searchPh")}
              className="h-8"
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto scrollbar-thin p-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">{t("cust.noResults")}</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{c.name}</div>
                  {c.email && <div className="truncate text-xs text-muted-foreground">{c.email}</div>}
                </div>
                {c.name === currentName && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            ))
          )}
        </div>
        <div className="border-t p-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddNew();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            <Plus className="size-4" /> {t("cust.addNew")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function InvoiceForm() {
  const { invoice, updateInvoice, updateClient, settings } = useStore();
  const { customers, addCustomer } = useCustomers();
  const { t } = useI18n();
  const [editNum, setEditNum] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<CustomerInput>({ name: "", email: "", phone: "", address: "" });
  const dueInvalid = Boolean(invoice.date && invoice.due && invoice.due < invoice.date);
  const editorActions = useEditorActions();
  // First-invoice walkthrough: beacon the client field until a client is chosen.
  const coach = editorActions?.coach ?? false;
  const clientBeacon = coach && !invoice.client.name.trim();
  // Invoice number: freely editable while creating (draft, nothing issued yet);
  // locked behind the pencil once the invoice has been saved, to guard an issued
  // number from accidental changes.
  const saved = editorActions?.saved ?? false;
  const numberLocked = saved && !editNum;

  return (
    <aside className="h-full overflow-y-auto overflow-x-hidden scrollbar-soft bg-background">
      <div className="mx-auto max-w-[560px] divide-y px-4 pb-10">
        {/* Detail Invoice */}
        <section className="space-y-4 py-4">
          <SectionTitle>{t("sec.detail")}</SectionTitle>
          <Field label={t("num.klien")}>
            <div className="relative rounded-lg">
              <ClientCombobox
                customers={customers}
                currentName={invoice.client.name}
                currentEmail={invoice.client.email}
                onPick={(c) => updateClient({ name: c.name, email: c.email, phone: c.phone, address: c.address })}
                onAddNew={() => {
                  setDraft({ name: "", email: "", phone: "", address: "" });
                  setAddOpen(true);
                }}
              />
              {clientBeacon && <Beacon />}
            </div>
          </Field>
          <Field label={t("f.invNumber")}>
            <div className="flex gap-2">
              <Input
                value={invoice.number}
                disabled={numberLocked}
                autoFocus={editNum}
                placeholder="—"
                className="border-input bg-card font-mono"
                onChange={(e) => updateInvoice({ number: e.target.value })}
              />
              {saved && (
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={editNum ? t("done") : t("f.editNumber")}
                  title={editNum ? t("done") : t("f.editNumber")}
                  onClick={() => setEditNum((v) => !v)}
                >
                  {editNum ? <Check className="size-4" /> : <Pencil className="size-4" />}
                </Button>
              )}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("f.date")}>
              <DateField value={invoice.date} onChange={(v) => updateInvoice({ date: v })} />
            </Field>
            <Field label={t("f.due")} error={dueInvalid ? t("f.beforeDate") : undefined}>
              <DateField value={invoice.due} min={invoice.date} invalid={dueInvalid} onChange={(v) => updateInvoice({ due: v })} />
            </Field>
          </div>
        </section>

        {/* Daftar Produk / Jasa — reuse the original LineItems (drag, amount chip, dashed add) */}
        <section className="space-y-2 py-4">
          <SectionTitle>{t("sec.items")}</SectionTitle>
          <LineItems />
        </section>

        {/* Diskon & Pajak */}
        <section className="space-y-2 py-4">
          <SectionTitle>{t("sec.summary")}</SectionTitle>
          {/* Diskon */}
          <div className="flex h-10 items-center gap-2">
            <Switch checked={invoice.discountEnabled} onCheckedChange={(v) => updateInvoice({ discountEnabled: v })} aria-label={t("f.discount")} />
            <span className={cn("w-14 shrink-0 text-sm", !invoice.discountEnabled && "text-muted-foreground")}>{t("f.discount")}</span>
            {invoice.discountEnabled && (
              <>
                <Select value={invoice.discountType} onValueChange={(v) => updateInvoice({ discountType: v as DiscountType })}>
                  <SelectTrigger size="sm" className="h-8 w-16 shrink-0 gap-1 border-input bg-card px-2.5" aria-label={t("f.discountType")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pct">%</SelectItem>
                    <SelectItem value="flat">{CURRENCY_SYMBOLS[settings.currency]}</SelectItem>
                  </SelectContent>
                </Select>
                {invoice.discountType === "flat" ? (
                  <div className="flex-1">
                    <CurrencyInput currency={settings.currency} value={invoice.discountValue} className="h-8 border-input bg-card" onValueChange={(n) => updateInvoice({ discountValue: n })} />
                  </div>
                ) : (
                  <Input type="number" min={0} max={100} className="no-spinner h-8 flex-1 border-input bg-card" value={invoice.discountValue === 0 ? "" : invoice.discountValue} placeholder="0" onChange={(e) => updateInvoice({ discountValue: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })} />
                )}
              </>
            )}
          </div>
          {/* PPN */}
          <div className="flex h-10 items-center gap-2">
            <Switch checked={invoice.taxEnabled} onCheckedChange={(v) => updateInvoice({ taxEnabled: v })} aria-label={t("f.ppn")} />
            <span className={cn("w-14 shrink-0 text-sm", !invoice.taxEnabled && "text-muted-foreground")}>{t("f.ppn")}</span>
            {invoice.taxEnabled && (
              <>
                <Input type="number" min={0} max={100} className="h-8 w-24 border-input bg-card" value={invoice.taxRate} placeholder="0" onChange={(e) => updateInvoice({ taxRate: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })} />
                <span className="text-sm text-muted-foreground">%</span>
              </>
            )}
          </div>
        </section>

        {/* Catatan */}
        <section className="space-y-2 py-4">
          <SectionTitle>{t("sec.note")}</SectionTitle>
          <Textarea value={invoice.note} className="border-input bg-card" placeholder={t("ph.noteClient")} onChange={(e) => updateInvoice({ note: e.target.value })} />
        </section>
      </div>

      {/* Add-client popup — on save it becomes the selected client */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="lg:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("cust.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t("f.name")}>
              <Input value={draft.name} placeholder={t("ph.clientCompany")} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("f.email")}>
                <Input type="email" value={draft.email} placeholder={t("ph.email")} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
              </Field>
              <Field label={t("bk.phone")}>
                <Input value={draft.phone} placeholder={PHONE_PLACEHOLDER[settings.currency]} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
              </Field>
            </div>
            <Field label={t("f.address")}>
              <Textarea value={draft.address} placeholder={t("ph.address")} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
            </Field>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>{t("f.cancel")}</Button>
            <Button
              size="sm"
              disabled={!draft.name.trim()}
              onClick={() => {
                if (!draft.name.trim()) return;
                addCustomer(draft);
                updateClient({ name: draft.name, email: draft.email, phone: draft.phone, address: draft.address });
                setAddOpen(false);
              }}
            >
              {t("ed.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
