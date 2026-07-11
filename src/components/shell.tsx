"use client";
import * as native from "@/lib/native";
import * as React from "react";
import { PanelLeft, Crown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { DashboardView } from "@/components/dashboard-view";
import { InvoicesView } from "@/components/invoices-view";
import { SettingsDialog } from "@/components/settings-view";
import { CustomerList } from "@/components/customer-list";
import { CatalogList } from "@/components/catalog-list";
import { SidebarNav, type View } from "@/components/sidebar-nav";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import type { HistoryFilter } from "@/components/invoice-history";
import { takeBootIntent } from "@/lib/boot-intent";

export function Shell() {
  const { t } = useI18n();
  const { isPro, setUpgradeOpen, setUpgradeContext } = useStore();
  // One-shot hand-off from onboarding: "Buat invoice pertama" lands us straight
  // in a fresh invoice editor instead of the (empty) dashboard.
  const [boot] = React.useState(takeBootIntent);
  const firstRun = boot === "new-invoice";
  const [view, setView] = React.useState<View>(firstRun ? "invoice" : "home");
  // Bumped to request a fresh invoice editor (onboarding boot + File → New ⌘N).
  const [newInvoiceToken, setNewInvoiceToken] = React.useState(firstRun ? 1 : 0);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem("invois_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [invFilter, setInvFilter] = React.useState<HistoryFilter | null>(null);
  // In native fullscreen the macOS traffic lights are hidden, so the 84px gap
  // reserved for them becomes dead space (the toggle looks indented). Drop it
  // then. (The flip lags macOS's fullscreen animation — a known limitation.)
  // Fullscreen state — the custom title bar hides itself when macOS goes
  // fullscreen. Electron pushes the change to us, so no polling on resize.
  const [fullscreen, setFullscreen] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    let un: (() => void) | undefined;
    try {
      void native.win.isFullscreen().then((v) => { if (alive) setFullscreen(v); });
      un = native.win.onFullscreen((v) => { if (alive) setFullscreen(v); });
    } catch {
      /* plain browser: no native window */
    }
    return () => { alive = false; un?.(); };
  }, []);

  // Sidebar navigation clears any active list filter.
  const navigate = React.useCallback((v: View) => {
    setInvFilter(null);
    setView(v);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("invois_sidebar_collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Native app-menu items (see electron/main.js) emit their id on "menu-action";
  // run the matching action here. Subscribing is synchronous in Electron, so the
  // StrictMode double-subscribe race the Tauri version had to guard against is gone.
  React.useEffect(() => {
    let un: (() => void) | undefined;
    try {
      un = native.menu.onAction((action) => {
        switch (action) {
          case "settings": setSettingsOpen(true); break;
          case "new_invoice": setView("invoice"); setNewInvoiceToken((n) => n + 1); break;
          case "view_home": navigate("home"); break;
          case "view_invoice": navigate("invoice"); break;
          case "view_customers": navigate("customers"); break;
          case "view_katalog": navigate("katalog"); break;
          case "toggle_sidebar": toggleSidebar(); break;
        }
      });
    } catch {
      /* plain browser: no native menu */
    }
    return () => un?.();
  }, [navigate, toggleSidebar]);

  return (
    <>
      {/* Custom title bar strip (Overlay titlebar). Reserves the top row for the
          native macOS traffic lights and holds the sidebar toggle + wordmark.
          A tinted bg (bg-sidebar, not white) keeps the inactive/idle traffic
          lights visible. Draggable to move the window. */}
      <div
        className={`drag-region fixed inset-x-0 top-0 z-40 flex h-10 items-center gap-2 bg-sidebar pr-3 transition-[padding] duration-200 ease-out max-lg:hidden ${fullscreen ? "pl-3" : "pl-[84px]"}`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          aria-label={t("nav.collapseSidebar")}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
        >
          <PanelLeft className="size-[17px]" />
        </button>
        <span
          className="drag-region pointer-events-none absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          invois<span style={{ color: "var(--primary)" }}>.</span>
        </span>

        {/* Free: passive gold CTA into the upgrade popup. Pro: a quiet status chip. */}
        {isPro ? (
          <span className="pro-emboss ml-auto inline-flex h-[24px] items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 text-[11.5px] font-semibold text-primary">
            <Crown className="size-3.5" />
            Pro
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setUpgradeContext("general");
              setUpgradeOpen(true);
            }}
            className="ml-auto inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[#f2c04e] px-3 text-[12.5px] font-medium text-[#4a3500] transition-colors hover:bg-[#eab63a]"
          >
            <Crown className="size-3.5" />
            {t("pro.cta")}
          </button>
        )}
      </div>

      <SidebarNav
        view={view}
        onNavigate={navigate}
        onOpenSettings={() => setSettingsOpen(true)}
        collapsed={collapsed}
      />
      <div
        className={
          (collapsed ? "lg:ml-[65px] " : "lg:ml-[184px] ") +
          "bg-background lg:mt-10 lg:overflow-hidden lg:rounded-tl-xl transition-[margin] duration-200 ease-out"
        }
      >
        {view === "home" && <DashboardView />}
        {view === "invoice" && (
          <InvoicesView
            filter={invFilter}
            onClearFilter={() => setInvFilter(null)}
            firstRun={firstRun}
            newInvoiceToken={newInvoiceToken}
          />
        )}
        {view === "customers" && <CustomerList />}
        {view === "katalog" && <CatalogList />}
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {/* Mounted once globally so any trigger (template gate, sidebar Pro link)
          can open it from any view. */}
      <UpgradeDialog />
    </>
  );
}
