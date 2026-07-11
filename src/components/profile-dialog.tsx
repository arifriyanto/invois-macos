"use client";
import * as React from "react";
import { ChevronRight, CircleCheck, Pencil, Store } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

export function ProfileDialog() {
  const { settings, setSettings } = useStore();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  // First-run nudge: until the business name is filled, the trigger becomes a
  // prominent CTA so new users know to set up their business. It relaxes to a
  // quiet ghost button once filled.
  const needsSetup = !settings.bizName.trim();
  // First-run CTA style: "info" (palette-aware, current) or "violet" (the old
  // purple banner). Switch to "violet" to restore the previous look.
  const ctaStyle: string = "info";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {needsSetup ? (
          ctaStyle === "violet" ? (
            <button
              type="button"
              className="bp-glow flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3.5 text-left transition-colors hover:bg-violet-100/70 cursor-pointer"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                <Store className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-violet-900">
                  {t("profile.cta")}
                  <span className="size-1.5 rounded-full bg-violet-500" />
                </span>
                <span className="mt-0.5 block text-[11px] text-violet-700/70">
                  {t("profile.ctaHint")}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-violet-400" />
            </button>
          ) : (
            <button
              type="button"
              className="cta-card cta-glow flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left cursor-pointer"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "color-mix(in srgb, var(--primary) 20%, var(--card))",
                  color: "color-mix(in srgb, var(--primary) 75%, #000)",
                }}
              >
                <Store className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground">
                  {t("profile.cta")}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {t("profile.ctaHint")}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )
        ) : (
          <button
            type="button"
            className="cta-card flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left cursor-pointer"
          >
            <CircleCheck className="size-[18px] shrink-0 text-emerald-700" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium text-muted-foreground">
                {t("profile.button")}
              </span>
              <span className="block truncate text-[13px] font-semibold">
                {settings.bizName}
              </span>
            </span>
            <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent
        className="lg:max-w-[480px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("profile.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-[13px] font-semibold text-foreground">{t("sec.business")}</div>
          <Field label={t("bk.bizName")}>
            <Input value={settings.bizName} placeholder={t("ph.bizName")} onChange={(e) => setSettings({ bizName: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("f.email")}>
              <Input type="email" value={settings.email} placeholder={t("ph.bizEmail")} onChange={(e) => setSettings({ email: e.target.value })} />
            </Field>
            <Field label={t("bk.phone")}>
              <Input value={settings.phone} placeholder={t("ph.phone")} onChange={(e) => setSettings({ phone: e.target.value })} />
            </Field>
          </div>
          <Field label={t("bk.address")}>
            <Textarea className="max-h-[104px] overflow-y-auto" value={settings.address} placeholder={t("ph.bizAddress")} onChange={(e) => setSettings({ address: e.target.value })} />
          </Field>

          <div className="space-y-4 border-t pt-4">
            <div className="text-[13px] font-semibold text-foreground">{t("sec.payment")}</div>
            <Field label={t("bk.bankName")}>
              <Input value={settings.bankName} placeholder={t("ph.bankName")} onChange={(e) => setSettings({ bankName: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("bk.bankAccount")}>
                <Input value={settings.bankAccount} placeholder={t("ph.bankAccount")} onChange={(e) => setSettings({ bankAccount: e.target.value })} />
              </Field>
              <Field label={t("bk.holder")}>
                <Input value={settings.bankOwner} placeholder={t("ph.holder")} onChange={(e) => setSettings({ bankOwner: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            size="sm"
            onClick={() => {
              if (settings.bizName.trim()) trackEvent("business_profile_saved");
              setOpen(false);
            }}
          >
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
