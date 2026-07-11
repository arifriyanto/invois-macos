"use client";
import * as React from "react";
import { FileText, ImageIcon, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useInvoiceExport } from "@/lib/use-invoice-export";

// Delay before capturing an export while the dialog closes: covers the radix
// close animation (~200ms) plus a small settle margin.
const DIALOG_CLOSE_MS = 260;

/**
 * Celebratory confirmation shown once, right after an invoice's FIRST save.
 * Downloads run in place (the modal stays open); "Done" returns to the list and
 * "Create another" starts a fresh invoice.
 *
 * Always shown on first save — invoices-view.tsx renders this directly (there is
 * no toggle/toast fallback anymore).
 */
export function InvoiceSuccessModal({
  open,
  onClose,
  onCreateAnother,
}: {
  open: boolean;
  onClose: () => void;
  onCreateAnother: () => void;
}) {
  const { t } = useI18n();
  const { invoice } = useStore();
  const { busy, exportPdf, exportPng } = useInvoiceExport();
  // We fully CLOSE the dialog for the duration of an export, then reopen. The
  // export then sees the same clean DOM as one launched from the editor.
  //
  // The PDF path no longer strictly needs this (printToPDF only ever sees
  // #print-portal — the @media print rules hide the dialog anyway), but the PNG
  // path still does: html2canvas clones the live DOM, and radix's scroll-lock
  // shifts the layout under it. Keeping one code path for both is worth more
  // than shaving a few hundred ms off the PDF case.
  //
  // This component wraps <Dialog>, so the export hook above stays mounted even
  // while the dialog content is unmounted.
  const [exporting, setExporting] = React.useState(false);
  async function runExport(fn: () => void | Promise<void>) {
    setExporting(true);
    // wait for the dialog's close animation to finish + DOM to settle
    await new Promise((r) => setTimeout(r, DIALOG_CLOSE_MS));
    try {
      await fn();
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog
      open={open && !exporting}
      onOpenChange={(o) => { if (!o && !exporting) onClose(); }}
    >
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <Celebration />
          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-xl">{t("succ.title")}</DialogTitle>
            <DialogDescription className="text-balance">
              {t("succ.body").replace("{x}", invoice.number || "—")}
            </DialogDescription>
          </div>

          <div className="mt-1 flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => runExport(exportPdf)}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : <FileText />}
              {t("succ.dlPdf")}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => runExport(exportPng)}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ImageIcon />}
              {t("succ.dlPng")}
            </Button>
          </div>

          <div className="mt-1 flex w-full flex-col gap-2">
            <Button onClick={onCreateAnother}>
              <Plus />
              {t("succ.another")}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t("succ.done")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Festive check badge with an animated confetti burst. Colors are fixed (not
 *  palette-driven) so the celebration always feels bright. The animation plays
 *  once on mount — the modal remounts this on every open. */
function Celebration() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CELEBRATION_CSS }} />
      <svg
        width="112"
        height="112"
        viewBox="0 0 112 112"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* confetti — bursts outward from the badge centre as one group */}
        <g className="inv-confetti">
          <circle cx="18" cy="30" r="3.5" fill="#f59e0b" />
          <circle cx="96" cy="26" r="3" fill="#10b981" />
          <circle cx="90" cy="70" r="3.5" fill="#6366f1" />
          <circle cx="20" cy="74" r="3" fill="#ec4899" />
          <rect x="10" y="52" width="4" height="9" rx="2" transform="rotate(-25 12 56)" fill="#6366f1" />
          <rect x="100" y="46" width="4" height="9" rx="2" transform="rotate(30 102 50)" fill="#f59e0b" />
          <rect x="30" y="14" width="4" height="9" rx="2" transform="rotate(20 32 18)" fill="#10b981" />
          <rect x="76" y="12" width="4" height="9" rx="2" transform="rotate(-18 78 16)" fill="#ec4899" />
          <circle cx="44" cy="18" r="2.5" fill="#6366f1" />
          <circle cx="72" cy="92" r="2.5" fill="#10b981" />
        </g>
        {/* badge */}
        <g className="inv-badge">
          <circle cx="56" cy="56" r="26" fill="#10b981" />
        </g>
        <path
          className="inv-check"
          d="M45 56.5 l7.5 7.5 L69 48"
          stroke="#ffffff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}

const CELEBRATION_CSS = `
.inv-badge {
  transform-box: view-box;
  transform-origin: 56px 56px;
  animation: inv-pop 520ms cubic-bezier(.18,.89,.32,1.4) both;
}
.inv-check {
  stroke-dasharray: 42;
  stroke-dashoffset: 42;
  animation: inv-draw 340ms ease-out 360ms both;
}
.inv-confetti {
  transform-box: view-box;
  transform-origin: 56px 56px;
  animation: inv-burst 720ms cubic-bezier(.2,.8,.2,1) 120ms both;
}
@keyframes inv-pop {
  0% { transform: scale(0); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes inv-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes inv-burst {
  0%   { opacity: 0; transform: scale(.25) rotate(-14deg); }
  55%  { opacity: 1; transform: scale(1.08) rotate(5deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
@media (prefers-reduced-motion: reduce) {
  .inv-badge, .inv-check, .inv-confetti { animation: none; }
  .inv-check { stroke-dashoffset: 0; }
}
`;
