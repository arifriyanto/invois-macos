import { beforeEach, describe, expect, it, vi } from "vitest";

// No native bridge → data-store must fall back to the LOCAL (localStorage)
// backend, which is exactly what these tests exercise.
vi.mock("@/lib/native", () => ({
  isDesktop: () => false,
  fs: {},
  path: {},
}));

import {
  getRaw,
  setRaw,
  removeRaw,
  initDataStore,
  getStatus,
  flushNow,
  listVaults,
  getActiveVault,
} from "./data-store";

// Minimal in-memory localStorage stand-in.
class MemStorage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return Array.from(this.m.keys())[i] ?? null;
  }
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

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemStorage());
  // Plain browser: no `window.invois` bridge (see the mock above).
  vi.stubGlobal("window", {});
});

describe("dataStore local mode (web/dev)", () => {
  it("reports onboarded without asking for a location when not in Tauri", async () => {
    const s = await initDataStore();
    expect(s.mode).toBe("local");
    expect(s.onboarded).toBe(true);
    expect(s.vaultDir).toBeNull();
  });

  it("reads/writes/removes through localStorage", () => {
    setRaw("invois_x", "hello");
    expect(getRaw("invois_x")).toBe("hello");
    expect(localStorage.getItem("invois_x")).toBe("hello");
    removeRaw("invois_x");
    expect(getRaw("invois_x")).toBeNull();
  });

  it("returns null for missing keys", () => {
    expect(getRaw("invois_missing")).toBeNull();
  });

  it("flushNow is a no-op in local mode", async () => {
    await expect(flushNow()).resolves.toBeUndefined();
    expect(getStatus().mode).toBe("local");
  });

  it("has no registered vaults / active business in local mode", () => {
    expect(listVaults()).toEqual([]);
    expect(getActiveVault()).toBeNull();
    expect(getStatus().activeVault).toBeNull();
    expect(getStatus().vaultMissing).toBe(false);
  });
});
