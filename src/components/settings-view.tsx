"use client";
import * as native from "@/lib/native";
import * as React from "react";
import { toast } from "sonner";
import { Database, FileText, FolderOpen, Hash, Lock, Palette, Pencil, Plus, RotateCcw, SlidersHorizontal, Store, Trash2, Upload, Wallet, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { ColorField } from "@/components/color-field";
import { TemplateGrid } from "@/components/template-grid";
import { readLogoFile } from "@/lib/logo";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useStore, isDevBuild, DEV_PRO_KEY } from "@/lib/store";
import { prettyPath } from "@/lib/paths";
import { useConfirm } from "@/lib/confirm";
import {
  getStatus, listVaults, getActiveVault, ensureDefaultExportDir,
  addVault, switchVault, renameVault, removeVault, devResetOnboarding, type VaultEntry,
} from "@/lib/data-store";
import { NUM_PRESETS, MONTHS_SHORT, computeNextNumber, presetOf, useInvoices } from "@/lib/invoices-store";
import { FREE_VAULT_LIMIT } from "@/lib/limits";
import { useI18n } from "@/lib/i18n";
import { CURRENCY_OPTIONS, CURRENCY_SYMBOLS, formatDate } from "@/lib/format";
import type { Currency, DateFormat, Lang } from "@/lib/types";
import { cn } from "@/lib/utils";

// Color themes — must match the `data-palette` blocks in palettes.css.
const PALETTES: { id: string; name: string }[] = [
  { id: "corporate", name: "Corporate" },
  { id: "cool-neutral", name: "Cool Neutral" },
  { id: "amber-cream", name: "Amber Cream" },
  { id: "ocean", name: "Ocean" },
  { id: "jewel", name: "Jewel" },
  { id: "midnight", name: "Midnight" },
];

type SectionId ="profil" | "payment" | "default" | "nomor" | "invoice" | "tampilan" | "data" | "dev";

const SECTIONS: { id: SectionId; Icon: typeof Store }[] = [
  { id: "profil", Icon: Store },
  { id: "payment", Icon: Wallet },
  { id: "default", Icon: FileText },
  { id: "nomor", Icon: Hash },
  { id: "invoice", Icon: Palette },
  { id: "tampilan", Icon: SlidersHorizontal },
  { id: "data", Icon: Database },
  // Dev-only tools live in their own section, shown only in a development build.
  ...(isDevBuild() ? [{ id: "dev" as const, Icon: Wrench }] : []),
];

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { settings, setSettings, isPro, setUpgradeOpen, setUpgradeContext } = useStore();
  const { t, lang, setLang } = useI18n();
  const { invoices } = useInvoices();
  const confirm = useConfirm();
  const [sec, setSec] = React.useState<SectionId>("profil");
  const [customFmt, setCustomFmt] = React.useState(() => presetOf(settings.numFormat) === "custom");
  // Currency is locked once invoices exist (all invoices share one currency, so
  // the dashboard totals stay meaningful). An explicit "Change anyway" unlocks
  // the picker; picking a new currency then warns that old invoices re-label.
  const [currencyUnlocked, setCurrencyUnlocked] = React.useState(false);
  const currencyLocked = invoices.length > 0 && !currencyUnlocked;
  const changeCurrency = async (next: Currency) => {
    if (next === settings.currency) {
      setCurrencyUnlocked(false);
      return;
    }
    if (invoices.length > 0) {
      const ok = await confirm({
        title: t("set.currencyChangeTitle").replace("{cur}", t(`cur.${next}`)),
        description: t("set.currencyChangeDesc")
          .replace("{n}", String(invoices.length))
          .replace("{from}", CURRENCY_SYMBOLS[settings.currency])
          .replace("{to}", CURRENCY_SYMBOLS[next]),
        confirmText: t("set.currencyChangeAnyway"),
        destructive: true,
      });
      if (!ok) {
        setCurrencyUnlocked(false);
        return;
      }
    }
    setSettings({ currency: next });
    setCurrencyUnlocked(false);
  };
  const isCustomFmt = customFmt || presetOf(settings.numFormat) === "custom";

  const copyToken = async (tok: string) => {
    try {
      await navigator.clipboard.writeText(tok);
      toast.success(`${tok} ${t("set.copied")}`);
    } catch {
      toast.error(t("set.copyFail"));
    }
  };

  const pickFolder = async () => {
    try {
      const { open } = native.dialog;
      // Open where the exports already go, so "change it slightly" is one click.
      const picked = await open({
        directory: true,
        multiple: false,
        defaultPath: settings.exportDir || undefined,
      });
      if (typeof picked === "string") setSettings({ exportDir: picked });
    } catch {
      /* folder picker only available in the desktop app */
    }
  };

  // "Reset" points the export folder back at the default: the "Exports" subfolder
  // inside the vault (created if needed), falling back to the OS Downloads folder.
  const resetToDefault = async () => {
    try {
      const vaultExports = await ensureDefaultExportDir();
      if (vaultExports) {
        setSettings({ exportDir: vaultExports });
        return;
      }
      const { downloadDir } = native.path;
      setSettings({ exportDir: await downloadDir() });
    } catch {
      setSettings({ exportDir: "" });
    }
  };

  // Businesses (data vaults). File backend only; empty on the web build.
  const [isFileMode] = React.useState(() => getStatus().mode === "file");
  // Vaults are only ever mutated from within this dialog (add/switch/rename/
  // remove), and each handler calls refreshVaults(), so a lazy initial read
  // stays current — no on-open sync effect needed.
  const [vaults, setVaults] = React.useState<VaultEntry[]>(() => listVaults());
  const [activeId, setActiveId] = React.useState(() => getActiveVault()?.id ?? "");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameText, setRenameText] = React.useState("");
  // Dev-only Pro override (never rendered in the shipped app — see isDevBuild).
  const [devPro] = React.useState(() => {
    try {
      return localStorage.getItem(DEV_PRO_KEY) === "1";
    } catch {
      return false;
    }
  });

  const refreshVaults = React.useCallback(() => {
    setVaults(listVaults());
    setActiveId(getActiveVault()?.id ?? "");
  }, []);

  const pickDir = async (): Promise<string | null> => {
    try {
      const { open: openDialog } = native.dialog;
      // Vaults belong next to the existing one, so start in Documents.
      const home = await native.path.documentDir().catch(() => undefined);
      const picked = await openDialog({ directory: true, multiple: false, defaultPath: home });
      return typeof picked === "string" ? picked : null;
    } catch {
      return null;
    }
  };

  // Register a new business (fresh, empty data at the chosen folder).
  const addBusiness = async () => {
    // Free-tier cap: only one business/vault. A 2nd one gates to Pro (relocating
    // the single vault is separate and stays free).
    if (!isPro && vaults.length >= FREE_VAULT_LIMIT) {
      setUpgradeContext("vaultLimit");
      setUpgradeOpen(true);
      return;
    }
    const picked = await pickDir();
    if (!picked) return;
    try {
      await addVault(picked);
      refreshVaults();
      toast.success(t("set.businessAdded"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg === "folder-in-use"
          ? t("set.folderInUse")
          : msg === "folder-nested"
            ? t("set.folderNested")
            : t("set.locationFailed"),
      );
    }
  };

  // Switch the active business — reloads so every store re-hydrates.
  const switchTo = async (v: VaultEntry) => {
    const ok = await confirm({
      title: t("set.switchTitle").replace("{name}", v.name),
      description: t("set.switchDesc"),
      confirmText: t("set.useThis"),
    });
    if (!ok) return;
    if (await switchVault(v.id)) window.location.reload();
  };

  // Forget a business from the list (data files are left on disk).
  const removeBusiness = async (v: VaultEntry) => {
    const ok = await confirm({
      title: t("set.removeTitle").replace("{name}", v.name),
      description: t("set.removeDesc"),
      destructive: true,
      confirmText: t("act.delete"),
    });
    if (!ok) return;
    removeVault(v.id);
    refreshVaults();
  };

  const startRename = (v: VaultEntry) => {
    setRenamingId(v.id);
    setRenameText(v.name);
  };
  const commitRename = () => {
    if (renamingId) {
      renameVault(renamingId, renameText);
      refreshVaults();
    }
    setRenamingId(null);
  };
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const numTokens: { tok: string; ex: string }[] = [
    { tok: "{PREFIX}", ex: settings.invPrefix || "INV" },
    { tok: "{YYYY}", ex: yyyy },
    { tok: "{YY}", ex: yyyy.slice(2) },
    { tok: "{MM}", ex: String(now.getMonth() + 1).padStart(2, "0") },
    { tok: "{MMM}", ex: MONTHS_SHORT[now.getMonth()] },
    { tok: "{DD}", ex: String(now.getDate()).padStart(2, "0") },
    { tok: "{CLIENT}", ex: "PAB" },
    { tok: "{SEQ}", ex: "1".padStart(settings.numPadding, "0") },
  ];

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    readLogoFile(file)
      .then((url) => setSettings({ logo: url }))
      .catch((err) => {
        if (err instanceof Error && err.message === "too-big") toast.error(t("toast.logoBig"));
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 lg:max-w-3xl"
        onInteractOutside={(e) => {
          // Don't close Settings when the interaction is inside a nested dialog
          // (e.g. the delete/switch confirm) — otherwise confirming closes both.
          const el = e.detail.originalEvent.target as Element | null;
          if (el?.closest('[role="dialog"],[role="alertdialog"]')) e.preventDefault();
        }}
      >
        <div className="flex h-[560px] max-lg:h-auto max-lg:flex-col">
      {/* section list */}
      <nav className="w-52 shrink-0 border-r bg-sidebar p-3 max-lg:w-full max-lg:border-r-0 max-lg:border-b">
        <DialogTitle className="px-2.5 pb-2 text-lg font-semibold">{t("nav.settings")}</DialogTitle>
        <DialogDescription className="sr-only">{t("set.appSettings")}</DialogDescription>
        {SECTIONS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSec(id)}
            className={cn(
              "mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
              sec === id
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="size-4" />
            {id === "dev" ? "Developer" : t(`set.${id}`)}
          </button>
        ))}
      </nav>

      {/* detail */}
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-lg space-y-5">
          {sec === "profil" && (
            <Section title={t("set.profil")} desc={t("set.profilDesc")}>
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
                <Textarea className="max-h-[104px]" value={settings.address} placeholder={t("ph.bizAddress")} onChange={(e) => setSettings({ address: e.target.value })} />
              </Field>
            </Section>
          )}

          {sec === "payment" && (
            <Section title={t("set.payment")} desc={t("set.paymentDesc")}>
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
            </Section>
          )}

          {sec === "default" && (
            <Section title={t("set.default")} desc={t("set.defaultDesc")}>
              <div className="grid grid-cols-2 items-start gap-3">
                <Field label={t("bk.currency")}>
                  {currencyLocked ? (
                    <div className="flex h-9 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                      <span>{t(`cur.${settings.currency}`)}</span>
                      <Lock className="size-3.5" />
                    </div>
                  ) : (
                    <Select value={settings.currency} onValueChange={(v) => changeCurrency(v as Currency)}>
                      <SelectTrigger className="w-full" aria-label={t("bk.currency")}><SelectValue /></SelectTrigger>
                      <SelectContent position="popper">
                        {CURRENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{t(`cur.${o.value}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                <Field label={t("set.paymentTerm")}>
                  <Input
                    type="number"
                    min={0}
                    value={settings.paymentTermDays}
                    onChange={(e) => setSettings({ paymentTermDays: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                </Field>
              </div>
              {currencyLocked && (
                <p className="text-xs text-muted-foreground">
                  {t("set.currencyLocked").replace("{n}", String(invoices.length))}{" "}
                  <button
                    type="button"
                    onClick={() => setCurrencyUnlocked(true)}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {t("set.currencyChangeAnyway")}
                  </button>
                </p>
              )}
              <Field label={t("set.dateFormat")}>
                <Select value={settings.dateFormat} onValueChange={(v) => setSettings({ dateFormat: v as DateFormat })}>
                  <SelectTrigger className="w-full" aria-label={t("set.dateFormat")}><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="long">{formatDate("2026-07-01", lang, "long")}</SelectItem>
                    <SelectItem value="dmy-long">{formatDate("2026-07-01", lang, "dmy-long")}</SelectItem>
                    <SelectItem value="dmy">{formatDate("2026-07-01", lang, "dmy")}</SelectItem>
                    <SelectItem value="mdy">{formatDate("2026-07-01", lang, "mdy")}</SelectItem>
                    <SelectItem value="ymd">{formatDate("2026-07-01", lang, "ymd")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">{t("set.ppnDefault")}</div>
                  <p className="text-xs text-muted-foreground">{t("set.ppnDefaultDesc")}</p>
                </div>
                <Switch
                  checked={settings.defaultTaxEnabled}
                  onCheckedChange={(v) => setSettings({ defaultTaxEnabled: v })}
                />
              </div>
              {settings.defaultTaxEnabled && (
                <Field label={t("set.ppnRate")}>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={settings.defaultTaxRate}
                      onChange={(e) =>
                        setSettings({
                          defaultTaxRate: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
                        })
                      }
                    />
                  </div>
                </Field>
              )}
              <Field label={t("set.noteDefault")}>
                <Textarea
                  className="max-h-[104px]"
                  value={settings.defaultNote}
                  placeholder={t("inv.defaultNote")}
                  onChange={(e) => setSettings({ defaultNote: e.target.value })}
                />
              </Field>
            </Section>
          )}

          {sec === "nomor" && (
            <Section title={t("set.nomor")} desc={t("set.nomorDesc")}>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("set.basedOn")}>
                  <Select
                    value={isCustomFmt ? "custom" : presetOf(settings.numFormat)}
                    onValueChange={(v) => {
                      if (v === "custom") {
                        setCustomFmt(true);
                        return;
                      }
                      setCustomFmt(false);
                      const preset = NUM_PRESETS.find((p) => p.id === v);
                      if (preset) setSettings({ numFormat: preset.template });
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label={t("set.basedOn")}><SelectValue /></SelectTrigger>
                    <SelectContent position="popper">
                      {NUM_PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{t(`num.${p.id}`)}</SelectItem>
                      ))}
                      <SelectItem value="custom">{t("num.custom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("set.prefix")}>
                  <Input value={settings.invPrefix} placeholder="INV" onChange={(e) => setSettings({ invPrefix: e.target.value })} />
                </Field>
              </div>

              {isCustomFmt && (
                <Field label={t("set.templateField")}>
                  <Input
                    className="font-mono"
                    value={settings.numFormat}
                    placeholder="{PREFIX}-{YYYY}-{SEQ}"
                    onChange={(e) => setSettings({ numFormat: e.target.value })}
                  />
                </Field>
              )}

              <div className="w-32">
                <Field label={t("set.numWidth")}>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={settings.numPadding}
                    onChange={(e) => setSettings({ numPadding: Math.max(1, Math.min(8, parseInt(e.target.value) || 3)) })}
                  />
                </Field>
              </div>

              {isCustomFmt && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">
                    {t("set.tokenHint")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {numTokens.map(({ tok, ex }) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => copyToken(tok)}
                        title={`Salin ${tok}`}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors hover:bg-muted"
                      >
                        <span className="text-foreground">{tok}</span>
                        <span className="text-muted-foreground/70">→ {ex}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t("set.example")}</span>
                <span className="font-mono">
                  {computeNextNumber([], {
                    format: settings.numFormat,
                    prefix: settings.invPrefix,
                    padding: settings.numPadding,
                    clientName: "PT Awan Biru",
                  })}
                </span>
              </div>
            </Section>
          )}

          {sec === "invoice" && (
            <Section title={t("set.invoice")} desc={t("set.invoiceDesc")}>
              <Field label={t("bk.logo")}>
                <label className="relative flex w-fit flex-col items-center justify-center gap-1.5 border border-dashed rounded-xl p-4 cursor-pointer hover:border-primary hover:bg-accent transition-colors">
                  <input type="file" accept="image/*" onChange={onLogo} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {settings.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logo} alt="logo" className="max-h-12 max-w-[120px] object-contain" />
                  ) : (
                    <>
                      <Upload className="size-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t("bk.logoUpload")}</span>
                      <span className="text-[11px] text-muted-foreground/60">{t("bk.logoHint")}</span>
                    </>
                  )}
                </label>
                {settings.logo && (
                  <button type="button" onClick={() => setSettings({ logo: null })} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive self-start">
                    <Trash2 className="size-3" /> {t("bk.logoRemove")}
                  </button>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-4 items-start">
                <Field label={t("set.headerBrand")}>
                  <Select value={settings.headerBrand} onValueChange={(v) => setSettings({ headerBrand: v as "logo" | "name" })}>
                    <SelectTrigger className="w-full" aria-label={t("set.headerBrand")}><SelectValue /></SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="logo">{t("set.brandLogo")}</SelectItem>
                      <SelectItem value="name">{t("set.brandName")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("bk.accent")}>
                  <ColorField value={settings.color} onChange={(c) => setSettings({ color: c })} />
                </Field>
              </div>
              <Field label={t("set.defaultTemplate")}>
                <div className="rounded-xl bg-secondary p-4">
                  <TemplateGrid cols={2} />
                </div>
              </Field>
            </Section>
          )}

          {sec === "tampilan" && (
            <Section title={t("set.tampilan")} desc={t("set.tampilanDesc")}>
              <Field label={t("set.language")}>
                <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
                  <SelectTrigger className="w-full" aria-label={t("set.language")}><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="id">{t("lang.id")}</SelectItem>
                    <SelectItem value="en">{t("lang.en")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("set.theme")}>
                <div className="grid grid-cols-4 gap-2">
                  {PALETTES.map((p) => {
                    const active = settings.palette === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSettings({ palette: p.id })}
                        title={p.name}
                        className={cn(
                          "flex flex-col items-stretch gap-1 rounded-lg border p-1 text-left transition-colors",
                          active ? "border-primary ring-2 ring-primary" : "hover:border-primary/40"
                        )}
                      >
                        <div
                          data-palette={p.id}
                          className="flex items-center gap-1 rounded-md p-2"
                          style={{ background: "var(--app-bg)" }}
                        >
                          <span className="size-4 rounded-full" style={{ background: "var(--primary)" }} />
                          <span className="size-3.5 rounded-full border border-black/10" style={{ background: "var(--card)" }} />
                          <span className="size-2 rounded-full" style={{ background: "var(--muted-foreground)" }} />
                        </div>
                        <span className={cn("truncate px-0.5 text-[10px]", active ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </Section>
          )}

          {isDevBuild() && sec === "dev" && (
            <Section title="Developer" desc="Dev-only tools. Not shown in release builds.">
              <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Pro mode</div>
                  <div className="text-xs text-muted-foreground">
                    Preview the Pro experience. Reloads on toggle.
                  </div>
                </div>
                <Switch
                  checked={devPro}
                  onCheckedChange={(v) => {
                    try {
                      if (v) localStorage.setItem(DEV_PRO_KEY, "1");
                      else localStorage.removeItem(DEV_PRO_KEY);
                    } catch {
                      /* ignore */
                    }
                    window.location.reload();
                  }}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Reset onboarding</div>
                  <div className="text-xs text-muted-foreground">
                    Return to the setup flow. Your vault file stays on disk.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    devResetOnboarding();
                    window.location.reload();
                  }}
                >
                  Reset
                </Button>
              </div>
            </Section>
          )}

          {sec === "data" && (
            <Section title={t("set.data")} desc={t("set.dataDesc")}>
              {isFileMode && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-medium text-foreground">{t("set.businesses")}</h3>
                      <p className="text-xs text-muted-foreground">{t("set.businessesHint")}</p>
                    </div>
                    <div className="space-y-1.5">
                      {vaults.map((v) => {
                        const active = v.id === activeId;
                        const renaming = renamingId === v.id;
                        return (
                          <div
                            key={v.id}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border px-3 py-2",
                              active && "border-primary/40 bg-primary/[0.03]"
                            )}
                          >
                            <Database className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              {renaming ? (
                                <Input
                                  autoFocus
                                  value={renameText}
                                  onChange={(e) => setRenameText(e.target.value)}
                                  onBlur={commitRename}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitRename();
                                    if (e.key === "Escape") setRenamingId(null);
                                  }}
                                  className="h-7"
                                />
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-sm font-medium">{v.name}</span>
                                    {active && (
                                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                        {t("set.active")}
                                      </span>
                                    )}
                                  </div>
                                  <div title={v.dir} className="truncate font-mono text-[11px] text-muted-foreground">
                                    {prettyPath(v.dir)}
                                  </div>
                                </>
                              )}
                            </div>
                            {!renaming && (
                              <div className="flex shrink-0 items-center gap-0.5">
                                {!active && (
                                  <Button variant="ghost" size="sm" onClick={() => switchTo(v)}>
                                    {t("set.useThis")}
                                  </Button>
                                )}
                                <button
                                  type="button"
                                  title={t("set.rename")}
                                  onClick={() => startRename(v)}
                                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                {!active && vaults.length > 1 && (
                                  <button
                                    type="button"
                                    title={t("act.delete")}
                                    onClick={() => removeBusiness(v)}
                                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-1">
                      <Button variant="outline" size="sm" onClick={addBusiness}>
                        <Plus className="size-4" />
                        {t("set.addBusiness")}
                      </Button>
                    </div>
                  </div>
                  <div className="border-t pt-4" />
                </>
              )}
              <div className="space-y-0.5">
                <h3 className="text-sm font-medium text-foreground">{t("set.exportHeading")}</h3>
                <p className="text-xs text-muted-foreground">{t("set.exportDirHint")}</p>
              </div>
              <Field label={t("set.exportDir")}>
                <div
                  title={settings.exportDir || undefined}
                  className="flex h-8 w-full min-w-0 items-center overflow-hidden rounded-lg border border-input bg-card px-3 font-mono text-[13px] text-foreground"
                >
                  <span className="truncate">{settings.exportDir ? prettyPath(settings.exportDir) : t("set.exportDirDownload")}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={pickFolder}>
                    <FolderOpen className="size-4" />
                    {t("set.pickFolder")}
                  </Button>
                  {settings.exportDir && (
                    <button
                      type="button"
                      onClick={resetToDefault}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="size-3.5" />
                      {t("set.reset")}
                    </button>
                  )}
                </div>
              </Field>
            </Section>
          )}
        </div>
      </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {desc && <p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  );
}
