import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Standard form field: label + control + optional error, with consistent spacing. */
export function Field({
  label,
  error,
  className,
  labelClassName,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className={cn("block w-full text-xs font-normal text-muted-foreground", labelClassName)}>{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
