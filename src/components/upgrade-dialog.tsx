"use client";
// `InfinityIcon` is lucide's own alias — preferred over `Infinity as InfinityIcon`,
// which would shadow the JS global of the same name.
import {
  Briefcase, Check, Crown, Gift, InfinityIcon, LayoutTemplate, Lock,
  RefreshCw, ShieldCheck, X,
} from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { FREE_INVOICE_LIMIT } from "@/lib/limits";

// Chosen one-time price (Jul 10 2026). Confirm the exact figure against the Mac
// App Store tier at submit time — Apple sets local IDR pricing per USD tier
// (Rp 249.000 ≈ the ~$14.99 tier).
const PRICE = "Rp 249.000";

const FEATURES = [
  { icon: InfinityIcon, key: "pro.f.unlimited" },
  { icon: LayoutTemplate, key: "pro.f.templates" },
  { icon: Gift, key: "pro.f.newTemplates" },
  { icon: Briefcase, key: "pro.f.business" },
  { icon: RefreshCw, key: "pro.f.updates" },
  { icon: ShieldCheck, key: "pro.f.private" },
] as const;

// A small fan of template cards under a lock, floating on the gold banner —
// shown when the modal was triggered by picking a Pro template. Conveys "unlock
// ALL templates", not just the one clicked.
function TemplateFan() {
  const card =
    "absolute bottom-1.5 left-1/2 -ml-[52px] h-[80px] w-[104px] origin-bottom rounded-lg bg-white p-2.5 shadow-[0_8px_20px_rgba(120,60,0,0.22)]";
  const line = "mb-1.5 h-1.5 rounded bg-[#e3e9f2]";
  return (
    <div className="relative h-[104px]">
      <div className={cn(card, "-rotate-12")}>
        <div className={cn(line, "w-3/5")} />
        <div className={cn(line, "w-full")} />
        <div className={cn(line, "w-4/5")} />
      </div>
      <div className={cn(card, "rotate-12")}>
        <div className={cn(line, "w-3/5")} />
        <div className={cn(line, "w-full")} />
        <div className={cn(line, "w-4/5")} />
      </div>
      <div className={cn(card, "z-[5]")}>
        <div className={cn(line, "w-3/5")} />
        <div className={cn(line, "w-full")} />
        <div className={cn(line, "w-4/5")} />
      </div>
      <div className="absolute bottom-[30px] left-1/2 z-10 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-[#b45f12] shadow-[0_6px_18px_rgba(120,60,0,0.3)]">
        <Lock className="size-[19px]" />
      </div>
    </div>
  );
}

// Non-template header — a festive full-bleed gold banner with an arced (dome)
// bottom, a gold "badge" with a crown, and a context-aware headline (generic,
// or tailored when a specific free limit was hit). The gradient bleeds to edges.
function ProBanner({ title, desc }: { title: string; desc: string }) {
  const { t } = useI18n();
  return (
    <div className="-mx-6 -mt-6 bg-gradient-to-br from-[#fbdd6b] via-[#f2b23c] to-[#e07a1f] px-6 pb-11 pt-8 text-center text-white [clip-path:ellipse(150%_100%_at_50%_0)]">
      <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#d9852a] to-[#b45f12] px-4 py-1.5 text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(120,60,0,0.4),inset_0_1px_0_rgba(255,255,255,0.35)]">
        <Crown className="size-[15px]" /> {t("pro.title")}
      </span>
      <DialogTitle className="mx-auto max-w-[270px] text-[17px] font-medium leading-snug text-white">
        {title}
      </DialogTitle>
      <DialogDescription className="sr-only">{desc}</DialogDescription>
    </div>
  );
}

export function UpgradeDialog() {
  const { t } = useI18n();
  const { upgradeOpen, setUpgradeOpen, upgradeContext } = useStore();
  const isTemplate = upgradeContext === "template";
  // Non-template headline: tailored when a specific free limit was hit, else generic.
  const bannerTitle =
    upgradeContext === "invoiceLimit"
      ? t("pro.headlineInvoice").replace("{n}", String(FREE_INVOICE_LIMIT))
      : upgradeContext === "vaultLimit"
        ? t("pro.headlineVault")
        : t("pro.headlineGeneral");
  const bannerDesc =
    upgradeContext === "invoiceLimit"
      ? t("pro.ctxInvoice")
      : upgradeContext === "vaultLimit"
        ? t("pro.ctxVault")
        : t("pro.ctxGeneral");

  return (
    <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden border-0 p-6 lg:max-w-[400px]">
        {/* Custom close — both headers are now gold banners, so it stays white. */}
        <DialogClose className="absolute right-3.5 top-3.5 z-10 rounded-md p-1 text-white opacity-80 transition hover:bg-white/25 hover:opacity-100 focus:outline-none">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        {isTemplate ? (
          <div className="-mx-6 -mt-6 bg-gradient-to-br from-[#fbdd6b] via-[#f2b23c] to-[#e07a1f] px-6 pb-7 pt-6 [clip-path:ellipse(150%_100%_at_50%_0)]">
            <TemplateFan />
            <DialogTitle className="mt-4 whitespace-nowrap text-center text-[15px] font-medium leading-snug text-white">
              {t("pro.headlineTemplate")}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("pro.ctxTemplate")}</DialogDescription>
          </div>
        ) : (
          <ProBanner title={bannerTitle} desc={bannerDesc} />
        )}

        <ul className="mt-5 flex flex-col gap-3">
          {FEATURES.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center gap-3 text-sm text-foreground">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-[17px]" />
              </span>
              {t(key)}
            </li>
          ))}
        </ul>

        <div className="relative mt-5 overflow-hidden rounded-xl border-[1.5px] border-[#f2c04e] bg-background px-4 py-3">
          {/* Corner ribbon: flush to the top-right, only its bottom-left rounded. */}
          <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-lg bg-[#182a4e] px-2.5 py-1 text-[11px] font-medium text-white">
            <Check className="size-3" /> {t("pro.payOnce")}
          </span>
          <span className="block text-lg font-semibold text-foreground">{PRICE}</span>
          <span className="block text-[12px] text-muted-foreground">{t("pro.noSub")}</span>
        </div>

        {/* Gold CTA — the single focal point. Closes for now (no billing yet). */}
        <button
          onClick={() => setUpgradeOpen(false)}
          className="mt-5 w-full rounded-lg bg-[#f2c04e] py-3 text-[15px] font-semibold text-[#4a3500] transition-colors hover:bg-[#eab63a]"
        >
          {t("pro.cta")}
        </button>
        {/* Restore purchase — required for the Mac App Store; wire to billing later. */}
        <button
          onClick={() => setUpgradeOpen(false)}
          className="mt-1 w-full py-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("pro.restore")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
