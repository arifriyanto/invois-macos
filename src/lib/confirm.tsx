"use client";
import * as React from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/**
 * In-app confirmation dialog, used instead of window.confirm().
 *
 * It started as a workaround (window.confirm was unreliable in the Tauri
 * WKWebView). Chromium's confirm() works, but we keep this on purpose: a native
 * modal blocks the whole process and looks nothing like the app. Usage:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Hapus?", destructive: true })) remove(id);
 */
type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const resolver = React.useRef<((v: boolean) => void) | null>(null);

  const confirm = React.useCallback<ConfirmFn>((next) => {
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = React.useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={opts !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
        {opts && (
          <DialogContent showCloseButton={false} className="lg:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>{opts.title}</DialogTitle>
              {opts.description && <DialogDescription>{opts.description}</DialogDescription>}
            </DialogHeader>
            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => settle(false)}>
                {opts.cancelText ?? t("f.cancel")}
              </Button>
              <Button
                variant={opts.destructive ? "destructive" : "default"}
                size="sm"
                autoFocus
                onClick={() => settle(true)}
              >
                {opts.confirmText ?? t("act.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}
