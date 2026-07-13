"use client";
import * as React from "react";
import { List, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/currency-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/field";
import { useCatalog, type CatalogInput, type CatalogItem } from "@/lib/catalog-store";
import { useConfirm } from "@/lib/confirm";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";

const EMPTY: CatalogInput = { desc: "", priceMinor: 0 };

export function CatalogList() {
  const { items, addItem, updateItem, removeItem } = useCatalog();
  const confirm = useConfirm();
  const { settings } = useStore();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<CatalogInput>(EMPTY);
  const set = (patch: Partial<CatalogInput>) => setDraft((d) => ({ ...d, ...patch }));

  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const PER_PAGE = 20;
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.desc.toLowerCase().includes(q));
  }, [items, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  function openNew() {
    setEditId(null);
    setDraft(EMPTY);
    setOpen(true);
  }
  function openEdit(it: CatalogItem) {
    setEditId(it.id);
    setDraft({ desc: it.desc, priceMinor: it.priceMinor });
    setOpen(true);
  }
  function save() {
    if (!draft.desc.trim()) return;
    if (editId) updateItem(editId, draft);
    else addItem(draft);
    setOpen(false);
  }
  async function onDelete(it: CatalogItem) {
    const ok = await confirm({
      title: t("dlg.delItem"),
      description: t("dlg.delNameDesc").replace("{x}", it.desc),
      destructive: true,
    });
    if (ok) removeItem(it.id);
  }

  return (
    <div className="flex flex-col lg:h-[calc(100vh-2.5rem)]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-medium">{t("nav.katalog")}</h1>
          <span className="text-xs text-muted-foreground">{items.length}</span>
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
              placeholder={t("list.searchItem")}
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" />
            {t("list.newItem")}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-16 text-center text-muted-foreground">
          <List className="size-8 opacity-40" />
          <p className="text-sm">{t("list.emptyItems")}</p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("f.desc")}</TableHead>
                <TableHead className="text-right">{t("list.defaultPrice")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.desc}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatMoney(it.priceMinor, settings.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openEdit(it)}
                        title={t("act.edit")}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(it)}
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
        <DialogContent className="lg:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editId ? t("dlg.editItem") : t("dlg.newItem")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t("f.desc")}>
              <Input
                value={draft.desc}
                placeholder={t("ph.itemDesc")}
                onChange={(e) => set({ desc: e.target.value })}
              />
            </Field>
            <Field label={t("list.defaultPrice")}>
              <CurrencyInput
                currency={settings.currency}
                value={draft.priceMinor}
                onValueChange={(n) => set({ priceMinor: n })}
              />
            </Field>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("f.cancel")}
            </Button>
            <Button size="sm" onClick={save} disabled={!draft.desc.trim()}>
              {t("ed.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
