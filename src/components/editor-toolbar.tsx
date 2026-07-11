"use client";
import * as React from "react";
import { Check, ChevronLeft, FileText, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useEditorActions } from "@/lib/editor-actions";
import { useInvoiceExport } from "@/lib/use-invoice-export";
import { Button } from "@/components/ui/button";
import { PaidControl } from "@/components/paid-control";
import { Beacon } from "@/components/ui/beacon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function EditorToolbar() {
  const { invoice } = useStore();
  const { t } = useI18n();
  const actions = useEditorActions();
  const { busy, exportPdf, exportPng } = useInvoiceExport();
  // Export (PDF/PNG) is only available for a SAVED invoice, and only when there
  // are no unsaved changes — so the exported file always matches the record.
  // New/never-saved invoices hide the buttons entirely; a saved-but-dirty invoice
  // shows them disabled with a "save first" tooltip.
  const showExport = actions?.saved ?? false;
  const exportBlocked = actions ? actions.dirty : false;
  // First-invoice walkthrough: beacon the Save button once client + a real item
  // are in place (i.e. there's actually something worth saving).
  const saveBeacon =
    !!actions?.coach &&
    !!invoice.client.name.trim() &&
    invoice.items.some((it) => it.desc.trim()) &&
    !!actions?.dirty;

  // Brief "saving" phase for a smooth Simpan → ✓ Tersimpan transition. The save
  // itself is instant; the spinner is purely cosmetic feedback (~500ms).
  const [saving, setSaving] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const handleSave = React.useCallback(() => {
    if (!actions || saving) return;
    setSaving(true);
    actions.onCommit(); // actual save happens now (no data-loss window)
    timer.current = setTimeout(() => setSaving(false), 500);
  }, [actions, saving]);

  // Plain confirmation after a successful save. Export lives permanently in the
  // preview header, so the toast no longer duplicates PDF/PNG actions.
  const saveToken = actions?.saveToken ?? 0;
  const prevToken = React.useRef(saveToken);
  React.useEffect(() => {
    if (saveToken === prevToken.current) return;
    prevToken.current = saveToken;
    toast.success(t("ed.savedToast"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToken]);

  return (
    <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        {actions && (
          <button
            type="button"
            onClick={actions.onBack}
            title={t("back")}
            aria-label={t("back")}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-sm font-medium">
            {actions?.saved ? t("ed.editInvoice") : t("ed.newInvoice")}
          </span>
          {invoice.number && (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {invoice.number}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="max-lg:hidden">
          <PaidControl />
        </div>
        {showExport && (
          <div className="flex items-center gap-1 max-lg:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  aria-disabled={exportBlocked}
                  className={cn(exportBlocked && "opacity-40")}
                  onClick={() => { if (!exportBlocked && !busy) exportPdf(); }}
                  disabled={busy}
                >
                  <FileText className="size-4" />
                  {t("fmtPdf")}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{exportBlocked ? t("exp.saveToExport") : t("exp.downloadPdf")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  aria-disabled={exportBlocked}
                  className={cn(exportBlocked && "opacity-40")}
                  onClick={() => { if (!exportBlocked && !busy) exportPng(); }}
                  disabled={busy}
                >
                  <ImageIcon className="size-4" />
                  {t("fmtPng")}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{exportBlocked ? t("exp.saveToExport") : t("exp.downloadPng")}</TooltipContent>
            </Tooltip>
          </div>
        )}
        {actions &&
          (saving ? (
            <Button size="sm" disabled className="disabled:opacity-100">
              <Loader2 className="size-4 animate-spin" />
              {t("ed.saving")}
            </Button>
          ) : actions.dirty ? (
            <span className="relative inline-flex rounded-md">
              <Button size="sm" onClick={handleSave}>
                {t("ed.save")}
              </Button>
              {saveBeacon && <Beacon />}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="text-muted-foreground duration-300 animate-in fade-in-0 zoom-in-95 disabled:opacity-100"
            >
              <Check className="size-4 text-emerald-700 duration-500 animate-in zoom-in-50" />
              {t("ed.saved")}
            </Button>
          ))}
      </div>
    </div>
  );
}
