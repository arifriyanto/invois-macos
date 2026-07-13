"use client";
import * as React from "react";
import { Copy, FileText, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceStatusPill } from "@/components/invoice-status-pill";
import { useInvoices, type SavedInvoice } from "@/lib/invoices-store";
import { useConfirm } from "@/lib/confirm";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { calcTotals, formatMoney, formatDate } from "@/lib/format";
import type { InvoiceData } from "@/lib/types";

// This used to be a hand-rolled SECOND copy of the totals maths — subtotal,
// discount, tax, in that order — sitting a few files away from the real one. Two
// implementations of the same sum is one too many: they were already drifting
// (this one clamped after the discount, calcTotals clamped the discount itself),
// so a rounding rule fixed in one place would quietly not apply in the other and
// the history list could disagree with the invoice it was listing.
function total(d: InvoiceData): number {
  return calcTotals(d).total;
}

/** A drill-down filter passed in from the dashboard (AND-combined with search). */
export type HistoryFilter = {
  status?: "paid" | "unpaid" | "overdue" | "due";
  month?: string; // YYYY-MM
  client?: string;
  label: string; // localized chip text
};

const todayISO = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function InvoiceHistory({
  onNew,
  onOpen,
  onDuplicate,
  filter,
  onClearFilter,
}: {
  onNew: () => void;
  onOpen: (rec: SavedInvoice) => void;
  onDuplicate: (rec: SavedInvoice) => void;
  filter?: HistoryFilter | null;
  onClearFilter?: () => void;
}) {
  const { invoices, removeInvoice, togglePaid } = useInvoices();
  const confirm = useConfirm();
  const { settings } = useStore();
  const { t, lang } = useI18n();
  const fmtDate = (iso: string) => formatDate(iso, lang, settings.dateFormat);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "unpaid" | "overdue" | "paid">("all");
  const [sort, setSort] = React.useState<"recent" | "oldest" | "amount" | "due">("recent");
  const [page, setPage] = React.useState(1);
  const PER_PAGE = 20;
  // Jump back to page 1 whenever the active filters change. React's endorsed
  // "adjust state during render" pattern (compare a signature of the inputs to
  // the previous one) — avoids an effect + the cascading-render lint warning.
  const filterSig = `${filter}|${status}|${sort}|${query}`;
  const [prevFilterSig, setPrevFilterSig] = React.useState(filterSig);
  if (filterSig !== prevFilterSig) {
    setPrevFilterSig(filterSig);
    setPage(1);
  }

  const sorted = React.useMemo(() => {
    const arr = [...invoices];
    switch (sort) {
      case "recent":
        arr.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case "oldest":
        arr.sort((a, b) => a.updatedAt - b.updatedAt);
        break;
      case "amount":
        arr.sort((a, b) => total(b.data) - total(a.data));
        break;
      case "due":
        arr.sort((a, b) => (a.data.due || "9999-99-99").localeCompare(b.data.due || "9999-99-99"));
        break;
    }
    return arr;
  }, [invoices, sort]);

  const filtered = React.useMemo(() => {
    const today = todayISO();
    const q = query.trim().toLowerCase();
    return sorted.filter((r) => {
      if (status !== "all") {
        const overdue = !r.paid && !!r.data.due && r.data.due < today;
        if (status === "paid" && !r.paid) return false;
        if (status === "unpaid" && r.paid) return false; // all outstanding
        if (status === "overdue" && !overdue) return false;
      }
      if (filter?.client && r.data.client.name !== filter.client) return false;
      if (filter?.month && (r.data.date || "").slice(0, 7) !== filter.month) return false;
      if (filter?.status) {
        const overdue = !r.paid && !!r.data.due && r.data.due < today;
        if (filter.status === "paid" && !r.paid) return false;
        if (filter.status === "unpaid" && r.paid) return false;
        if (filter.status === "overdue" && !overdue) return false;
        if (filter.status === "due" && (r.paid || overdue)) return false;
      }
      if (q && !(r.data.number.toLowerCase().includes(q) || r.data.client.name.toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [sorted, query, filter, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  return (
    <div className="flex flex-col lg:h-[calc(100vh-2.5rem)]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-medium">{t("nav.invoices")}</h1>
          <span className="text-xs text-muted-foreground">{invoices.length}</span>
          {filter && (
            <button
              type="button"
              onClick={onClearFilter}
              title={t("list.clearFilter")}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              {filter.label}
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-8 w-[132px]" aria-label={t("list.filterStatus")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">{t("list.stAll")}</SelectItem>
              <SelectItem value="unpaid">{t("st.unpaid")}</SelectItem>
              <SelectItem value="overdue">{t("st.overdue")}</SelectItem>
              <SelectItem value="paid">{t("st.paid")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="h-8 w-[150px]" aria-label={t("list.sortBy")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="recent">{t("list.sortRecent")}</SelectItem>
              <SelectItem value="oldest">{t("list.sortOldest")}</SelectItem>
              <SelectItem value="amount">{t("list.sortAmount")}</SelectItem>
              <SelectItem value="due">{t("list.sortDue")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("list.searchInvoice")}
              className="h-8 w-48 pl-8"
            />
          </div>
          <Button size="sm" onClick={onNew}>
            <Plus className="size-4" />
            {t("list.newInvoice")}
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-16 text-center text-muted-foreground">
          <FileText className="size-8 opacity-40" />
          <p className="text-sm">{t("list.emptyInvoices")}</p>
          <Button size="sm" variant="outline" onClick={onNew}>
            <Plus className="size-4" />
            {t("list.firstInvoice")}
          </Button>
        </div>
      ) : (
        <>
        <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("list.number")}</TableHead>
              <TableHead>{t("list.customer")}</TableHead>
              <TableHead>{t("f.date")}</TableHead>
              <TableHead className="text-right">{t("list.total")}</TableHead>
              <TableHead className="text-right">{t("list.status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((rec) => {
              return (
              <TableRow key={rec.id}>
                <TableCell
                  className="cursor-pointer font-mono text-xs"
                  onClick={() => onOpen(rec)}
                >
                  {rec.data.number || "—"}
                </TableCell>
                <TableCell className="cursor-pointer font-medium" onClick={() => onOpen(rec)}>
                  {rec.data.client.name || <span className="font-normal text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(rec.data.date)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(total(rec.data), settings.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <InvoiceStatusPill
                    paid={rec.paid}
                    due={rec.data.due}
                    onToggle={() => togglePaid(rec.id)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onDuplicate(rec)}
                      title={t("list.duplicate")}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                    >
                      <Copy className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: t("dlg.delInvoice"),
                          description: t("dlg.delInvoiceDesc").replace("{x}", rec.data.number || "—"),
                          destructive: true,
                        });
                        if (ok) removeInvoice(rec.id);
                      }}
                      title={t("act.delete")}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-black/5 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {query ? `${t("list.noResultsFor")} “${query}”.` : t("list.noResults")}
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
    </div>
  );
}
