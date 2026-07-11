// Versioned persistence with migrations.
//
// Data is stored as an envelope `{ v: number, data: T }`. On load, data saved
// under an older version is upgraded through the `migrations` chain
// (migrations[n] upgrades version n → n+1) and the upgraded envelope is written
// back so each migration runs at most once. Legacy data saved before versioning
// (a bare value, no envelope) is treated as version 0.
//
// This lets the data model evolve safely: to change a persisted shape, bump the
// version and append a migration — old saved data is transformed instead of
// being mis-merged or silently dropped.
//
// The actual bytes live behind the dataStore backend (localStorage or a JSON
// vault file), so this module is storage-agnostic — see lib/data-store.ts.

import { getRaw, setRaw } from "./data-store";

export type Migration = (data: unknown) => unknown;

interface Envelope {
  v: number;
  data: unknown;
}

function isEnvelope(x: unknown): x is Envelope {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as Record<string, unknown>).v === "number" &&
    "data" in (x as Record<string, unknown>)
  );
}

/**
 * Parse + migrate a raw envelope string WITHOUT touching the store (no
 * write-back). Used to peek at another vault's data (e.g. reading an existing
 * vault's business profile during onboarding) without adopting it. Returns
 * `fallback` on null/parse/migration error; never throws.
 */
export function parseVersioned<T>(
  raw: string | null,
  version: number,
  migrations: Migration[],
  fallback: T
): T {
  try {
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    let data: unknown;
    let from: number;
    if (isEnvelope(parsed)) {
      data = parsed.data;
      from = parsed.v;
    } else {
      data = parsed; // legacy, pre-versioning
      from = 0;
    }
    if (from >= version) return data as T;
    for (let v = from; v < version; v++) {
      const m = migrations[v];
      if (m) data = m(data);
    }
    return data as T;
  } catch {
    return fallback;
  }
}

/**
 * Load and migrate persisted JSON. Returns `fallback` when nothing is stored or
 * on any parse/migration error (never throws).
 */
export function loadVersioned<T>(
  key: string,
  version: number,
  migrations: Migration[],
  fallback: T
): T {
  try {
    const raw = getRaw(key);
    if (raw == null) return fallback;

    const parsed: unknown = JSON.parse(raw);
    let data: unknown;
    let from: number;
    if (isEnvelope(parsed)) {
      data = parsed.data;
      from = parsed.v;
    } else {
      data = parsed; // legacy, pre-versioning
      from = 0;
    }

    // Stored by a newer app version than we know about → use as-is (don't
    // downgrade or corrupt).
    if (from >= version) return data as T;

    for (let v = from; v < version; v++) {
      const m = migrations[v];
      if (m) data = m(data);
    }

    // Persist the upgraded envelope so migrations run only once.
    try {
      setRaw(key, JSON.stringify({ v: version, data } satisfies Envelope));
    } catch {
      /* ignore write failure */
    }

    return data as T;
  } catch {
    return fallback;
  }
}

/** Save data wrapped in a versioned envelope. Never throws. */
export function saveVersioned(key: string, version: number, data: unknown): void {
  try {
    setRaw(key, JSON.stringify({ v: version, data } satisfies Envelope));
  } catch {
    /* ignore */
  }
}
