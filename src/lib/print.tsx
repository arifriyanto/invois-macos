"use client";
// Vector-PDF export.
//
// Electron does the heavy lifting: `webContents.printToPDF()` re-lays out the
// page under `@media print` and hands us a real, A4-paginated, text-selectable
// PDF. Our job in the renderer is only to make sure that when the print pass
// runs, the page contains the invoice and nothing else.
//
// So we mount a print sheet (`#print-portal`, a direct child of <body> via a
// portal) far below the viewport — invisible on screen, but present in the DOM.
// The `@media print` block in globals.css then hides every other body child and
// snaps the sheet back to the origin. The app stays mounted the whole time, so
// no editor state is lost.
//
// This replaces the Tauri path entirely: the Rust `render_pdf_slice` command,
// the manual A4 slicing, and the pdf-lib page stitching are all gone.
import * as React from "react";
import { createPortal } from "react-dom";
import * as native from "@/lib/native";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { buildView } from "@/lib/view";
import { resolveTemplate } from "@/lib/format";
import { InvoiceTemplate } from "@/components/templates/invoice-template";

export type PrintResult = { ok: boolean; path?: string; error?: string };
type RenderFn = (req: {
  path: string;
  draft: boolean;
  title?: string;
}) => Promise<PrintResult>;

const Ctx = React.createContext<RenderFn | null>(null);
export const usePrintToPdf = (): RenderFn | null => React.useContext(Ctx);

/** A4 width @96dpi. The templates are designed against this. */
const PAGE_W = 794;
/** Park the sheet below the viewport so it never flashes in the app window. */
const OFFSCREEN_Y = 100000;

export function PrintProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = React.useState<boolean | null>(null); // null = idle

  const renderToPdf = React.useCallback<RenderFn>(async ({ path, draft, title }) => {
    setDraft(draft);
    // Let the print sheet paint and the fonts settle before we print.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    try {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      /* ignore */
    }

    // Chromium stamps the document title into the PDF metadata, so borrow it
    // for the duration of the print and put it back after.
    const prevTitle = document.title;
    if (title) document.title = title;

    let result: PrintResult;
    try {
      await native.pdf.toFile(path);
      result = { ok: true, path };
    } catch (e) {
      result = { ok: false, error: String(e) };
    } finally {
      document.title = prevTitle;
      setDraft(null);
    }
    return result;
  }, []);

  return (
    <Ctx.Provider value={renderToPdf}>
      {children}
      {draft !== null && <PrintPortal draft={draft} />}
    </Ctx.Provider>
  );
}

/** Mounts the print sheet as a direct child of <body> — the `@media print`
 *  rules key off that ("hide every body child except this one"). */
function PrintPortal({ draft }: { draft: boolean }) {
  const [host] = React.useState(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.id = "print-portal"; // the @media print rules key off this id
    return el;
  });
  React.useEffect(() => {
    if (!host) return;
    document.body.appendChild(host);
    return () => {
      host.remove();
    };
  }, [host]);
  if (!host) return null;
  return createPortal(<PrintSheet draft={draft} />, host);
}

function PrintSheet({ draft }: { draft: boolean }) {
  const { settings, invoice, template, isPro } = useStore();
  const { t, lang } = useI18n();
  const view = React.useMemo(() => buildView(settings, invoice, t, lang), [settings, invoice, t, lang]);
  // Free users export in Minimal even if a premium template id is set — see format.ts.
  const shownTemplate = resolveTemplate(template, isPro);
  return (
    <>
      {/* Toast/popover portals are body children too, so the print rules would
          already hide them — but killing them outright also keeps them out of
          the way if one is mid-animation. */}
      <style>{`[data-sonner-toaster],[data-radix-popper-content-wrapper]{display:none !important;}`}</style>
      <div
        id="print-root"
        style={{ position: "absolute", top: OFFSCREEN_Y, left: 0, width: PAGE_W, background: "#fff" }}
      >
        <InvoiceTemplate template={shownTemplate} view={view} />
        {draft && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%) rotate(-28deg)",
              fontFamily: "'Sora',system-ui,sans-serif",
              fontSize: 170,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(239,68,68,0.12)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 2147483647,
            }}
          >
            DRAFT
          </div>
        )}
      </div>
    </>
  );
}
