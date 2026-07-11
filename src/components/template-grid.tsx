"use client";
import * as React from "react";
import { Check, Crown } from "lucide-react";
import { TEMPLATES, PREMIUM_TEMPLATES } from "@/lib/format";
import { InvoiceTemplate } from "@/components/templates/invoice-template";
import { trackEvent } from "@/lib/analytics";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { buildSampleView } from "@/lib/sample-preview";
import { cn } from "@/lib/utils";
import type { TemplateId } from "@/lib/types";

const PAGE_W = 794;
const GAP = 16; // matches gap-4 (and the container padding)

const ALL: { id: TemplateId; label: string; pro: boolean }[] = [
  ...TEMPLATES.map((t) => ({ ...t, pro: false })),
  ...PREMIUM_TEMPLATES.map((t) => ({ ...t, pro: true })),
];

// Live mini-renders of every template (a full sample document, so each design
// reads as complete). The active one gets a ring + check; premium templates get
// a Crown and gate to the upgrade popup for free users. Shared by the editor's
// TemplatePicker popover and the Settings template field (shown directly there).
export function TemplateGrid({
  cols = 3,
  onPicked,
}: {
  cols?: 2 | 3;
  onPicked?: () => void;
}) {
  const {
    settings, template, setTemplate, hydrated, isPro, setUpgradeOpen, setUpgradeContext,
  } = useStore();
  const { t: tr } = useI18n(); // aliased: the ALL.map below uses `t` for each template
  const sampleView = React.useMemo(() => buildSampleView(settings), [settings]);

  // Scale each mini-render to fill its column width (measured), so thumbnails are
  // full-width in whatever layout they're placed (3-col popover, 2-col Settings).
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [colW, setColW] = React.useState(104);
  React.useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setColW(Math.max(1, (el.clientWidth - GAP * (cols - 1)) / cols));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols]);
  const scale = colW / PAGE_W;

  const pick = (id: TemplateId, pro: boolean) => {
    if (id !== template) trackEvent("template_selected", { template: id, pro });
    if (pro && !isPro) {
      setUpgradeContext("template");
      setUpgradeOpen(true);
      onPicked?.();
      return;
    }
    setTemplate(id);
    onPicked?.();
  };

  return (
    <div>
    <div ref={gridRef} className={cn("grid gap-4", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {ALL.map((t) => {
        const active = t.id === template;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id, t.pro)}
            title={t.label}
            className="group block text-left"
          >
            <div
              className={cn(
                "relative aspect-[0.72] overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/5",
                active
                  ? "ring-2 ring-primary"
                  : "transition-shadow group-hover:shadow-md group-hover:ring-primary/40"
              )}
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{ width: PAGE_W, transform: `scale(${scale})` }}
                aria-hidden
              >
                {hydrated ? <InvoiceTemplate template={t.id} view={sampleView} /> : null}
              </div>
              {t.pro && (
                <span className="absolute right-1 top-1 flex size-[18px] items-center justify-center rounded bg-amber-100 text-amber-700">
                  <Crown className="size-3" />
                </span>
              )}
              {active && (
                <span className="absolute left-1 top-1 flex size-[18px] items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              )}
              {/* Name floats over the bottom of the thumbnail, full-width + centered. */}
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 truncate px-2 py-1 text-center text-[11px] backdrop-blur-sm",
                  active ? "bg-primary/90 font-medium text-primary-foreground" : "bg-[#182a4e]/90 text-white"
                )}
              >
                {t.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Crown className="size-3 text-amber-500" />
        {tr("tpl.moreSoon")}
      </p>
    </div>
  );
}
