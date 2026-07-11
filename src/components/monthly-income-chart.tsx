"use client";
// Hand-rolled monthly-income bar chart — a lightweight replacement for the
// Recharts version (removes recharts + d3 from the bundle). Mirrors the look:
// rounded-top bars in the accent color, dashed horizontal grid, month labels,
// and a hover tooltip. Bars morph on data change (CSS height transition) and
// grow in on mount, like Recharts' animation.
import * as React from "react";

const GRID = [0, 0.25, 0.5, 0.75, 1];

export function MonthlyIncomeChart({
  data,
  formatValue,
}: {
  data: { label: string; title: string; value: number }[];
  formatValue: (value: number) => string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  // Cursor position (px, relative to the plot area) so the tooltip follows the
  // pointer like Recharts' default tooltip.
  const plotRef = React.useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = React.useState({ x: 0, y: 0 });
  const onMove = (e: React.MouseEvent) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  // Start collapsed, then grow to full height on the next frame (mount animation).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Measure width so we can thin the month labels the way Recharts does:
  // show full month names and drop the ones that would overlap (rather than
  // cramming one per bar and truncating them to a single letter).
  const rootRef = React.useRef<HTMLDivElement>(null);
  // Default to a wide value so before the first measurement we show ALL labels
  // (step 1) rather than collapsing to just the last month.
  const [width, setWidth] = React.useState(1200);
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(1, ...data.map((d) => d.value));

  // Each label needs ~34px to render "Sep" without touching its neighbour.
  const maxLabels = Math.max(1, Math.floor(width / 34));
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));
  const lastIndex = data.length - 1;
  // Anchor to the END (preserveEnd) so the latest month is always labelled,
  // matching Recharts' default XAxis behaviour.
  const showLabel = (i: number) => (lastIndex - i) % labelStep === 0;

  return (
    <div ref={rootRef} className="relative h-[280px] w-full select-none pt-1.5">
      {/* Plot area (leaves ~1.25rem below for the month labels). */}
      <div
        ref={plotRef}
        onMouseMove={onMove}
        className="relative flex h-[calc(100%-1.25rem)] items-end gap-0 px-1.5"
      >
        {/* Dashed horizontal grid — matches Recharts' strokeDasharray="3 3"
            (3px dash, 3px gap) via a repeating gradient rather than CSS
            border-dashed, whose dash pattern is longer and browser-dependent. */}
        <div className="pointer-events-none absolute inset-0">
          {GRID.map((g) => (
            <div
              key={g}
              className="absolute inset-x-0 h-px"
              style={{
                bottom: `${g * 100}%`,
                // #ccc = Recharts' default CartesianGrid stroke (the shadcn
                // recolor overrides were removed, so the existing chart uses it).
                background:
                  "repeating-linear-gradient(to right, #ccc 0 3px, transparent 3px 6px)",
              }}
            />
          ))}
        </div>

        {/* Bars. Keyed by INDEX (not label) so the same DOM node persists across
            data changes → the height transition animates (morph), matching
            Recharts. min-w-0 lets columns shrink so many bars never overflow. */}
        {data.map((d, i) => (
          <div
            key={i}
            className="relative flex h-full min-w-0 flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          >
            <div
              className="mx-auto w-[90%] rounded-t-[6px] bg-primary"
              style={{
                height: `${mounted ? (d.value / max) * 100 : 0}%`,
                // Height morphs slowly (like Recharts). No hover dimming —
                // bars keep full opacity; the tooltip alone marks the hovered one.
                transition: "height 400ms ease-out",
              }}
            />
          </div>
        ))}

        {/* Hover tooltip — follows the cursor (like Recharts), flipping to the
            left of the pointer once past the halfway point so it never clips. */}
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: `translate(${cursor.x > width / 2 ? "calc(-100% - 12px)" : "12px"}, -50%)`,
            }}
          >
            <div className="mb-0.5 text-muted-foreground">{data[hover].title}</div>
            <div className="font-mono font-medium tabular-nums text-foreground">
              {formatValue(data[hover].value)}
            </div>
          </div>
        )}
      </div>

      {/* Month labels — thinned like Recharts (full names, overlapping ones
          dropped). Cells stay flex-1/min-w-0 so the row can't overflow; the
          shown label uses whitespace-nowrap + overflow-visible so its full text
          spills into the blank neighbour cells instead of being truncated. */}
      <div className="flex gap-0 px-1.5 pt-1.5">
        {data.map((d, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10px] capitalize text-muted-foreground"
          >
            {showLabel(i) ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
