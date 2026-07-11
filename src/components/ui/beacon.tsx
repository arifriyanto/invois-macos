import * as React from "react";
import { cn } from "@/lib/utils";

// A pulsing "notification" dot with an expanding ripple, used during the
// first-invoice walkthrough to point attention at the next empty field. Purely
// decorative + non-interactive; position it by passing placement utilities in
// `className` (default sits at the top-right corner of the relative parent).
export function Beacon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute -right-1.5 -top-1.5 z-20 size-3.5", className)}
    >
      <span className="beacon-ring absolute inset-0 rounded-full bg-amber-500" />
      {/* White halo so the amber dot separates cleanly from ANY background —
          the light form fields AND the blue primary Save button. */}
      <span className="beacon-dot absolute inset-0 rounded-full bg-amber-500 ring-2 ring-white" />
    </span>
  );
}
