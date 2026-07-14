import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadVersioned, saveVersioned, parseVersioned, type Migration } from "./persist";
import { getRaw, setRaw } from "./data-store";

// Minimal in-memory localStorage stand-in for the tests.
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

let mem: MemStorage;
beforeEach(() => {
  mem = new MemStorage();
  vi.stubGlobal("localStorage", mem);
});

describe("loadVersioned", () => {
  it("returns the fallback when nothing is stored", () => {
    expect(loadVersioned("k", 1, [], { a: 1 })).toEqual({ a: 1 });
  });

  it("treats legacy (envelope-less) data as version 0 and migrates it", () => {
    mem.setItem("k", JSON.stringify({ a: 1 }));
    const migrations: Migration[] = [(d) => ({ ...(d as object), b: 2 })];
    expect(loadVersioned("k", 1, migrations, {})).toEqual({ a: 1, b: 2 });
  });

  it("reads a current-version envelope without migrating", () => {
    saveVersioned("k", 2, { a: 1 });
    const migrations: Migration[] = [
      () => ({ never: true }),
      () => ({ never: true }),
    ];
    expect(loadVersioned("k", 2, migrations, {})).toEqual({ a: 1 });
  });

  it("chains migrations across multiple versions", () => {
    saveVersioned("k", 1, { step: 1 });
    const migrations: Migration[] = [
      (d) => ({ ...(d as object), step: 2 }),
      (d) => ({ ...(d as object), step: 3 }),
    ];
    expect(loadVersioned("k", 3, migrations, {})).toEqual({ step: 3 });
  });

  it("persists the upgraded envelope so a migration runs only once", () => {
    mem.setItem("k", JSON.stringify({ n: 0 }));
    let runs = 0;
    const migrations: Migration[] = [
      (d) => {
        runs += 1;
        return { ...(d as object), seeded: true };
      },
    ];
    loadVersioned("k", 1, migrations, {});
    loadVersioned("k", 1, migrations, {});
    expect(runs).toBe(1);
    expect(loadVersioned("k", 1, migrations, {})).toEqual({ n: 0, seeded: true });
  });

  it("returns data as-is when stored by a newer version", () => {
    saveVersioned("k", 5, { future: true });
    expect(loadVersioned("k", 2, [], {})).toEqual({ future: true });
  });

  it("falls back on corrupt JSON", () => {
    mem.setItem("k", "{not json");
    expect(loadVersioned("k", 1, [], { safe: true })).toEqual({ safe: true });
  });
});

describe("saveVersioned", () => {
  it("round-trips through loadVersioned", () => {
    saveVersioned("k", 3, { hello: "world" });
    expect(loadVersioned("k", 3, [], {})).toEqual({ hello: "world" });
  });
});

describe("parseVersioned (peek — parse from raw, no write-back)", () => {
  it("returns the fallback for null / corrupt input", () => {
    expect(parseVersioned(null, 1, [], { a: 1 })).toEqual({ a: 1 });
    expect(parseVersioned("{not json", 1, [], { safe: true })).toEqual({ safe: true });
  });

  it("parses a current-version envelope", () => {
    const raw = JSON.stringify({ v: 2, data: { bizName: "Studio" } });
    expect(parseVersioned(raw, 2, [], null)).toEqual({ bizName: "Studio" });
  });

  it("migrates legacy (envelope-less) and chains migrations", () => {
    const migrations: Migration[] = [
      (d) => ({ ...(d as object), step: 2 }),
      (d) => ({ ...(d as object), step: 3 }),
    ];
    expect(parseVersioned(JSON.stringify({ step: 1 }), 3, migrations, {})).toEqual({ step: 3 });
  });

  it("returns newer-version data as-is (no downgrade)", () => {
    const raw = JSON.stringify({ v: 5, data: { future: true } });
    expect(parseVersioned(raw, 2, [], {})).toEqual({ future: true });
  });

  it("does NOT write back to the store (pure peek)", () => {
    const raw = JSON.stringify({ n: 0 }); // legacy → would migrate
    const spy = vi.spyOn(mem, "setItem");
    parseVersioned(raw, 1, [(d) => ({ ...(d as object), seeded: true })], {});
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("loadVersioned is a READ — it never writes", () => {
  it("does not persist the upgraded envelope back to the store", () => {
    // It used to, "so migrations run only once". That made a read have a side
    // effect: a user opening the app with an older settings version had their
    // vault written to before touching a single control — and on a legacy vault
    // that write dragged the money migration along with it, converting a file
    // they never edited. Arif caught it with an md5 (QA 9.2).
    //
    // Reads must be reads. The migration re-runs on every load instead; it is a
    // pure function of the stored data, so that is deterministic and free.
    setRaw("k", JSON.stringify({ v: 0, data: { a: 1 } }));
    const before = getRaw("k");

    const out = loadVersioned<{ a: number; b: number }>(
      "k",
      1,
      [(d) => ({ ...(d as object), b: 2 })],
      { a: 0, b: 0 },
    );

    expect(out).toEqual({ a: 1, b: 2 }); // migrated in memory…
    expect(getRaw("k")).toBe(before); // …and nothing was written
  });

  it("re-runs the migration on every load, giving the same answer", () => {
    setRaw("k", JSON.stringify({ v: 0, data: { a: 1 } }));
    const mig = [(d: unknown) => ({ ...(d as object), b: 2 })];
    const first = loadVersioned("k", 1, mig, {});
    const second = loadVersioned("k", 1, mig, {});
    expect(second).toEqual(first);
  });
});
