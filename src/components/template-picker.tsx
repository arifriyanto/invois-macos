"use client";
/**
 * TemplatePicker — compact template selector for the (editor) preview header.
 * A dropdown trigger showing the current template, opening a popover with the
 * shared live-thumbnail grid (see TemplateGrid).
 */
import * as React from "react";
import { ChevronDown, Crown, LayoutTemplate } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TEMPLATES, PREMIUM_TEMPLATES } from "@/lib/format";
import { TemplateGrid } from "@/components/template-grid";
import type { TemplateId } from "@/lib/types";

const ALL: { id: TemplateId; label: string; pro: boolean }[] = [
  ...TEMPLATES.map((t) => ({ ...t, pro: false })),
  ...PREMIUM_TEMPLATES.map((t) => ({ ...t, pro: true })),
];

export function TemplatePicker({ template }: { template: TemplateId }) {
  const [open, setOpen] = React.useState(false);
  const current = ALL.find((t) => t.id === template) ?? ALL[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-lg border bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <LayoutTemplate className="size-4 text-muted-foreground" />
          <span className="max-w-[9rem] truncate">{current.label}</span>
          {current.pro && <Crown className="size-3.5 text-amber-500" />}
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] bg-secondary p-4">
        <TemplateGrid onPicked={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
