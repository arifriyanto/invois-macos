"use client";
import * as native from "@/lib/native";
// Shown at startup when the active vault's folder can't be found (the user
// moved or deleted it). Offers to locate the folder again, or open one of the
// other registered vaults — instead of silently showing an empty app.
import * as React from "react";
import { FolderSearch, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getActiveVault, listVaults, recoverVaultLocation, switchVault } from "@/lib/data-store";
import { prettyPath } from "@/lib/paths";

export function VaultMissingView() {
  const { t } = useI18n();
  const active = getActiveVault();
  const others = listVaults().filter((v) => v.id !== active?.id);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);

  const locate = async () => {
    setBusy(true);
    setError(false);
    try {
      const { open } = native.dialog;
      const home = await native.path.documentDir().catch(() => undefined);
      const picked = await open({ directory: true, multiple: false, defaultPath: home });
      if (typeof picked !== "string") {
        setBusy(false);
        return;
      }
      if (await recoverVaultLocation(picked)) {
        window.location.reload();
      } else {
        setError(true);
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  };

  const openOther = async (id: string) => {
    setBusy(true);
    if (await switchVault(id)) window.location.reload();
    else setBusy(false);
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-6"
      style={{ background: "linear-gradient(160deg, #2f5fe0 0%, #1739a8 100%)" }}
    >
      <div className="drag-region fixed inset-x-0 top-0 z-30 h-10" />
      <style>{`
        @keyframes vm-step { 0%,100%{transform:scale(1)} 50%{transform:scale(1.18)} }
        @keyframes vm-bob { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-4px) rotate(-4deg)} }
        @keyframes vm-twinkle { 0%,100%{opacity:.2;transform:scale(.6)} 50%{opacity:1;transform:scale(1)} }
        .vm-step,.vm-lens,.vm-spark { transform-box: fill-box; transform-origin: center; }
        .vm-step { animation: vm-step 2.8s ease-in-out infinite; }
        .vm-lens { animation: vm-bob 3.4s ease-in-out infinite; }
        .vm-spark { animation: vm-twinkle 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce){ .vm-step,.vm-lens,.vm-spark{ animation:none } }
      `}</style>

      {/* "Lost trail" — footprints fading into a searching magnifier; lives on the brand bg. */}
      <svg viewBox="0 0 200 110" className="h-auto w-[220px]" fill="none" aria-hidden>
        <path d="M26 96 Q90 74 150 48" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        <g fill="#ffffff">
          <g transform="translate(30 92) rotate(-18)" opacity="1"><g className="vm-step"><ellipse rx="5.5" ry="8" /><ellipse cy="11" rx="3.6" ry="4.5" /></g></g>
          <g transform="translate(58 80) rotate(-26)" opacity="0.7"><g className="vm-step" style={{ animationDelay: "0.2s" }}><ellipse rx="5.5" ry="8" /><ellipse cy="11" rx="3.6" ry="4.5" /></g></g>
          <g transform="translate(86 68) rotate(-32)" opacity="0.44"><g className="vm-step" style={{ animationDelay: "0.4s" }}><ellipse rx="5.5" ry="8" /><ellipse cy="11" rx="3.6" ry="4.5" /></g></g>
          <g transform="translate(112 58) rotate(-38)" opacity="0.24"><g className="vm-step" style={{ animationDelay: "0.6s" }}><ellipse rx="5.5" ry="8" /><ellipse cy="11" rx="3.6" ry="4.5" /></g></g>
        </g>
        <g className="vm-lens">
          <circle cx="152" cy="46" r="15" fill="rgba(255,255,255,0.10)" stroke="#f2c04e" strokeWidth="3.2" />
          <g transform="translate(150 47) rotate(-40)" fill="#ffffff" opacity="0.32"><ellipse rx="4.5" ry="6.5" /><ellipse cy="9" rx="3" ry="3.8" /></g>
          <line x1="163" y1="57" x2="177" y2="71" stroke="#f2c04e" strokeWidth="3.6" strokeLinecap="round" />
        </g>
        <circle className="vm-spark" cx="178" cy="32" r="2.6" fill="#f2c04e" />
        <circle className="vm-spark" style={{ animationDelay: "0.8s" }} cx="138" cy="20" r="2" fill="#f2c04e" />
      </svg>

      <div className="w-full max-w-md space-y-6 rounded-2xl border-0 bg-card p-8 shadow-[0_20px_50px_rgba(9,20,60,0.3)]">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold">{t("vm.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("vm.body").replace("{name}", active?.name ?? "")}
          </p>
        </div>

        {active?.dir && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("vm.expected")}
            </span>
            <div title={active.dir} className="truncate rounded-lg border bg-muted/40 px-3 py-2 font-mono text-[12px] text-muted-foreground">
              {prettyPath(active.dir)}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Button className="w-full" onClick={locate} disabled={busy}>
            <FolderSearch className="size-4" />
            {t("vm.locate")}
          </Button>
          {error && <p className="text-xs text-destructive">{t("vm.notFound")}</p>}
        </div>

        {others.length > 0 && (
          <div className="space-y-1.5 border-t pt-4">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("vm.others")}
            </span>
            {others.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={busy}
                onClick={() => openOther(v.id)}
                className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Database className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{v.name}</div>
                  <div title={v.dir} className="truncate font-mono text-[11px] text-muted-foreground">{prettyPath(v.dir)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
