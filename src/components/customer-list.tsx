"use client";
import * as React from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { PHONE_PLACEHOLDER } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/field";
import { useCustomers, type Customer, type CustomerInput } from "@/lib/customers-store";
import { useConfirm } from "@/lib/confirm";
import { useI18n } from "@/lib/i18n";

const EMPTY: CustomerInput = { name: "", email: "", phone: "", address: "" };

export function CustomerList() {
  const { customers, addCustomer, updateCustomer, removeCustomer } = useCustomers();
  const confirm = useConfirm();
  const { t } = useI18n();
  // Only for the phone placeholder: its SHAPE follows the user's country, and the
  // chosen currency is the closest signal we have for that (see PHONE_PLACEHOLDER).
  const { settings } = useStore();
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<CustomerInput>(EMPTY);
  const set = (patch: Partial<CustomerInput>) => setDraft((d) => ({ ...d, ...patch }));

  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const PER_PAGE = 20;
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  function openNew() {
    setEditId(null);
    setDraft(EMPTY);
    setOpen(true);
  }
  function openEdit(c: Customer) {
    setEditId(c.id);
    setDraft({ name: c.name, email: c.email, phone: c.phone, address: c.address });
    setOpen(true);
  }
  function save() {
    if (!draft.name.trim()) return;
    if (editId) updateCustomer(editId, draft);
    else addCustomer(draft);
    setOpen(false);
  }
  async function onDelete(c: Customer) {
    const ok = await confirm({
      title: t("dlg.delCustomer"),
      description: t("dlg.delNameDesc").replace("{x}", c.name),
      destructive: true,
    });
    if (ok) removeCustomer(c.id);
  }

  return (
    <div className="flex flex-col lg:h-[calc(100vh-2.5rem)]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-medium">{t("nav.customers")}</h1>
          <span className="text-xs text-muted-foreground">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t("list.searchCustomer")}
              className="h-8 w-56 pl-8"
            />
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" />
            {t("list.newCustomer")}
          </Button>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-16 text-center text-muted-foreground">
          <Users className="size-8 opacity-40" />
          <p className="text-sm">{t("list.emptyCustomers")}</p>
        </div>
      ) : (
        <>
        <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("f.name")}</TableHead>
              <TableHead>{t("f.email")}</TableHead>
              <TableHead>{t("bk.phone")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      title={t("act.edit")}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(c)}
                      title={t("act.delete")}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {t("list.noResultsFor")} “{query}”.
          </div>
        )}
        </div>
        {filtered.length > PER_PAGE && (
          <div className="flex shrink-0 items-center justify-between border-t bg-background px-4 py-3 text-sm text-muted-foreground">
            <span>
              {(curPage - 1) * PER_PAGE + 1}–{Math.min(curPage * PER_PAGE, filtered.length)} {t("list.of")} {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>
                {t("list.prev")}
              </Button>
              <span className="text-xs">{t("list.page")} {curPage}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>
                {t("list.next")}
              </Button>
            </div>
          </div>
        )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="lg:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editId ? t("dlg.editCustomer") : t("dlg.newCustomer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t("f.name")}>
              <Input
                value={draft.name}
                placeholder={t("ph.clientCompany")}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("f.email")}>
                <Input type="email" value={draft.email} placeholder={t("ph.email")} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label={t("bk.phone")}>
                <Input value={draft.phone} placeholder={PHONE_PLACEHOLDER[settings.currency]} onChange={(e) => set({ phone: e.target.value })} />
              </Field>
            </div>
            <Field label={t("f.address")}>
              <Textarea
                className="max-h-[104px]"
                value={draft.address}
                placeholder={t("ph.address")}
                onChange={(e) => set({ address: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("f.cancel")}
            </Button>
            <Button size="sm" onClick={save} disabled={!draft.name.trim()}>
              {t("ed.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
