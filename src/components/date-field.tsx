"use client";
import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { id as idLocale, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";

function parseISO(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** true below the lg breakpoint (mobile/tablet). SSR-safe: false until mounted. */
function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export function DateField({
  value,
  onChange,
  min,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  invalid?: boolean;
}) {
  const { t, lang } = useI18n();
  const { settings } = useStore();
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : undefined;

  const trigger = (
    <Button
      variant="outline"
      aria-invalid={invalid}
      className={cn(
        "w-full justify-between border-input font-normal",
        !selected && "text-muted-foreground"
      )}
    >
      {selected ? formatDate(value, lang, settings.dateFormat) : t("date.pick")}
      <CalendarIcon className="size-4 opacity-60" />
    </Button>
  );

  const calendar = (
    <Calendar
      mode="single"
      selected={selected}
      defaultMonth={selected ?? minDate}
      captionLayout="dropdown"
      startMonth={new Date(2020, 0)}
      endMonth={new Date(2035, 11)}
      locale={lang === "id" ? idLocale : enUS}
      disabled={minDate ? { before: minDate } : undefined}
      onSelect={(d) => {
        if (d) {
          onChange(toISO(d));
          setOpen(false);
        }
      }}
    />
  );

  // Mobile: bottom-sheet dialog (consistent with the app's other mobile sheets).
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="gap-3 lg:max-w-fit">
          <DialogHeader>
            <DialogTitle className="text-sm">{t("date.pick")}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">{calendar}</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop: anchored popover.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {calendar}
      </PopoverContent>
    </Popover>
  );
}
