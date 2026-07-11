"use client";
import * as React from "react";
import { Crown, ZoomIn, ZoomOut } from "lucide-react";
import { TemplatePicker } from "@/components/template-picker";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { TEMPLATES, PREMIUM_TEMPLATES, resolveTemplate } from "@/lib/format";
import { buildView } from "@/lib/view";
import { InvoiceTemplate } from "@/components/templates/invoice-template";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const PAGE_W = 794;
const PAGE_H = Math.round((PAGE_W * 297) / 210); // A4 ratio

export function Preview({
  mobileHidden = false,
  showZoom = false,
  compactTemplates = false,
  headerRight,
  statusStamp,
}: {
  mobileHidden?: boolean;
  /** Replace the template pill row with a compact dropdown + thumbnail popover. */
  compactTemplates?: boolean;
  /** Show zoom −/%/+ controls in the toolbar (editor preview). */
  showZoom?: boolean;
  /** Extra controls rendered on the right of the toolbar (export, fullscreen). */
  headerRight?: React.ReactNode;
  /** Floating status badge overlaid on the preview (top-right). */
  statusStamp?: React.ReactNode;
}) {
  const { settings, invoice, template, setTemplate, hydrated, isPro, setUpgradeOpen } = useStore();
  const { t, lang } = useI18n();
  const view = React.useMemo(
    () => buildView(settings, invoice, t, lang),
    [settings, invoice, t, lang]
  );
  // What actually renders/exports: free users fall back to Minimal even if a
  // premium template id is somehow set (e.g. edited vault JSON) — see format.ts.
  const shownTemplate = resolveTemplate(template, isPro);

  const pick = (id: typeof template, pro: boolean) => {
    if (id !== template) trackEvent("template_selected", { template: id, pro });
    if (pro && !isPro) {
      setUpgradeOpen(true);
      return;
    }
    setTemplate(id);
  };

  const measureRef = React.useRef<HTMLDivElement>(null);
  const [pages, setPages] = React.useState(1);

  React.useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => {
      const h = el.offsetHeight;
      setPages(Math.max(1, Math.ceil((h - 40) / PAGE_H)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scale the A4 sheets down whenever the pane is narrower than the sheet —
  // on mobile AND on any desktop width where the sidebar crowds the preview.
  // Never scales UP past 1. Export is unaffected (it renders the hidden
  // #invoice-paper at full 794px).
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1); // auto-fit baseline
  const [manualZoom, setManualZoom] = React.useState<number | null>(null);
  const scale = manualZoom ?? zoom; // manual override wins; "fit" resets to null
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const calc = () => {
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const avail = el.clientWidth - padX;
      setZoom(Math.min(1, Math.max(0.2, avail / PAGE_W)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    window.addEventListener("resize", calc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", calc);
    };
  }, []);

  // Drag-to-pan the canvas when zoomed past the viewport (mouse only; touch
  // keeps native scroll). Cursor shows grab/grabbing while pannable.
  const [grabbing, setGrabbing] = React.useState(false);
  const [pannable, setPannable] = React.useState(false);
  const pan = React.useRef<{ x: number; y: number; l: number; t: number } | null>(null);

  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const check = () =>
      setPannable(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale, pages]);

  function onPanDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = canvasRef.current;
    if (!el || (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)) return;
    e.preventDefault();
    pan.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    el.setPointerCapture(e.pointerId);
    setGrabbing(true);
  }
  function onPanMove(e: React.PointerEvent) {
    const el = canvasRef.current;
    if (!el || !pan.current) return;
    el.scrollLeft = pan.current.l - (e.clientX - pan.current.x);
    el.scrollTop = pan.current.t - (e.clientY - pan.current.y);
  }
  function onPanUp(e: React.PointerEvent) {
    const el = canvasRef.current;
    if (el && pan.current) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    pan.current = null;
    setGrabbing(false);
  }

  return (
    <main className="relative flex-1 h-full flex flex-col overflow-hidden max-lg:h-auto max-lg:overflow-visible">
      {/* Visible region: toolbar + canvas. Hidden on mobile when in Edit mode
          (the export paper below stays rendered so Export still works). */}
      <div className={cn("flex min-h-0 flex-1 flex-col", mobileHidden && "max-lg:hidden")}>
        {/* Toolbar */}
        <div className="shrink-0 border-b px-8 py-3 max-lg:px-3">
          <div className="w-full max-w-[794px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {compactTemplates ? (
                <TemplatePicker template={template} />
              ) : (
                <>
              <span className="text-xs font-semibold text-muted-foreground shrink-0 max-lg:hidden">
                {t("template")}
              </span>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => pick(tpl.id, false)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-colors cursor-pointer shrink-0",
                      template === tpl.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {tpl.label}
                  </button>
                ))}
                {PREMIUM_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => pick(tpl.id, true)}
                    title={t("pro.title")}
                    className={cn(
                      "pro-pill px-4 py-2 text-sm font-medium cursor-pointer shrink-0 inline-flex items-center gap-2",
                      template === tpl.id && "is-active"
                    )}
                  >
                    <Crown
                      className={cn(
                        "size-3.5",
                        template === tpl.id ? "text-white" : "text-amber-500"
                      )}
                    />
                    {tpl.label}
                  </button>
                ))}
              </div>
                </>
              )}
            </div>

            {(showZoom || headerRight) && (
              <div className="flex shrink-0 items-center gap-2">
                {showZoom && (
                  <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5 max-lg:hidden">
                    <button
                      type="button"
                      title="Perkecil"
                      onClick={() => setManualZoom(Math.max(0.25, +(scale - 0.1).toFixed(2)))}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
                    >
                      <ZoomOut className="size-4" />
                    </button>
                    <button
                      type="button"
                      title="Pas-kan lebar"
                      onClick={() => setManualZoom(null)}
                      className="min-w-[3.25ch] px-1 text-center text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {Math.round(scale * 100)}%
                    </button>
                    <button
                      type="button"
                      title="Perbesar"
                      onClick={() => setManualZoom(Math.min(2, +(scale + 0.1).toFixed(2)))}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
                    >
                      <ZoomIn className="size-4" />
                    </button>
                  </div>
                )}
                {headerRight}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable canvas with paginated A4 sheets */}
        <div
          ref={canvasRef}
          onPointerDown={onPanDown}
          onPointerMove={onPanMove}
          onPointerUp={onPanUp}
          onPointerCancel={onPanUp}
          className={cn(
            "flex-1 overflow-y-auto overflow-x-auto scrollbar-hide p-8 max-lg:overflow-visible max-lg:px-5 max-lg:py-6",
            pannable && (grabbing ? "cursor-grabbing select-none" : "cursor-grab")
          )}
          style={{ ["--inv-min-h" as string]: `${pages * PAGE_H}px` } as React.CSSProperties}
        >
          {/* Wrapper collapsed to the SCALED footprint so the scroll area is
              correct; the inner sheet stack is rendered at full 794px and shrunk
              with transform: scale — iOS Safari ignores CSS `zoom`, so we can't
              rely on it here. transform is honored everywhere. */}
          <div
            className="relative mx-auto"
            style={{
              width: PAGE_W * scale,
              height: (pages * PAGE_H + (pages - 1) * 24) * scale,
            }}
          >
          <div
            className="flex flex-col items-center gap-6"
            style={{
              width: PAGE_W,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {Array.from({ length: pages }).map((_, i) => (
              <div
                key={i}
                className="invoice-page"
                style={{ width: PAGE_W, height: PAGE_H }}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div style={{ position: "absolute", top: -(i * PAGE_H), left: 0, width: PAGE_W }}>
                    {hydrated ? (
                      <InvoiceTemplate template={shownTemplate} view={view} />
                    ) : (
                      <div className="inv-empty">
                        <div className="inv-empty-icon">📄</div>
                      </div>
                    )}
                  </div>
                </div>
                {pages > 1 && <div className="invoice-page-num">{i + 1} / {pages}</div>}
              </div>
            ))}
          </div>
          {statusStamp && (
            <div className="pointer-events-none absolute -right-4 -top-4 z-10">{statusStamp}</div>
          )}
          </div>
        </div>
      </div>

      {/* Hidden full-height render — measured & used by PDF/PNG export.
          Kept OUTSIDE the toggled region so Export works from the Edit tab too. */}
      <div
        id="invoice-paper"
        ref={measureRef}
        style={{ position: "absolute", left: -99999, top: 0, width: PAGE_W, background: "#fff" }}
        aria-hidden
      >
        {hydrated ? <InvoiceTemplate template={shownTemplate} view={view} /> : null}
      </div>
    </main>
  );
}
