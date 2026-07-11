"use client";
/**
 * Editor — the form-first editor body: form (left, primary, fixed-ratio width) +
 * preview (right, secondary, flex). The draggable divider was removed in favour
 * of a fixed split; fullscreen covers "show the invoice bigger". The sole invoice
 * editor, rendered by invoices-view.
 *
 * Preview header extras (passed into <Preview/>): zoom controls, PDF/PNG export
 * (gated by canExport), fullscreen toggle, and a floating status stamp.
 */
import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Preview } from "@/components/preview";
import { InvoiceForm } from "@/components/editor/invoice-form";
import { EditorToolbar } from "@/components/editor-toolbar";
import { useEditorActions } from "@/lib/editor-actions";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Fixed split: the form pane is a fixed width; the preview (flex) absorbs the
// rest. Tune this to make the form narrower/wider.
const FORM_WIDTH = 400;

export function Editor() {
  const [fullscreen, setFullscreen] = React.useState(false);
  const actions = useEditorActions();
  const { invoice } = useStore();
  const { t } = useI18n();
  const paid = actions?.paid ?? false;

  // Status stamp: Lunas (paid) · Jatuh tempo (unpaid + past due) · Belum lunas.
  const todayISO = new Date().toISOString().slice(0, 10);
  const overdue = !paid && !!invoice.due && invoice.due < todayISO;
  const statusKind: "paid" | "overdue" | "unpaid" = paid ? "paid" : overdue ? "overdue" : "unpaid";
  const stamp = (
    <div
      className={cn(
        "rotate-6 select-none rounded-md border-2 bg-card/75 px-3 py-1 text-[13px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-sm",
        statusKind === "paid" && "border-emerald-500/70 text-emerald-700",
        statusKind === "overdue" && "border-red-500/70 text-red-600",
        statusKind === "unpaid" && "border-amber-500/70 text-amber-700"
      )}
    >
      {statusKind === "paid" ? t("st.paid") : statusKind === "overdue" ? t("st.overdue") : t("st.unpaid")}
    </div>
  );

  // Esc exits fullscreen.
  React.useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);


  const iconBtn =
    "inline-flex size-8 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  const headerRight = (
    <button
      type="button"
      onClick={() => setFullscreen((f) => !f)}
      title={fullscreen ? t("exp.exitFullscreen") : t("exp.fullscreen")}
      className={cn(iconBtn, "max-lg:hidden")}
    >
      {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </button>
  );

  const preview = (
    <Preview showZoom compactTemplates headerRight={headerRight} statusStamp={stamp} />
  );

  return (
    <div className="flex flex-col lg:h-[calc(100vh-2.5rem)]">
      <EditorToolbar />
      <div className="flex min-h-0 flex-1">
        {!fullscreen && (
          <div className="shrink-0 border-r max-lg:border-r-0" style={{ width: FORM_WIDTH }}>
            <InvoiceForm />
          </div>
        )}
        <div
          className={
            fullscreen
              ? "fixed inset-x-0 bottom-0 top-10 z-50 flex flex-col bg-[var(--app-bg)] max-lg:top-0"
              : "flex min-w-0 flex-1 flex-col bg-[var(--app-bg)]"
          }
        >
          {preview}
        </div>
      </div>
    </div>
  );
}
