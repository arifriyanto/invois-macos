"use client";
import * as native from "@/lib/native";
// Path display helpers. The OS home directory is resolved once at startup and
// cached so `prettyPath` can run synchronously during render, abbreviating the
// home prefix to "~" (e.g. /Users/arif/Downloads → ~/Downloads).

let homeDir = ""; // "" until resolved / on the web build

/** Resolve and cache the OS home dir. Safe to call repeatedly; no-op on web. */
export async function initHomeDir(): Promise<void> {
  if (homeDir) return;
  try {
    const { homeDir: hd } = native.path;
    homeDir = (await hd()).replace(/\/+$/, "");
  } catch {
    /* web/dev: no Tauri path API — leave paths unabbreviated */
  }
}

/** Abbreviate the home prefix to "~". Returns "" for empty input. */
export function prettyPath(p: string | null | undefined): string {
  if (!p) return "";
  const clean = p.replace(/\/+$/, "");
  if (homeDir && (clean === homeDir || clean.startsWith(homeDir + "/"))) {
    return "~" + clean.slice(homeDir.length);
  }
  return clean;
}
