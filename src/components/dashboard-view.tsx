"use client";
/**
 * DashboardView — the home page. A summary of the freelancer's invoicing,
 * derived entirely from saved invoices. A time-range control rescopes
 * everything. Minimal set (Jul 2026): four stat cards (income, outstanding,
 * overdue, invoice count) + a full-width monthly-income bar chart (metric-
 * switchable). Read-only. (Removed: receivables donut, aging, top-clients chart.
 * The clickable "to collect" list is parked as an idea.)
 */
import * as React from "react";
import { AlertTriangle, Clock, FileText, Wallet } from "lucide-react";
import { useInvoices } from "@/lib/invoices-store";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { calcTotals, formatCurrency } from "@/lib/format";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthlyIncomeChart } from "@/components/monthly-income-chart";
import { cn } from "@/lib/utils";

type Range = "3m" | "6m" | "12m" | "ytd" | "all";
type Metric = "paid" | "billed" | "count";

export function DashboardView() {
  const { invoices } = useInvoices();
  const { settings } = useStore();
  const { t, lang } = useI18n();
  const loc = lang === "id" ? "id-ID" : "en-US";

  const [range, setRange] = React.useState<Range>("6m");
  const [metric, setMetric] = React.useState<Metric>("paid");

  const compact = React.useCallback(
    (v: number) =>
      new Intl.NumberFormat(loc, {
        style: "currency",
        currency: settings.currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v),
    [loc, settings.currency]
  );
  const full = React.useCallback((v: number) => formatCurrency(v, settings.currency), [settings.currency]);

  const RANGES: { id: Range; label: string }[] = [
    { id: "3m", label: t("db.range3") },
    { id: "6m", label: t("db.range6") },
    { id: "12m", label: t("db.range12") },
    { id: "ytd", label: t("db.rangeYtd") },
    { id: "all", label: t("db.rangeAll") },
  ];
  const METRICS: { id: Metric; label: string }[] = [
    { id: "paid", label: t("db.mPaid") },
    { id: "billed", label: t("db.mBilled") },
    { id: "count", label: t("db.mCount") },
  ];

  const d = React.useMemo(() => {
    const now = new Date();
    const todayISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const mk = (iso: string) => (iso || "").slice(0, 7);
    const keyOf = (off: number) => {
      const dt = new Date(now.getFullYear(), now.getMonth() - off, 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    };
    const labelOf = (off: number) =>
      new Date(now.getFullYear(), now.getMonth() - off, 1).toLocaleString(loc, { month: "short" });
    const monthTitle = (key: string) => {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleString(loc, { month: "short", year: "numeric" });
    };

    // "All" → every month from the earliest invoice to the current month.
    const monthsSinceFirst = () => {
      let minKey = "";
      for (const inv of invoices) {
        const k = mk(inv.data.date);
        if (k && (minKey === "" || k < minKey)) minKey = k;
      }
      if (!minKey) return 12;
      const [my, mm] = minKey.split("-").map(Number);
      return Math.max(1, now.getFullYear() * 12 + now.getMonth() + 1 - (my * 12 + mm) + 1);
    };
    const chartCount =
      range === "3m" ? 3 : range === "6m" ? 6 : range === "12m" ? 12 : range === "ytd" ? now.getMonth() + 1 : monthsSinceFirst();
    const scopeStart = range === "ytd" ? `${now.getFullYear()}-01` : range === "all" ? null : keyOf(chartCount - 1);

    const allRows = invoices.map((inv) => ({
      total: calcTotals(inv.data).total,
      mkey: mk(inv.data.date),
      due: inv.data.due,
      paid: inv.paid,
    }));
    const inScope = (k: string) => scopeStart === null || k >= scopeStart;
    const rows = allRows.filter((r) => inScope(r.mkey));

    const sum = (rs: typeof rows) => rs.reduce((s, r) => s + r.total, 0);
    const unpaid = rows.filter((r) => !r.paid);
    const overdueRows = unpaid.filter((r) => r.due && r.due < todayISO);

    const outstanding = sum(unpaid);
    const overdueAmt = sum(overdueRows);
    const paidAmt = sum(rows.filter((r) => r.paid));

    const months: { key: string; label: string; title: string; paid: number; billed: number; count: number }[] = [];
    for (let off = chartCount - 1; off >= 0; off--) {
      const key = keyOf(off);
      const rs = allRows.filter((r) => r.mkey === key);
      months.push({
        key,
        label: labelOf(off),
        title: monthTitle(key),
        paid: sum(rs.filter((r) => r.paid)),
        billed: sum(rs),
        count: rs.length,
      });
    }

    let delta: number | null = null;
    if (range === "3m" || range === "6m" || range === "12m") {
      const prevStart = keyOf(2 * chartCount - 1);
      const prevEnd = keyOf(chartCount);
      const prevPaid = sum(allRows.filter((r) => r.mkey >= prevStart && r.mkey <= prevEnd && r.paid));
      delta = prevPaid > 0 ? Math.round(((paidAmt - prevPaid) / prevPaid) * 100) : null;
    } else if (range === "ytd") {
      // This year to date vs the same span last year.
      const py = now.getFullYear() - 1;
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const prevPaid = sum(allRows.filter((r) => r.paid && r.mkey >= `${py}-01` && r.mkey <= `${py}-${mm}`));
      delta = prevPaid > 0 ? Math.round(((paidAmt - prevPaid) / prevPaid) * 100) : null;
    }

    return {
      paidAmt, outstanding, overdueAmt,
      overdueCount: overdueRows.length, unpaidCount: unpaid.length, invoiceCount: rows.length,
      months, delta,
    };
  }, [invoices, loc, range]);

  // Derived per-metric series with a stable `value` key. A new reference each
  // time the metric (or range) changes, so the chart morphs each bar from its
  // previous height to the new one (see MonthlyIncomeChart's index-keyed bars).
  const chartData = d.months.map((m) => ({ label: m.label, title: m.title, value: m[metric] }));

  return (
    <div className="lg:h-[calc(100vh-2.5rem)] lg:overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium">{t("nav.home")}</h1>
            <p className="text-xs text-muted-foreground">{t("db.subtitle")}</p>
          </div>
          <ToggleGroup
            type="single"
            variant="track"
            size="lg"
            value={range}
            onValueChange={(v) => v && setRange(v as Range)}
          >
            {RANGES.map((o) => (
              <ToggleGroupItem key={o.id} value={o.id} className="flex-none">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Stat cards (read-only) */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<Wallet className="size-4" />} label={t("db.income")} value={compact(d.paidAmt)}>
            {d.delta === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className={d.delta >= 0 ? "text-emerald-700" : "text-red-600"}>
                {d.delta >= 0 ? "▲" : "▼"} {Math.abs(d.delta)}% {range === "ytd" ? t("db.vsLastYear") : t("db.vsPrev")}
              </span>
            )}
          </Stat>
          <Stat icon={<Clock className="size-4" />} label={t("db.outstanding")} value={compact(d.outstanding)}>
            <span className="text-muted-foreground">{t("db.subUnpaid").replace("{n}", String(d.unpaidCount))}</span>
          </Stat>
          <Stat icon={<AlertTriangle className="size-4" />} label={t("st.overdue")} value={compact(d.overdueAmt)} tone="warn">
            <span className="text-orange-700">{t("db.subOverdue").replace("{n}", String(d.overdueCount))}</span>
          </Stat>
          <Stat icon={<FileText className="size-4" />} label={t("db.invoices")} value={String(d.invoiceCount)} />
        </div>

        {/* Monthly income — rounded bar chart */}
        <Card
            title={t("db.monthlyIncome")}
            action={
              <ToggleGroup
                type="single"
                variant="track"
                size="sm"
                value={metric}
                onValueChange={(v) => v && setMetric(v as Metric)}
              >
                {METRICS.map((o) => (
                  <ToggleGroupItem key={o.id} value={o.id} className="flex-none">
                    {o.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            }
          >
            <MonthlyIncomeChart
              data={chartData}
              formatValue={(v) =>
                metric === "count" ? t("db.nInvoices").replace("{n}", String(v)) : full(v)
              }
            />
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon, label, value, tone, children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "warn";
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1.5 text-lg font-semibold tabular-nums", tone === "warn" && "text-orange-700")}>{value}</div>
      {children && <div className="mt-0.5 text-[11px]">{children}</div>}
    </div>
  );
}

function Card({
  title, note, action, children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="text-[13px] font-medium">
          {title}
          {note && <span className="ml-1.5 font-normal text-muted-foreground">· {note}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
