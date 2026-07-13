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
import { AlertTriangle, FolderOpen } from "lucide-react";
import * as native from "@/lib/native";
import { getVaultHealth, onVaultUnsafe, getStatus } from "@/lib/data-store";

export function VaultUnsafeBanner() {
  const [health, setHealth] = React.useState(() => getVaultHealth());

  React.useEffect(() => onVaultUnsafe(() => setHealth(getVaultHealth())), []);

  if (!health.unsafe) return null;

  const dir = getStatus().vaultDir;
  const fromBackup = health.source === "backup";

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[60] flex items-start gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950"
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
