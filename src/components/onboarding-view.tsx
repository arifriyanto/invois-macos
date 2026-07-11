"use client";
import * as native from "@/lib/native";
// First-run wizard (desktop), design "3b": a full brand-blue screen. Left column
// = an animated illustration carousel (safe → profile card → success check) with
// the app version underneath; right column = a hero heading + description on the
// blue, then the step's form inside a floating white card. An animated
// "supergraphic" (brand rings) sits behind the top-left corner. Steps: (1) data
// location, (2) optional business profile + currency, then a "done" screen. The
// vault is created on finish; initial settings are written straight to it (the
// store provider isn't mounted yet — see persistInitialSettings).
//
// The blue background + illustrations are intentionally hardcoded (OB_BLUE /
// OB_GOLD), not palette tokens — this is the fixed brand screen. Only the white
// card's form controls follow the active palette.
import * as React from "react";
import { Check, FolderOpen, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { completeOnboarding, suggestVaultDir, isDirInsideVault } from "@/lib/data-store";
import { persistInitialSettings, peekVaultSettings } from "@/lib/store";
import { setBootIntent } from "@/lib/boot-intent";
import { seedSampleData } from "@/lib/sample-data";
import { prettyPath } from "@/lib/paths";
import { readLogoFile } from "@/lib/logo";
import { CURRENCY_OPTIONS, detectDefaultCurrency } from "@/lib/format";
import type { Currency } from "@/lib/types";

const KEYFRAMES = `
@keyframes ob-ring{0%{transform:translate(-50%,-50%) scale(.85);opacity:.6}100%{transform:translate(-50%,-50%) scale(1.2);opacity:0}}
@keyframes ob-spin{to{transform:rotate(360deg)}}
@keyframes ob-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes ob-upDot{0%{transform:translateY(14px);opacity:0}25%{opacity:1}60%,100%{transform:translateY(-16px);opacity:0}}
@keyframes ob-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes ob-ripple{0%{transform:scale(.82);opacity:.55}100%{transform:scale(2);opacity:0}}
@keyframes ob-inFwd{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
@keyframes ob-inBack{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
@keyframes ob-blob{0%,100%{border-radius:42% 58% 63% 37% / 42% 42% 58% 58%}33%{border-radius:62% 38% 40% 60% / 55% 62% 38% 45%}66%{border-radius:40% 60% 55% 45% / 60% 40% 60% 40%}}
@keyframes ob-draw{from{stroke-dashoffset:22}to{stroke-dashoffset:0}}
@keyframes ob-pop2{0%{opacity:0;transform:scale(.3)}60%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion: reduce){[data-ob-anim]{animation:none !important}}
`;

// Brand-blue screen palette — hardcoded (does NOT follow the active app palette).
const OB_BLUE = "linear-gradient(160deg, #2f5fe0 0%, #1739a8 100%)";
const OB_GOLD = "#f2c04e";
// Shown small in the corner. Keep in sync with tauri.conf.json / package.json.
const APP_VERSION = "0.1.0";

const SORA = { fontFamily: "var(--font-sora), var(--font-sans)" } as React.CSSProperties;

// ---- animated illustrations (white + gold on the brand-blue background) ------

// Step 1 — a safe/vault: pulsing halo, spinning combination dial with a gold
// cross-knob, a floating cloud (data), and a rising gold dot.
function SafeArt() {
  const corner = "absolute h-[6px] w-[6px] rounded-full bg-white/70";
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div data-ob-anim className="absolute left-1/2 top-1/2 h-[210px] w-[210px] rounded-full border-2 border-white/10" style={{ animation: "ob-ring 5s ease-out infinite" }} />
      <div className="relative flex h-[124px] w-[124px] items-center justify-center rounded-[18px] border-[3px] border-white bg-white/10">
        <div className={corner} style={{ top: 8, left: 8 }} />
        <div className={corner} style={{ top: 8, right: 8 }} />
        <div className={corner} style={{ bottom: 8, left: 8 }} />
        <div className={corner} style={{ bottom: 8, right: 8 }} />
        <div className="absolute left-[-3px] top-[34px] h-[18px] w-[4px] rounded-[2px] bg-white" />
        <div className="absolute left-[-3px] bottom-[34px] h-[18px] w-[4px] rounded-[2px] bg-white" />
        <div className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full border-2 border-white">
          <div data-ob-anim className="absolute h-[78px] w-[78px] rounded-full border-[3px] border-dashed border-white/55" style={{ animation: "ob-spin 14s linear infinite" }} />
          <div className="absolute left-1/2 top-[-5px] ml-[-4px] h-0 w-0 border-l-4 border-r-4 border-t-[8px] border-l-transparent border-r-transparent" style={{ borderTopColor: OB_GOLD }} />
          <div data-ob-anim className="relative flex h-[40px] w-[40px] items-center justify-center" style={{ animation: "ob-spin 7s linear infinite" }}>
            <div className="absolute h-[8px] w-[40px] rounded-[4px]" style={{ background: OB_GOLD }} />
            <div className="absolute h-[40px] w-[8px] rounded-[4px]" style={{ background: OB_GOLD }} />
            <div className="absolute h-[16px] w-[16px] rounded-full border-2 bg-white" style={{ borderColor: OB_GOLD }} />
          </div>
        </div>
      </div>
      <div data-ob-anim className="absolute right-[30px] top-[8px]" style={{ animation: "ob-bob 4s ease-in-out infinite" }}>
        <div className="relative h-[36px] w-[58px]">
          <div className="absolute bottom-0 left-0 h-[19px] w-[58px] rounded-[10px] bg-white" />
          <div className="absolute bottom-[10px] left-[10px] h-[23px] w-[23px] rounded-full bg-white" />
          <div className="absolute bottom-[12px] left-[27px] h-[19px] w-[19px] rounded-full bg-white" />
        </div>
      </div>
      <div data-ob-anim className="absolute right-[52px] top-[48px] h-[6px] w-[6px] rounded-full" style={{ background: OB_GOLD, animation: "ob-upDot 2s ease-in infinite" }} />
    </div>
  );
}

// Step 2 — a business profile card swaying on a stem.
function IdCardArt() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      <div className="h-[34px] w-[6px]" style={{ background: OB_GOLD }} />
      <div data-ob-anim className="origin-top" style={{ animation: "ob-sway 4s ease-in-out infinite" }}>
        <div className="mx-auto h-[12px] w-[22px] rounded-[3px] bg-white" />
        <div className="mt-[-2px] flex w-[132px] flex-col items-center gap-[9px] rounded-[12px] bg-white p-4" style={{ boxShadow: "0 12px 30px rgba(9,20,60,0.35)" }}>
          <div className="flex h-[46px] w-[46px] items-end justify-center overflow-hidden rounded-full bg-[#1d4ed8]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8.5" r="4" /><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></svg>
          </div>
          <div className="h-[8px] w-[80%] rounded-[4px] bg-[#16203a]" />
          <div className="h-[6px] w-[55%] rounded-[3px] bg-[#c9d5e8]" />
        </div>
      </div>
    </div>
  );
}

// Done step — the celebration check. The badge pops in and the tick draws
// itself, while beacon-style rings keep radiating outward (like the walkthrough
// beacon). Sits centered above the "All set" heading on the done screen.
function DoneCheck() {
  return (
    <div className="relative flex size-[92px] items-center justify-center">
      {/* beacon: rings radiating outward, staggered + continuous */}
      {[0, 0.8, 1.6].map((d) => (
        <span
          key={d}
          data-ob-anim
          className="absolute inset-0 rounded-full border-2 border-white/55"
          style={{ animation: `ob-ripple 2.4s ${0.4 + d}s ease-out infinite` }}
        />
      ))}
      {/* badge */}
      <span
        data-ob-anim
        className="relative flex size-[92px] items-center justify-center rounded-full bg-white"
        style={{ boxShadow: "0 18px 44px rgba(9,20,60,0.42)", animation: "ob-pop2 .55s cubic-bezier(.34,1.56,.64,1) both" }}
      >
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path
            data-ob-anim
            d="M5 12.5l4.5 4.5L19 7.5"
            style={{ strokeDasharray: 22, animation: "ob-draw .4s .5s ease-out both" }}
          />
        </svg>
      </span>
    </div>
  );
}

// Animated brand supergraphic — soft "liquid" blobs (morphing border-radius +
// slow rotation) anchored off the top-left, behind everything.
function SuperGraphic() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute z-0" style={{ top: -140, left: -120, width: 420, height: 420 }}>
      <div
        data-ob-anim
        className="absolute inset-0"
        style={{ background: "rgba(255,255,255,0.07)", animation: "ob-blob 12s ease-in-out infinite, ob-spin 40s linear infinite" }}
      />
      <div
        data-ob-anim
        className="absolute"
        style={{ inset: 68, background: "rgba(255,255,255,0.06)", animation: "ob-blob 9s ease-in-out infinite reverse, ob-spin 55s linear infinite reverse" }}
      />
      <div data-ob-anim className="absolute h-[26px] w-[26px] rounded-full" style={{ right: 88, bottom: 104, background: OB_GOLD, opacity: 0.9, animation: "ob-bob 4s ease-in-out infinite" }} />
    </div>
  );
}

function Dots({ active }: { active: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1].map((i) => (
        <span
          key={i}
          className="h-1.5 rounded-full transition-all"
          style={{ width: i === active ? 20 : 6, background: i === active ? "#ffffff" : "rgba(255,255,255,0.32)" }}
        />
      ))}
    </div>
  );
}

export function OnboardingView({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = React.useState<0 | 1 | 2>(0); // 2 = done
  const [nav, setNav] = React.useState<"fwd" | "back">("fwd"); // right-form slide direction
  const [busy, setBusy] = React.useState(false);
  const go = (next: 0 | 1 | 2) => {
    if (next === step) return;
    setNav(next > step ? "fwd" : "back");
    setStep(next); // the left illustration carousel just slides its track to `step`
  };

  const [dir, setDir] = React.useState("");
  const [dirError, setDirError] = React.useState("");
  React.useEffect(() => {
    void suggestVaultDir().then((d) => setDir((cur) => cur || d));
  }, []);
  const pick = async () => {
    try {
      const { open } = native.dialog;
      // Open in Documents (where the suggested ~/Documents/Invois would live)
      // rather than wherever macOS last left the panel — usually Downloads.
      const home = await native.path.documentDir().catch(() => undefined);
      const picked = await open({ directory: true, multiple: false, defaultPath: home });
      if (typeof picked !== "string") return;
      // Show the picked folder, but flag it (and block Next) when it sits inside
      // another vault (its Backups/Exports…).
      const nested = await isDirInsideVault(picked);
      setDir(picked);
      setDirError(nested ? t("ob.folderNested") : "");
    } catch {
      /* picker only available in the desktop app */
    }
  };

  const [bizName, setBizName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [logo, setLogo] = React.useState<string | null>(null);
  // Default to the currency inferred from the OS locale (falls back to USD);
  // overridden below if an adopted vault already has a saved currency.
  const [currency, setCurrency] = React.useState<Currency>(detectDefaultCurrency);
  // True when the chosen folder already holds an Invois vault (reinstall case):
  // we prefill the profile form from it and adopt it instead of seeding samples.
  const [existingVault, setExistingVault] = React.useState(false);
  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readLogoFile(file)
      .then((url) => setLogo(url))
      .catch(() => {
        /* oversized/unreadable logo — skip (rare during onboarding) */
      });
  };

  // Peek at the selected folder: if it already contains a vault, prefill the
  // profile form from its saved settings. setState only fires inside the async
  // callback, so this doesn't trip the set-state-in-effect rule.
  React.useEffect(() => {
    if (!dir) return;
    let cancelled = false;
    void peekVaultSettings(dir).then((s) => {
      if (cancelled) return;
      if (!s) {
        setExistingVault(false);
        return;
      }
      setExistingVault(true);
      if (typeof s.bizName === "string") setBizName(s.bizName);
      if (typeof s.email === "string") setEmail(s.email);
      if (typeof s.phone === "string") setPhone(s.phone);
      if ("logo" in s) setLogo(s.logo ?? null);
      if (s.currency) setCurrency(s.currency);
    });
    return () => {
      cancelled = true;
    };
  }, [dir]);

  const finish = async (skip: boolean) => {
    if (!dir) return;
    setBusy(true);
    try {
      const { adopted } = await completeOnboarding(dir);
      if (!skip) {
        persistInitialSettings({ bizName: bizName.trim(), email: email.trim(), phone: phone.trim(), logo, currency });
      }
      // Only seed the labelled example client + catalog item into a BRAND-NEW
      // vault. An adopted (existing) vault already has the user's real data.
      if (!adopted) seedSampleData(currency);
      go(2);
    } catch {
      setBusy(false);
    }
  };

  // Per-step hero copy (shown on the blue, above the white card). `dot` adds the
  // gold brand full-stop to the "statement" steps (not the profile form).
  const hero =
    step === 0
      ? { title: t("ob.title"), body: t("ob.body"), dot: true }
      : step === 1
        ? { title: t("ob.profileTitle"), body: t("ob.profileBody"), dot: false }
        : { title: t("ob.doneTitle"), body: t("ob.doneBody"), dot: true };

  return (
    <div className="relative flex min-h-screen overflow-hidden" style={{ background: OB_BLUE }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      {/* Draggable strip so the frameless window can be moved (no title bar yet). */}
      <div className="drag-region fixed inset-x-0 top-0 z-30 h-10" />

      <SuperGraphic />

      {/* LEFT — illustration carousel + app version. Hidden on the done step so
          the celebration takes over the whole screen, centered. */}
      {step < 2 && (
        <div className="relative z-10 flex w-[250px] shrink-0 flex-col px-8 pb-9 pt-16 max-lg:hidden">
          {/* Nudged toward the white form card on the right. */}
          <div aria-hidden="true" className="relative flex-1 overflow-hidden" style={{ transform: "translateX(78px)" }}>
            <div
              className="flex h-full w-[300%]"
              style={{ transform: `translateX(${step * -33.3333}%)`, transition: "transform 0.5s cubic-bezier(.45,0,.2,1)" }}
            >
              <div className="flex h-full w-1/3 items-center justify-center"><SafeArt /></div>
              <div className="flex h-full w-1/3 items-center justify-center"><IdCardArt /></div>
              <div className="flex h-full w-1/3" />
            </div>
          </div>
          <div className="text-[11.5px]" style={{ color: "#b9ccf7" }}>Invois v{APP_VERSION}</div>
        </div>
      )}

      {/* RIGHT — hero heading + body on the blue, then a white form card. */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-16 max-lg:p-8">
        <div
          key={step}
          data-ob-anim
          className={`flex w-full max-w-[560px] flex-col gap-8 ${step === 2 ? "items-center text-center" : ""}`}
          style={{ animation: `${nav === "fwd" ? "ob-inFwd" : "ob-inBack"} .28s ease-out both` }}
        >
          <div className={`flex flex-col gap-3 ${step === 2 ? "items-center" : ""}`}>
            {step === 2 && (
              <div className="mb-3">
                <DoneCheck />
              </div>
            )}
            <h1 className="text-[30px] font-semibold leading-tight text-white" style={SORA}>
              {hero.title}
              {hero.dot && <span style={{ color: OB_GOLD }}>.</span>}
            </h1>
            <p className="max-w-[520px] text-[15px] leading-relaxed" style={{ color: "#b9ccf7" }}>{hero.body}</p>
          </div>

          <div className={step === 2 ? "flex justify-center" : undefined}>
          {step === 2 ? (
            // Done step has no form, so no white card — the CTA sits straight on
            // the blue, below the hero. A white button reads cleanly on blue.
            <Button
              size="lg"
              className="bg-white text-[#1739a8] hover:bg-white/90"
              onClick={() => {
                setBootIntent("new-invoice");
                onDone();
              }}
            >
              {t("ob.firstInvoice")}
            </Button>
          ) : (
            <div className="rounded-2xl bg-white p-8 text-foreground shadow-[0_20px_50px_rgba(9,20,60,0.3)]">
            {step === 0 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{t("ob.locationLabel")}</span>
                  <div className="flex items-center gap-2">
                    <div title={dir || undefined} className="flex h-10 min-w-0 flex-1 items-center truncate rounded-lg border border-input bg-card px-3 font-mono text-[12.5px] text-foreground">
                      <span className="truncate">{prettyPath(dir) || "…"}</span>
                    </div>
                    <Button size="lg" variant="outline" className="shrink-0" onClick={pick} disabled={busy}>
                      <FolderOpen className="size-4" />
                      {t("set.pickFolder")}
                    </Button>
                  </div>
                  {dirError && <p className="text-xs text-destructive">{dirError}</p>}
                </div>
                <div className="flex justify-end">
                  <Button size="lg" onClick={() => go(1)} disabled={!dir || busy || !!dirError}>{t("ob.next")}</Button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-5">
                {existingVault && (
                  <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
                    <Check className="mt-0.5 size-[15px] shrink-0 text-primary" strokeWidth={2.4} />
                    <span>{t("ob.existingFound")}</span>
                  </div>
                )}

                <div className="flex items-center gap-3.5">
                  <label className="relative flex size-[52px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-input transition-colors hover:border-primary hover:bg-accent" style={{ background: logo ? "transparent" : "var(--secondary)" }}>
                    <input type="file" accept="image/*" onChange={onLogo} className="absolute inset-0 cursor-pointer opacity-0" />
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="logo" className="max-h-10 max-w-[44px] object-contain" />
                    ) : (
                      <Upload className="size-4 text-muted-foreground" />
                    )}
                  </label>
                  <div className="flex flex-col gap-0.5 text-xs">
                    <span className="font-medium text-foreground">{t("bk.logo")}</span>
                    {logo && (
                      <button type="button" onClick={() => setLogo(null)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3" /> {t("bk.logoRemove")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">{t("bk.bizName")}</span>
                    <Input value={bizName} placeholder={t("ph.bizName")} onChange={(e) => setBizName(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">{t("f.email")}</span>
                    <Input type="email" value={email} placeholder={t("ph.email")} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">{t("bk.phone")}</span>
                    <Input value={phone} placeholder={t("ph.phone")} onChange={(e) => setPhone(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">{t("bk.currency")}</span>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                      <SelectTrigger className="w-full" aria-label={t("bk.currency")}><SelectValue /></SelectTrigger>
                      <SelectContent position="popper">
                        {CURRENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <Button size="lg" variant="ghost" onClick={() => go(0)} disabled={busy}>{t("ob.back")}</Button>
                  <div className="flex items-center gap-1">
                    <Button size="lg" variant="ghost" onClick={() => finish(true)} disabled={busy}>{t("ob.skip")}</Button>
                    <Button size="lg" onClick={() => finish(false)} disabled={busy}>{busy ? t("ob.starting") : t("ob.finish")}</Button>
                  </div>
                </div>
              </div>
            )}

            </div>
          )}
          {step < 2 && (
            <div className="mt-5 flex justify-center">
              <Dots active={step} />
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
