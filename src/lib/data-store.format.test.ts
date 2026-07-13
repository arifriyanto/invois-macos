import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the native bridge (same shape as data-store.adopt.test.ts).
const { files } = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock("@/lib/native", () => ({
  isDesktop: () => true,
  fs: {
    exists: async (p: string) => files.has(p),
    readTextFile: async (p: string) => {
      const v = files.get(p);
      if (v === undefined) throw new Error(`ENOENT: ${p}`);
      return v;
    },
    writeTextFile: async (p: string, c: string) => {
      files.set(p, c);
    },
    mkdir: async () => {},
    rename: async (from: string, to: string) => {
      const v = files.get(from);
      if (v !== undefined) {
        files.set(to, v);
        files.delete(from);
      }
    },
    remove: async (p: string) => {
      files.delete(p);
    },
  },
  path: {
    documentDir: async () => "/Users/test/Documents",
    downloadDir: async () => "/Users/test/Downloads",
    homeDir: async () => "/Users/test",
  },
}));

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}

const VAULT = "invois-data.json";
const HISTORY = [{ id: "inv1", number: "INV-2026-001" }];

beforeEach(() => {
  files.clear();
  vi.stubGlobal("localStorage", new MemStorage());
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe("vault file format — nested, not double-encoded", () => {
  it("writes values as nested JSON, not as escaped strings", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/new");
    ds.setRaw("invois_history", JSON.stringify(HISTORY));
    await ds.flushNow();

    const text = files.get(`/v/new/${VAULT}`)!;
    // The old format stored a STRING here, so the file was full of \" escapes.
    expect(text).not.toContain('\\"');
    const doc = JSON.parse(text) as Record<string, unknown>;
    expect(Array.isArray(doc.invois_history)).toBe(true);
    expect(doc.invois_history).toEqual(HISTORY);
  });

  it("still reads a LEGACY double-encoded vault (values are JSON strings)", async () => {
    files.set(
      `/v/old/${VAULT}`,
      JSON.stringify({ invois_history: JSON.stringify(HISTORY) }), // old shape
    );
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/old");

    // getRaw still hands back a string, so every store keeps working unchanged.
    expect(JSON.parse(ds.getRaw("invois_history")!)).toEqual(HISTORY);
  });

  it("upgrades a legacy vault to the nested form on the next save", async () => {
    files.set(`/v/up/${VAULT}`, JSON.stringify({ invois_history: JSON.stringify(HISTORY) }));
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/up");

    ds.setRaw("invois_catalog", JSON.stringify([{ id: "k1" }]));
    await ds.flushNow();

    const doc = JSON.parse(files.get(`/v/up/${VAULT}`)!) as Record<string, unknown>;
    expect(Array.isArray(doc.invois_history)).toBe(true); // migrated in place
    expect(Array.isArray(doc.invois_catalog)).toBe(true);
  });
});

describe("the primary file must never stop existing", () => {
  it("keeps the vault on disk while rotating backups (it used to move it away)", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/atomic");
    ds.setRaw("invois_history", JSON.stringify(HISTORY));
    await ds.flushNow();

    // Second save: rotation runs. The old code did `rename(primary → .bak1)` and
    // only THEN put the new file in place, so for a moment there was no vault at
    // all — and a quit/crash/dev-reload in that window took the only copy with it.
    // (That is exactly what happened on 13 Jul 2026: bak1 and bak3 survived, the
    // vault did not.) Rotation now copies, so the primary is never moved.
    ds.setRaw("invois_history", JSON.stringify([...HISTORY, { id: "inv2" }]));
    await ds.flushNow();

    expect(files.has(`/v/atomic/${VAULT}`)).toBe(true);
    expect(files.has(`/v/atomic/${VAULT}.bak1`)).toBe(true);
    const doc = JSON.parse(files.get(`/v/atomic/${VAULT}`)!) as { invois_history: unknown[] };
    expect(doc.invois_history).toHaveLength(2); // newest data landed
    const bak = JSON.parse(files.get(`/v/atomic/${VAULT}.bak1`)!) as { invois_history: unknown[] };
    expect(bak.invois_history).toHaveLength(1); // previous state preserved
  });

  it("stamps the file with its format, and refuses a file from a newer build", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/fmt");
    ds.setRaw("invois_history", JSON.stringify(HISTORY));
    await ds.flushNow();
    const doc = JSON.parse(files.get(`/v/fmt/${VAULT}`)!) as Record<string, { format: number }>;
    expect(doc.__invois.format).toBe(2);
  });

  it("goes into safe mode instead of mangling a vault from the future", async () => {
    // A newer Invois wrote this. An older reader that just guesses would drop the
    // fields it does not know — and then save the loss. Refuse instead.
    files.set(
      `/v/future/${VAULT}`,
      JSON.stringify({ __invois: { format: 99 }, invois_history: HISTORY, brandNewField: 1 }),
    );
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/future");

    expect(ds.getVaultHealth().unsafe).toBe(true);
    ds.setRaw("invois_history", JSON.stringify([]));
    await ds.flushNow();
    const doc = JSON.parse(files.get(`/v/future/${VAULT}`)!) as Record<string, unknown>;
    expect(doc.brandNewField).toBe(1); // untouched — we never wrote
  });
});

describe("dirty check — the vault is not rewritten for nothing", () => {
  it("does not touch the file when nothing changed", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/dc");
    ds.setRaw("invois_history", JSON.stringify(HISTORY));
    await ds.flushNow();

    const before = files.get(`/v/dc/${VAULT}`);
    files.delete(`/v/dc/${VAULT}.bak1`); // clear the rotation from the first save

    // This is what `visibilitychange` does on every window hide. It used to rewrite
    // the whole vault and rotate the backups — so BACKUP_COUNT=3 really meant
    // "three hide/show cycles", and a user could lose data without typing a thing.
    await ds.flushNow();
    await ds.flushNow();
    await ds.flushNow();

    expect(files.get(`/v/dc/${VAULT}`)).toBe(before);
    expect(files.has(`/v/dc/${VAULT}.bak1`)).toBe(false); // no rotation happened
  });

  it("writes again once something actually changes", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/dc2");
    ds.setRaw("invois_history", JSON.stringify(HISTORY));
    await ds.flushNow();

    ds.setRaw("invois_history", JSON.stringify([...HISTORY, { id: "inv2" }]));
    await ds.flushNow();

    const doc = JSON.parse(files.get(`/v/dc2/${VAULT}`)!) as { invois_history: unknown[] };
    expect(doc.invois_history).toHaveLength(2);
  });

  it("ignores a set that writes the same value back", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/dc3");
    ds.setRaw("invois_history", JSON.stringify(HISTORY));
    await ds.flushNow();
    const before = files.get(`/v/dc3/${VAULT}`);
    files.delete(`/v/dc3/${VAULT}.bak1`);

    ds.setRaw("invois_history", JSON.stringify(HISTORY)); // identical
    await ds.flushNow();

    expect(files.has(`/v/dc3/${VAULT}.bak1`)).toBe(false);
    expect(files.get(`/v/dc3/${VAULT}`)).toBe(before);
  });
});

describe("safe mode — never overwrite a vault we could not read", () => {
  it("falls back to a backup, goes unsafe, and refuses to write", async () => {
    files.set(`/v/bad/${VAULT}`, "{ this is not json"); // hand-edited, broken
    files.set(`/v/bad/${VAULT}.bak1`, JSON.stringify({ invois_history: HISTORY }));

    const ds = await import("./data-store");
    await ds.completeOnboarding("/v/bad");

    const health = ds.getVaultHealth();
    expect(health.unsafe).toBe(true);
    expect(health.source).toBe("backup");

    // The user keeps typing. Nothing must reach the disk — the broken file is the
    // only copy of whatever they were trying to do, and it stays untouched.
    ds.setRaw("invois_history", JSON.stringify([]));
    await ds.flushNow();

    expect(files.get(`/v/bad/${VAULT}`)).toBe("{ this is not json");
  });

  it("a collection with the wrong SHAPE puts the vault into safe mode", async () => {
    // Valid JSON, invalid shape: history is an object, not a list. The old code
    // swallowed this into [] — a vault of 300 invoices rendered as a new empty one.
    files.set(`/v/shape/${VAULT}`, JSON.stringify({ invois_history: { oops: true } }));

    const ds = await import("./data-store");
    const { readArray } = await import("./vault-read");
    await ds.completeOnboarding("/v/shape");

    expect(ds.getVaultHealth().unsafe).toBe(false); // the FILE parsed fine
    expect(readArray("invois_history", "Invoice history")).toEqual([]);
    expect(ds.getVaultHealth().unsafe).toBe(true); // …but the shape did not

    ds.setRaw("invois_history", JSON.stringify([]));
    await ds.flushNow();
    const doc = JSON.parse(files.get(`/v/shape/${VAULT}`)!) as Record<string, unknown>;
    expect(doc.invois_history).toEqual({ oops: true }); // untouched
  });

  it("an absent key is genuinely empty, not corrupt", async () => {
    const ds = await import("./data-store");
    const { readArray } = await import("./vault-read");
    await ds.completeOnboarding("/v/fresh");

    expect(readArray("invois_history", "Invoice history")).toEqual([]);
    expect(ds.getVaultHealth().unsafe).toBe(false); // a new vault is not a broken one
  });
});
