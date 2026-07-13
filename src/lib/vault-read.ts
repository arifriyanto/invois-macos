"use client";
// Reading a collection out of the vault, honestly.
//
// The old pattern, repeated in every store:
//
//   const raw = getRaw(KEY);
//   return raw ? (JSON.parse(raw) as SavedInvoice[]) : [];
//
// has two lies in it.
//
// 1. `as SavedInvoice[]` is a compile-time claim with no runtime backing. If the
//    value parses to an object, or a number, or null, TypeScript is satisfied and
//    the app hands a non-array to React — which then crashes on `.map()` and shows
//    the error boundary, with no clue as to which file is at fault.
//
// 2. A parse failure was swallowed into `[]`. That is not a fallback, it is a
//    fabrication: a vault holding 300 invoices renders exactly like a brand-new
//    empty one. The user sees "no invoices", assumes the worst — and the next save
//    writes that emptiness over the file.
//
// So: validate the shape, and when it does not hold, say so and put the vault into
// safe mode (no writes) rather than inventing data that was never there. An empty
// vault and an unreadable one must never look alike.

import { getRaw, markVaultUnsafe } from "./data-store";

/** Read an ARRAY collection. Returns [] only when the key genuinely is absent. */
export function readArray<T>(key: string, label: string): T[] {
  const raw = getRaw(key);
  if (raw == null) return []; // key absent → genuinely empty, not corrupt
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      markVaultUnsafe(`${label} (${key}) is not a list`);
      return [];
    }
    return parsed as T[];
  } catch (e) {
    markVaultUnsafe(`${label} (${key}) could not be read: ${String(e)}`);
    return [];
  }
}

/** Read an OBJECT value (the in-progress invoice draft, settings envelopes…). */
export function readObject<T>(key: string, label: string): T | null {
  const raw = getRaw(key);
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      markVaultUnsafe(`${label} (${key}) is not an object`);
      return null;
    }
    return parsed as T;
  } catch (e) {
    markVaultUnsafe(`${label} (${key}) could not be read: ${String(e)}`);
    return null;
  }
}
