"use client";
// Gate that initializes the persistence backend BEFORE the data providers
// mount, so every store hydrates from the right place (localStorage on web, or
// the JSON vault file on desktop). On a fresh desktop install it shows the
// onboarding location picker; on the web build it's a no-op pass-through.
import * as React from "react";
import { initDataStore, onVaultMissing } from "@/lib/data-store";
import { initHomeDir } from "@/lib/paths";
import { OnboardingView } from "@/components/onboarding-view";
import { VaultMissingView } from "@/components/vault-missing-view";

type Phase = "loading" | "onboarding" | "missing" | "ready";

export function DataBootstrap({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = React.useState<Phase>("loading");

  React.useEffect(() => {
    let alive = true;
    // Also switch to recovery if the vault folder vanishes while running.
    const unsub = onVaultMissing(() => {
      if (alive) setPhase("missing");
    });
    Promise.all([initDataStore(), initHomeDir()])
      .then(([s]) => {
        if (!alive) return;
        setPhase(!s.onboarded ? "onboarding" : s.vaultMissing ? "missing" : "ready");
      })
      .catch(() => {
        if (alive) setPhase("ready"); // fail open — degrade to local storage
      });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }
  if (phase === "onboarding") {
    return <OnboardingView onDone={() => setPhase("ready")} />;
  }
  if (phase === "missing") {
    return <VaultMissingView />;
  }
  return <>{children}</>;
}
