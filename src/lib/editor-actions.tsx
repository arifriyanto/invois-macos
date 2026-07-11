"use client";
import * as React from "react";

/** Actions + state the invoice editor exposes to its toolbar. */
export interface EditorActions {
  onBack: () => void;
  /** Start a fresh new invoice (caller guards the dirty state). */
  onNew: () => void;
  /** Commit the current invoice to history (assign/keep number). Stays in the
   * editor. `silent` skips the post-save toast (used by save-then-export). */
  onCommit: (silent?: boolean) => void;
  /** True once the invoice exists in history (has been saved at least once). */
  saved: boolean;
  /** True when there are unsaved changes (also true for a brand-new invoice). */
  dirty: boolean;
  /** True when saved AND clean — the only state where export is allowed. */
  canExport: boolean;
  /** Paid status of the saved invoice (false for a new/unsaved one). */
  paid: boolean;
  /** ISO "YYYY-MM-DD" the invoice was paid, when paid. */
  paidAt?: string;
  /** Set paid status (+ optional paid date) on the saved record. No-op if unsaved. */
  setPaid: (paid: boolean, at?: string) => void;
  /** Bumps on every successful commit — drives the post-save export nudge. */
  saveToken: number;
  /** First-invoice walkthrough is active — show the pulsing field beacons.
   * Turns off for good after the first successful save. */
  coach: boolean;
}

const Ctx = React.createContext<EditorActions | null>(null);

export function EditorActionsProvider({
  value,
  children,
}: {
  value: EditorActions;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Null when the editor is rendered outside a history flow. */
export function useEditorActions(): EditorActions | null {
  return React.useContext(Ctx);
}
