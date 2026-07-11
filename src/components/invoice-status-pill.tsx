"use client";
import { CircleCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Shared paid-status control for the invoice list and the editor toolbar, so both
// look and behave the same. Unpaid shows a "Mark as paid" action; paid a green
// chip; overdue a red chip. Clicking toggles paid (a boolean for now — a paid-date
// picker is planned for a later version; the record stores paidAt=today).
//
// `size`: "chip" for the compact list cell, "toolbar" to match the h-8 sm buttons
// sitting next to it in the editor toolbar.
export function InvoiceStatusPill({
  paid,
  due,
  onToggle,
  size = "chip",
}: {
  paid: boolean;
  due?: string;
  onToggle: () => void;
  size?: "chip" | "toolbar";
}) {
  const { t } = useI18n();
  const overdue = !paid && !!due && due < todayISO();

  const base = cn(
    "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
    size === "toolbar" ? "h-8 px-3 text-sm" : "px-2.5 py-1 text-xs"
  );
  const iconSize = size === "toolbar" ? "size-4" : "size-3.5";

  if (paid) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={t("list.changeStatus")}
        className={cn(base, "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400")}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {t("st.paid")}
      </button>
    );
  }

  if (overdue) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={t("list.changeStatus")}
        className={cn(base, "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-400")}
      >
        <span className="size-1.5 rounded-full bg-red-500" />
        {t("st.overdue")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      title={t("list.changeStatus")}
      className={cn(base, "border bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}
    >
      <CircleCheck className={iconSize} />
      {t("pd.markPaid")}
    </button>
  );
}
