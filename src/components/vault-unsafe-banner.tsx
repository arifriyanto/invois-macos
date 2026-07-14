"use client";
// Safe mode, made visible.
//
// When the vault could not be read — corrupt file, a collection with the wrong
// shape, a fallback to a backup — the data store stops writing (see markVaultUnsafe).
// That protects the file. It does NOT protect the user: someone who keeps typing,
// believing their work is being saved, is worse off than before.
//
// So the refusal is loud, permanent, and in the way. It does not auto-dismiss and
// it cannot be closed: while it is up, nothing the user does is being persisted, and
// there is no honest UI for that except saying so.
import * as React from "react";
import { useSyncExternalStore } from "react";
import { AlertTriangle, FolderOpen } from "lucide-react";
import * as native from "@/lib/native";
import { getVaultHealth, onVaultUnsafe, getVaultUnsafeVersion, getStatus } from "@/lib/data-store";

export function VaultUnsafeBanner() {
  // useSyncExternalStore, not useState + useEffect, and the difference is the
  // whole bug (QA case 10.2: the banner never appeared for a wrong-SHAPE vault).
  //
  // A corrupt FILE is discovered inside data-store, before React renders anything
  // — so a `useState(getVaultHealth)` initialiser already sees it. That is case
  // 10.3, and it worked. But a wrong SHAPE is discovered LATER: a store reads its
  // collection, `readArray("invois_history")` gets an object instead of a list,
  // and calls markVaultUnsafe during that provider's render.
  //
  // This banner sits ABOVE {children} in DataBootstrap, so it renders FIRST, reads
  // "healthy", and only then do the providers fail. Effects run after every child
  // has rendered — so by the time a useEffect subscribed, the notification had
  // already been broadcast to nobody. The flag was set, the vault refused to
  // write, and the user was told nothing at all.
  //
  // That is the worst outcome available here: the app looks like it is working
  // while quietly discarding everything you type.
  //
  // useSyncExternalStore closes the gap by design — React re-reads the snapshot
  // immediately after subscribing, so a change that lands between render and
  // subscribe cannot be missed. The version counter exists because the snapshot
  // must be a stable primitive; getVaultHealth() builds a new object every call
  // and would loop forever.
  const version = useSyncExternalStore(
    onVaultUnsafe,
    getVaultUnsafeVersion,
    getVaultUnsafeVersion // SSR: no vault, always 0
  );
  void version; // the subscription is the point; the value below is read fresh
  const health = getVaultHealth();

  if (!health.unsafe) return null;

  const dir = getStatus().vaultDir;
  const fromBackup = health.source === "backup";

  return (
    <div
      role="alert"
      // Sits ON the title bar, so two things matter. The 84px left inset clears the
      // macOS traffic lights — they are drawn natively ON TOP of web content, so
      // without it they land in the middle of the sentence. And `drag-region` keeps
      // the window movable while the banner covers the strip you would normally
      // drag (the button inside opts out via the CSS rule in globals.css).
      className="drag-region fixed inset-x-0 top-0 z-[60] flex items-start gap-3 border-b border-amber-300 bg-amber-50 py-3 pl-[92px] pr-4 text-amber-950"
    >
      <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">
          {fromBackup
            ? "Data file could not be read. Showing a backup."
            : "Data file could not be read."}
        </div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-amber-900">
          Nothing you change is being saved right now, on purpose: writing would overwrite the
          file we could not read. Your original file has not been deleted.
          <span className="ml-1 opacity-70">({health.reason})</span>
        </div>
      </div>
      {dir && (
        <button
          type="button"
          onClick={() => void native.opener.openPath(dir).catch(() => {})}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-white/70 px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-white"
        >
          <FolderOpen className="size-3.5" />
          Open folder
        </button>
      )}
    </div>
  );
}
