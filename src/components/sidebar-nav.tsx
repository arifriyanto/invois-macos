"use client";
import { FileText, LayoutDashboard, List, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export type View = "home" | "invoice" | "customers" | "katalog";

type NavItem = { view: View; key: string; Icon: typeof FileText };

const ITEMS: NavItem[] = [
  { view: "home", key: "nav.home", Icon: LayoutDashboard },
  { view: "invoice", key: "nav.invoices", Icon: FileText },
  { view: "customers", key: "nav.customers", Icon: Users },
  { view: "katalog", key: "nav.katalog", Icon: List },
];

export function SidebarNav({
  view,
  onNavigate,
  onOpenSettings,
  collapsed,
}: {
  view: View;
  onNavigate: (v: View) => void;
  onOpenSettings: () => void;
  collapsed: boolean;
}) {
  const { t } = useI18n();
  const label = (text: string) => (
    <span
      className={cn(
        "flex-1 whitespace-nowrap text-left transition-opacity duration-150",
        collapsed ? "hidden" : "opacity-100"
      )}
    >
      {text}
    </span>
  );

  return (
    <aside
      className={cn(
        "fixed bottom-2 left-2 top-10 z-30 flex flex-col overflow-hidden rounded-xl border border-border/70 bg-sidebar/65 pb-2 pt-2 shadow-sm backdrop-blur-xl transition-[width] duration-200 ease-out max-lg:hidden",
        collapsed ? "w-[49px]" : "w-[168px]"
      )}
    >
      <div className="flex flex-col gap-1 px-2">
        {ITEMS.map(({ view: v, key, Icon }) => {
          const active = v === view;
          const text = t(key);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onNavigate(v)}
              title={collapsed ? text : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 overflow-hidden rounded-lg h-9 px-2 text-[13px] transition-colors",
                active
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-black/5"
              )}
            >
              <Icon className="size-[17px] shrink-0" />
              {label(text)}
            </button>
          );
        })}
      </div>

      <div className="mt-auto px-2">
        <button
          type="button"
          onClick={onOpenSettings}
          title={collapsed ? t("nav.settings") : undefined}
          className="flex w-full items-center gap-2.5 overflow-hidden rounded-lg h-9 px-2 text-[13px] text-muted-foreground transition-colors hover:bg-black/5"
        >
          <Settings className="size-[17px] shrink-0" />
          {label(t("nav.settings"))}
        </button>
      </div>
    </aside>
  );
}
