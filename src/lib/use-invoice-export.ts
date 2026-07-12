"use client";
import * as native from "@/lib/native";
import * as React from "react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { usePrintToPdf } from "@/lib/print";
import { exportInvoicePNG, uniqueFilePath, ensureExportDir } from "@/lib/export";

/**
 * Shared invoice export logic (PDF / PNG) reading the hidden #invoice-paper.
 * The Pro upsell happens at template-selection time (see TemplatePicker); the
 * render/export paths additionally fall a free user back to Minimal via
 * resolveTemplate (in preview.tsx / print.tsx), so this export code needs no
 * template check — whatever is on #invoice-paper is already the allowed design.
 */
export function useInvoiceExport() {
  const { invoice, template, settings } = useStore();
  const { t, lang } = useI18n();
  // NOTE: there is no "draft export". The toolbar blocks Export while the invoice
  // is dirty, and an unsaved invoice is ALWAYS dirty (invoices-view.tsx: `dirty =
  // !savedRec || …`) — so by the time an export runs, the invoice is saved and
  // clean by construction. The old DRAFT watermark was therefore unreachable and
  // was removed (11 Jul 2026). If you ever relax the save gate, bring it back.
  const renderToPdf = usePrintToPdf();
  const [busy, setBusy] = React.useState(false);

  const paper = () => document.getElementById("invoice-paper");
  const base = () => invoice.number || "invoice";

  const run = React.useCallback(
    async (kind: "pdf" | "png", savedFirst?: boolean) => {
      const p = paper();
      if (!p) return;

      // PDF is always VECTOR now: Electron's printToPDF prints the page under
      // our @media print rules (crisp/selectable text, real A4 page breaks,
      // small files) → writes to the export folder, then auto-opens. There is no
      // raster PDF fallback any more, so `settings.pdfEngine` is a vestigial
      // data-model field and is intentionally ignored.
      if (kind === "pdf") {
        if (!renderToPdf || !native.isDesktop()) {
          // Plain browser (next dev without Electron) — no print bridge.
          toast.error(t("toast.pdfFail"));
          return;
        }
        setBusy(true);
        try {
          const dir = (settings.exportDir?.trim() || (await native.path.downloadDir())).replace(/\/+$/, "");
          await ensureExportDir(dir); // recreate it if the user deleted/renamed it
          // Never overwrite a same-number export → " (n)" suffix.
          const path = await uniqueFilePath(dir, `${base()}.pdf`);
          const res = await renderToPdf({
            path,
            title: invoice.number ? `Invoice ${invoice.number}` : "Invoice",
          });
          if (res.ok) {
            try {
              const { openPath } = native.opener;
              await openPath(path);
            } catch {
              /* open is best-effort */
            }
            const savedName = path.split("/").pop() ?? `${base()}.pdf`;
            toast.success(t("toast.pdfOk"), { description: savedName });
            trackEvent("invoice_exported", { format: "pdf", template, engine: "vector" });
          } else {
            toast.error(res.error || t("toast.pdfFail"));
            trackEvent("export_failed", { format: "pdf", template, engine: "vector" });
          }
        } finally {
          setBusy(false);
        }
        return;
      }

      // PNG: still a raster of the on-screen paper (html2canvas).
      setBusy(true);
      try {
        const savedName = await exportInvoicePNG(p, `${base()}.png`, settings.exportDir, true);
        const okMsg = t("toast.pngOk");
        toast.success(savedFirst ? `${t("ed.saved")} · ${okMsg}` : okMsg, { description: savedName });
        trackEvent("invoice_exported", { format: kind, template, currency: settings.currency, lang });
      } catch (e) {
        console.error(e);
        toast.error(t("toast.pdfFail"));
        trackEvent("export_failed", { format: kind, template });
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoice.number, template, settings.currency, settings.exportDir, settings.bizName, lang, renderToPdf]
  );

  return {
    busy,
    exportPdf: (savedFirst?: boolean) => run("pdf", savedFirst),
    exportPng: (savedFirst?: boolean) => run("png", savedFirst),
  };
}
