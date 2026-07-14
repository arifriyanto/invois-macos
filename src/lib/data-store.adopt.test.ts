import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the native bridge (electron/preload → src/lib/native).
// `files` maps an absolute path → its text contents and lives for the whole run;
// we clear it per test. vi.hoisted lets the (hoisted) vi.mock factory reference
// it safely.
const { files } = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock("@/lib/native", () => ({
  // Pretend we're inside the desktop app, so data-store takes the FILE backend.
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
    // Immediate subdirectory names, derived from the flat path map.
    readDirs: async (p: string) => {
      const prefix = p.replace(/\/+$/, "") + "/";
      const names = new Set<string>();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const slash = rest.indexOf("/");
        if (slash > 0) names.add(rest.slice(0, slash));
      }
      return [...names];
    },
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

// Minimal localStorage (data-store keeps the vault POINTER here).
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

beforeEach(() => {
  files.clear();
  vi.stubGlobal("localStorage", new MemStorage());
  vi.resetModules(); // fresh module state (mode/mem/config/initialized) per test
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Build a raw vault-file body from a plain key→value record.
function vaultBody(entries: Record<string, string>): string {
  return JSON.stringify(entries);
}

describe("completeOnboarding — adopt vs fresh (reinstall data-loss guard)", () => {
  it("creates a fresh EMPTY vault for a brand-new folder", async () => {
    const ds = await import("./data-store");
    const res = await ds.completeOnboarding("/vault/new");

    expect(res.adopted).toBe(false);
    expect(files.has(`/vault/new/${VAULT}`)).toBe(true); // file written
    // Empty of DATA — the file still declares its format, so an older build meeting
    // it refuses rather than guessing (see VAULT_FORMAT in data-store.ts).
    const doc = JSON.parse(files.get(`/vault/new/${VAULT}`)!) as Record<string, unknown>;
    expect(Object.keys(doc)).toEqual(["__invois"]);
    expect(ds.getRaw("invois_settings")).toBeNull(); // nothing loaded
  });

  it("ADOPTS an existing vault: loads its data and does NOT overwrite it", async () => {
    const path = `/vault/old/${VAULT}`;
    const original = vaultBody({
      invois_settings: JSON.stringify({ v: 5, data: { bizName: "Studio Arunika" } }),
      invois_invoice: '{"number":"INV-001"}',
    });
    files.set(path, original);

    const ds = await import("./data-store");
    const res = await ds.completeOnboarding("/vault/old");

    expect(res.adopted).toBe(true); // adopted, not fresh
    expect(files.get(path)).toBe(original); // file left byte-for-byte intact
    expect(ds.getRaw("invois_invoice")).toBe('{"number":"INV-001"}'); // real data loaded
  });

  it("adopts (recovers) a vault reachable only via a backup — primary missing", async () => {
    // Primary gone, newest backup survives — data must still be recovered.
    files.set(`/vault/bak/${VAULT}.bak1`, vaultBody({ invois_x: "from-backup" }));

    const ds = await import("./data-store");
    const res = await ds.completeOnboarding("/vault/bak");

    expect(res.adopted).toBe(true); // anyVaultFileExists → adopt, not fresh
    expect(ds.getRaw("invois_x")).toBe("from-backup"); // loaded from the backup
    // Adopt path doesn't rewrite the primary; it stays absent until the next save.
    expect(files.has(`/vault/bak/${VAULT}`)).toBe(false);
  });
});

describe("readVaultKey — read-only peek (used to prefill onboarding)", () => {
  it("returns a stored key from an existing vault without switching to it", async () => {
    const path = `/vault/peek/${VAULT}`;
    files.set(path, vaultBody({ invois_settings: '{"v":5,"data":{"bizName":"Peek Co"}}' }));

    const ds = await import("./data-store");
    const raw = await ds.readVaultKey("/vault/peek", "invois_settings");

    expect(raw).toBe('{"v":5,"data":{"bizName":"Peek Co"}}');
    // Peeking must NOT adopt/switch: still in local mode, no active vault.
    expect(ds.getStatus().mode).toBe("local");
    expect(ds.getActiveVault()).toBeNull();
  });

  it("returns null for a folder with no vault, or a missing key", async () => {
    files.set(`/vault/has/${VAULT}`, vaultBody({ invois_settings: "{}" }));
    const ds = await import("./data-store");

    expect(await ds.readVaultKey("/vault/empty", "invois_settings")).toBeNull();
    expect(await ds.readVaultKey("/vault/has", "invois_missing")).toBeNull();
  });
});

describe("completeOnboarding — reject a folder inside a vault (on disk)", () => {
  it("throws folder-nested when the parent folder holds a vault", async () => {
    files.set(`/data/main/${VAULT}`, vaultBody({ invois_x: "1" }));
    const ds = await import("./data-store");

    // Picking the vault's own Backups/ (parent /data/main has a vault) is refused.
    await expect(ds.completeOnboarding("/data/main/Backups")).rejects.toThrow("folder-nested");
    // Picking the vault root itself is fine (adopt).
    await expect(ds.completeOnboarding("/data/main")).resolves.toEqual({ adopted: true });
  });

  it("allows a fresh folder that isn't inside any vault", async () => {
    const ds = await import("./data-store");
    await expect(ds.completeOnboarding("/data/fresh")).resolves.toEqual({ adopted: false });
  });

  it("refuses a folder that CONTAINS vaults", async () => {
    // Found by Arif, 14 Jul 2026, running phase 8.3 of the QA plan.
    //
    // Nesting is bad in both directions, and we had only ever guarded one. addVault
    // caught the containing case via the registry; onboarding has no registry, so
    // picking ~/Desktop/qa — the folder holding v-baru and v-adopsi — was accepted,
    // and a third vault was created on top of the other two.
    files.set(`/qa/v-baru/${VAULT}`, vaultBody({ invois_x: "1" }));
    files.set(`/qa/v-adopsi/${VAULT}`, vaultBody({ invois_x: "2" }));

    const ds = await import("./data-store");
    await expect(ds.completeOnboarding("/qa")).rejects.toThrow("folder-nested");

    // …and picking one of the vaults themselves still works.
    await expect(ds.completeOnboarding("/qa/v-adopsi")).resolves.toEqual({ adopted: true });
  });
});

describe("isDirInsideVault", () => {
  it("is true only for a subfolder of a vault", async () => {
    files.set(`/v/biz/${VAULT}`, vaultBody({ a: "1" }));
    const ds = await import("./data-store");
    expect(await ds.isDirInsideVault("/v/biz/Backups")).toBe(true); // inside a vault
    expect(await ds.isDirInsideVault("/v/biz")).toBe(false); // it IS the vault
    expect(await ds.isDirInsideVault("/v/other")).toBe(false); // unrelated folder
  });

  it("walks every ancestor, not just the immediate parent", async () => {
    files.set(`/v/biz/${VAULT}`, vaultBody({ a: "1" }));
    const ds = await import("./data-store");
    // Backups/ is nested; so is anything below it. Checking only the parent
    // would call this one clean.
    expect(await ds.isDirInsideVault("/v/biz/Backups/2026/deep")).toBe(true);
  });
});

describe("addVault — reject a folder inside an existing vault", () => {
  it("throws folder-nested for a subfolder (e.g. Backups/) of a vault", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/vault/main"); // registers /vault/main

    await expect(ds.addVault("/vault/main/Backups")).rejects.toThrow("folder-nested");
    await expect(ds.addVault("/vault/main/Exports/x")).rejects.toThrow("folder-nested");
    // A folder that would CONTAIN the vault is rejected too.
    await expect(ds.addVault("/vault")).rejects.toThrow("folder-nested");
    // A truly separate folder is fine.
    await expect(ds.addVault("/other/place")).resolves.toBeTruthy();
  });

  it("rejects a folder inside a vault that is NOT in the registry", async () => {
    // The bug, found by Arif running the QA plan (13 Jul 2026).
    //
    // A vault exists at /qa/v-baru, but the user has since onboarded to a
    // different folder, so v-baru is not in config.vaults. addVault checked only
    // the registry — so /qa/v-baru/Backups looked like a clean, unrelated folder,
    // passed every guard, and (since no vault file existed *in* Backups) the code
    // WROTE a fresh empty vault into another vault's backup directory.
    //
    // The registry is a list of what we happen to know about. The disk is what is
    // true. This must ask the disk.
    files.set(`/qa/v-baru/${VAULT}`, vaultBody({ invois_history: "[]" }));

    const ds = await import("./data-store");
    await ds.completeOnboarding("/qa/v-adopsi"); // registry holds ONLY v-adopsi

    await expect(ds.addVault("/qa/v-baru/Backups")).rejects.toThrow("folder-nested");
    // …and nothing was written into the backup folder on the way out.
    expect(files.has(`/qa/v-baru/Backups/${VAULT}`)).toBe(false);

    // The unregistered vault itself is still addable — it is a vault, not a nest.
    await expect(ds.addVault("/qa/v-baru")).resolves.toBeTruthy();
  });
});

describe("dated daily backup", () => {
  const backupsOf = (dir: string) =>
    [...files.keys()].filter((k) => k.startsWith(`${dir}/Backups/invois-`) && k.endsWith(".json"));

  it("snapshots the vault into Backups/ on save", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/vault/db"); // writes the (empty) primary
    ds.setRaw("invois_x", "hello");
    await ds.flushNow(); // triggers writeVaultFile → daily backup

    expect(backupsOf("/vault/db").length).toBe(1);
  });

  it("writes only one dated backup per day", async () => {
    const ds = await import("./data-store");
    await ds.completeOnboarding("/vault/db2");
    ds.setRaw("a", "1");
    await ds.flushNow();
    ds.setRaw("b", "2");
    await ds.flushNow(); // same day → must NOT add a second dated file

    expect(backupsOf("/vault/db2").length).toBe(1);
  });
});
