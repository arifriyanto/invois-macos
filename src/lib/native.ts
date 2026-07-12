"use client";
// The renderer's view of the native layer — this is what replaces every
// `@tauri-apps/*` import.
//
// The method names deliberately MIRROR the Tauri plugin APIs (exists, mkdir,
// readTextFile, downloadDir, openPath…) so the call sites stay untouched: a
// `const fs = await import("@tauri-apps/plugin-fs")` simply becomes
// `const fs = native.fs`.
//
// Everything routes through `window.invois`, injected by electron/preload.js.
// In a plain browser (e.g. `next dev` without Electron) that object is absent,
// so `need()` throws — which is exactly what the old dynamic imports did, and
// the existing try/catch fallbacks keep working unchanged.

type Unsub = () => void;

interface Bridge {
  isDesktop: true;
  isPackaged: boolean;
  fs: {
    exists(p: string): Promise<boolean>;
    readText(p: string): Promise<string>;
    writeText(p: string, data: string): Promise<void>;
    writeBinary(p: string, data: Uint8Array): Promise<void>;
    mkdir(p: string): Promise<void>;
    remove(p: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
  };
  dialog: { pickDirectory(defaultPath?: string): Promise<string | null> };
  path: {
    downloads(): Promise<string>;
    documents(): Promise<string>;
    home(): Promise<string>;
  };
  shell: { openPath(p: string): Promise<string> };
  pdf: { toFile(outPath: string, title?: string): Promise<string> };
  window: {
    isFullscreen(): Promise<boolean>;
    onFullscreen(cb: (v: boolean) => void): Unsub;
  };
  menu: { onAction(cb: (action: string) => void): Unsub };
}

declare global {
  interface Window {
    invois?: Bridge;
  }
}

function need(): Bridge {
  const b = typeof window !== "undefined" ? window.invois : undefined;
  if (!b) throw new Error("native bridge unavailable (not running inside Electron)");
  return b;
}

/** True inside the desktop app; false in a plain browser. Replaces `inTauri()`. */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && Boolean(window.invois?.isDesktop);
}

/** True inside a PACKAGED .app — sourced from Electron's `app.isPackaged`, i.e. the
 *  OS, not a build-time constant. Used to lock the dev-only tools shut. */
export function isPackaged(): boolean {
  return typeof window !== "undefined" && Boolean(window.invois?.isPackaged);
}

/** Drop-in for `@tauri-apps/plugin-fs`. Options args are accepted and ignored. */
export const fs = {
  exists: (p: string) => need().fs.exists(p),
  readTextFile: (p: string) => need().fs.readText(p),
  writeTextFile: (p: string, data: string) => need().fs.writeText(p, data),
  writeFile: (p: string, data: Uint8Array) => need().fs.writeBinary(p, data),
  // `recursive` is accepted for call-site compatibility; main.js always recurses.
  mkdir: (p: string, _opts?: { recursive?: boolean }) => {
    void _opts;
    return need().fs.mkdir(p);
  },
  remove: (p: string) => need().fs.remove(p),
  rename: (from: string, to: string) => need().fs.rename(from, to),
};

/** Drop-in for `@tauri-apps/plugin-dialog`. We only ever pick folders.
 *  Under the App Store sandbox this also mints the security-scoped bookmark. */
export const dialog = {
  // `directory` / `multiple` are accepted for call-site compatibility (we only
  // ever pick a single folder). `defaultPath` decides where the panel opens —
  // pass it, or macOS defaults to Downloads.
  open: (opts?: { directory?: boolean; multiple?: boolean; defaultPath?: string }) =>
    need().dialog.pickDirectory(opts?.defaultPath),
};

/** Drop-in for `@tauri-apps/api/path`. */
export const path = {
  downloadDir: () => need().path.downloads(),
  documentDir: () => need().path.documents(),
  homeDir: () => need().path.home(),
};

/** Drop-in for `@tauri-apps/plugin-opener`. */
export const opener = {
  openPath: (p: string) => need().shell.openPath(p),
};

/** Replaces the Rust `render_pdf_slice` command + pdf-lib page stitching.
 *  Chromium prints the current document (our @media print rules leave only the
 *  invoice) straight to an A4-paginated PDF. `title` lands in the PDF metadata,
 *  which the main process stamps as ours (Chromium would otherwise sign the file
 *  "Skia/PDF"). */
export const pdf = {
  toFile: (outPath: string, title?: string) => need().pdf.toFile(outPath, title),
};

/** Replaces `@tauri-apps/api/window`. */
export const win = {
  isFullscreen: () => need().window.isFullscreen(),
  onFullscreen: (cb: (v: boolean) => void) => need().window.onFullscreen(cb),
};

/** Replaces the `menu-action` event from `@tauri-apps/api/event`. */
export const menu = {
  onAction: (cb: (action: string) => void) => need().menu.onAction(cb),
};
