"use client";
import * as native from "@/lib/native";
// ---------------------------------------------------------------------------
// Central persistence backend.
//
// Everything the app persists goes through a tiny key→string interface
// (getRaw / setRaw / removeRaw). This keeps the rest of the codebase
// storage-agnostic and makes swapping the underlying store a one-file change.
//
// Two backends today:
//   • "local" — browser localStorage. Used on the web/dev build, and on the
//     desktop build before the user has picked a data location (onboarding).
//   • "file"  — a single JSON "vault" file inside a user-chosen folder
//     (desktop / Tauri). The vault is loaded into memory once at startup so
//     reads stay synchronous; writes are debounced and written atomically
//     (temp file + rename) with a few rolling backups.
//
// The key→string shape is deliberately the same one a SQLite `kv(key, value)`
// table would expose, so a future SQLite backend is a drop-in: only this file
// changes, none of the stores.
//
// The pointer to the vault (which folder it lives in) is kept in localStorage
// — it must live OUTSIDE the vault (chicken-and-egg) and only needs to survive
// on this one machine.
// ---------------------------------------------------------------------------

const CONFIG_KEY = "invois_vault_config"; // pointer to the vault (stays local)
const EXPORT_RELOCATE_KEY = "invois_exportdir_relocate"; // hint across a recovery reload
const VAULT_FILE = "invois-data.json";
const BACKUP_COUNT = 3; // rolling .bak1..bak3 (per-save, fine-grained)
const FLUSH_DELAY = 500; // ms debounce for file writes
const DAILY_BACKUP_DIR = "Backups"; // dated daily snapshots live in <vault>/Backups/
const DAILY_BACKUP_KEEP = 14; // keep this many days of dated backups

export type StorageMode = "local" | "file";

/** One registered data location = one business/brand (its own settings,
 *  branding, numbering, clients, catalog all live inside its vault file). */
export interface VaultEntry {
  id: string;
  name: string;
  dir: string; // absolute folder path that holds VAULT_FILE
}

interface VaultConfig {
  vaults: VaultEntry[];
  activeId: string;
  onboarded: boolean;
}

// Older single-vault config shape (pre multi-business), migrated on read.
interface LegacyVaultConfig {
  vaultDir: string;
  onboarded: boolean;
}

export interface DataStoreStatus {
  mode: StorageMode;
  /** True once the app knows where to store data (or doesn't need to ask —
   *  i.e. the web build). False only on desktop before the user has chosen. */
  onboarded: boolean;
  /** Absolute folder holding the ACTIVE vault file, or null in local mode. */
  vaultDir: string | null;
  /** The active business/vault, or null in local mode. */
  activeVault: VaultEntry | null;
  /** True when the active vault's folder/file can't be found on disk (e.g. the
   *  user moved or deleted it). The UI should offer to locate it rather than
   *  showing an empty app (which would overwrite the pointer with empty data). */
  vaultMissing: boolean;
}

// ---- module state ---------------------------------------------------------

let mode: StorageMode = "local";
let onboarded = false;
let vaultDir: string | null = null; // active vault's folder (mirror of config)
let config: VaultConfig | null = null; // desktop only
let vaultMissing = false; // active vault's files not found on disk
let mem = new Map<string, string>(); // in-memory cache for the file backend
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
let hooksInstalled = false;
let missingListeners: Array<() => void> = [];

function inTauri(): boolean {
  return native.isDesktop();
}

function status(): DataStoreStatus {
  return { mode, onboarded, vaultDir, activeVault: getActiveVault(), vaultMissing };
}

function genVaultId(): string {
  return `vault-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Last path segment of a folder, used as a default business name. */
function basename(dir: string): string {
  return dir.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? "Invois";
}

// ---- config pointer (localStorage) ----------------------------------------

function readConfig(): VaultConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VaultConfig> & Partial<LegacyVaultConfig>;
    // Migrate the old single-vault shape { vaultDir, onboarded }.
    if (!parsed.vaults && parsed.vaultDir) {
      const id = genVaultId();
      return {
        vaults: [{ id, name: basename(parsed.vaultDir), dir: parsed.vaultDir }],
        activeId: id,
        onboarded: parsed.onboarded ?? true,
      };
    }
    if (parsed.vaults && parsed.vaults.length) {
      return {
        vaults: parsed.vaults,
        activeId: parsed.activeId ?? parsed.vaults[0].id,
        onboarded: parsed.onboarded ?? true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeConfig(cfg: VaultConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

/** Does a vault file already exist in `dir`? Used to adopt vs create. */
async function vaultExistsIn(dir: string): Promise<boolean> {
  try {
    const fs = native.fs;
    return await fs.exists(vaultPath(dir));
  } catch {
    return false;
  }
}

/** True if the vault file OR any of its backups exist in `dir`. Used at startup
 *  to tell "empty vault" (still on disk) from "vault gone" (folder moved). */
async function anyVaultFileExists(dir: string): Promise<boolean> {
  try {
    const fs = native.fs;
    const path = vaultPath(dir);
    if (await fs.exists(path)) return true;
    for (let i = 1; i <= BACKUP_COUNT; i++) {
      if (await fs.exists(backupName(path, i))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Like !anyVaultFileExists, but a transient fs error is treated as "present"
 *  (return false) so a hiccup never falsely triggers recovery mid-session. */
async function vaultFolderGone(dir: string): Promise<boolean> {
  try {
    const fs = native.fs;
    const path = vaultPath(dir);
    if (await fs.exists(path)) return false;
    for (let i = 1; i <= BACKUP_COUNT; i++) {
      if (await fs.exists(backupName(path, i))) return false;
    }
    return true; // nothing found → the folder really is gone
  } catch {
    return false; // error → assume still there; don't disrupt with recovery
  }
}

// ---- file helpers (Tauri fs) ----------------------------------------------

function vaultPath(dir: string): string {
  return `${dir.replace(/\/+$/, "")}/${VAULT_FILE}`;
}
function backupName(path: string, i: number): string {
  return `${path}.bak${i}`;
}

/**
 * The vault file is a plain, NESTED JSON document:
 *
 *   { "invois_history": [ { "id": "inv_9f2", … } ], "invois_settings": { … } }
 *
 * It used to be double-encoded — a Record<string, string> whose values were JSON
 * *strings*, so the file was a wall of escaped quotes:
 *
 *   { "invois_history": "[{\"id\":\"inv_9f2\", …}]" }
 *
 * That was not merely ugly. It DEFEATED the backup machinery. A corrupt invoice
 * lives inside the string, so the OUTER JSON still parses — loadVaultFile declares
 * the file healthy, never falls back to a backup, and the failure resurfaces one
 * layer down as an empty array. A vault of 300 invoices then looks like a brand-new
 * empty one, and the next save writes that emptiness to disk. The format turned a
 * loud failure into a silent one.
 *
 * Nested values restore JSON's best property: it fails LOUDLY. A broken invoice now
 * breaks the whole-file parse, which is exactly what we want — that is what wakes
 * the backups up.
 *
 * The in-memory API stays string→string (getRaw/setRaw are untouched), so the
 * conversion lives here, at the disk boundary, and nowhere else.
 */
type VaultDoc = Record<string, unknown>;

/** Disk → memory. Accepts BOTH formats: a string value is the legacy double-encoded
 *  form and is taken as-is; anything else is re-serialized for the in-memory map. */
function docToMem(doc: VaultDoc): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(doc)) {
    m.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  return m;
}

/** Memory → disk. Always writes the new nested form. A value that somehow is not
 *  valid JSON is stored as a string rather than dropped. */
function memToDoc(m: Map<string, string>): VaultDoc {
  const doc: VaultDoc = {};
  for (const [k, v] of m) {
    try {
      doc[k] = JSON.parse(v);
    } catch {
      doc[k] = v;
    }
  }
  return doc;
}

/** Where the loaded data came from — the UI needs this to be honest with the user. */
export type VaultSource = "primary" | "backup" | "empty";

let vaultSource: VaultSource = "primary";
/** Which backup we fell back to (1..BACKUP_COUNT), if any. */
let vaultBackupIndex = 0;

async function loadVaultFile(dir: string): Promise<Map<string, string>> {
  const fs = native.fs;
  const path = vaultPath(dir);
  const parse = (text: string) => docToMem(JSON.parse(text) as VaultDoc);

  vaultSource = "primary";
  vaultBackupIndex = 0;

  try {
    if (await fs.exists(path)) return parse(await fs.readTextFile(path));
  } catch {
    /* fall through to backups */
  }
  // Primary missing or corrupt → try the newest surviving backup.
  for (let i = 1; i <= BACKUP_COUNT; i++) {
    try {
      const bpath = backupName(path, i);
      if (await fs.exists(bpath)) {
        const data = parse(await fs.readTextFile(bpath));
        // We are NOT looking at what the user last saved. Say so, and stop writing
        // until they decide — see markVaultUnsafe.
        vaultSource = "backup";
        vaultBackupIndex = i;
        markVaultUnsafe(`vault file unreadable; loaded backup .bak${i}`);
        return data;
      }
    } catch {
      /* try next backup */
    }
  }
  vaultSource = "empty";
  return new Map();
}

/** Local calendar date as YYYY-MM-DD (used to name daily backups). */
function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Dated daily backup. Once per calendar day, copy the CURRENT vault file into
 * `<dir>/Backups/invois-<YYYY-MM-DD>.json`, then prune snapshots older than
 * DAILY_BACKUP_KEEP days. Called at the START of writeVaultFile so the snapshot
 * captures the day's STARTING state (before today's edits overwrite it) — that's
 * what lets you roll back a whole day, unlike the per-save `.bak1..3` which the
 * rolling rotation can overwrite within seconds. Best-effort: never throws,
 * never blocks the real save.
 */
async function writeDailyBackup(dir: string): Promise<void> {
  try {
    const fs = native.fs;
    const primary = vaultPath(dir);
    if (!(await fs.exists(primary))) return; // nothing to snapshot yet
    const backupsDir = `${dir}/${DAILY_BACKUP_DIR}`;
    const todayPath = `${backupsDir}/invois-${localDateStr()}.json`;
    if (await fs.exists(todayPath)) return; // already snapshotted today

    try {
      await fs.mkdir(backupsDir, { recursive: true });
    } catch {
      /* already exists */
    }
    await fs.writeTextFile(todayPath, await fs.readTextFile(primary));

    // Prune older snapshots. We delete by dated filename (no dir listing needed):
    // walk back from KEEP days ago through a catch-up window to also clear files
    // left over after a gap of not opening the app.
    for (let i = DAILY_BACKUP_KEEP; i <= DAILY_BACKUP_KEEP + 45; i++) {
      const past = new Date();
      past.setDate(past.getDate() - i);
      const p = `${backupsDir}/invois-${localDateStr(past)}.json`;
      try {
        if (await fs.exists(p)) await fs.remove(p);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* backups are best-effort */
  }
}

// Atomic write: serialize → temp file → rotate backups → rename temp into place.
// std::fs::rename (what plugin-fs uses) overwrites atomically on macOS/Unix.
async function writeVaultFile(dir: string, data: Map<string, string>): Promise<void> {
  const fs = native.fs;
  // Snapshot the day's starting state before we overwrite the primary file.
  await writeDailyBackup(dir);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    /* already exists */
  }
  const path = vaultPath(dir);
  const tmp = `${path}.tmp`;
  // Nested, indented, human-readable — see the note above memToDoc. The two spaces
  // cost a few KB and buy a file the user can actually open and edit, which is the
  // whole promise of the vault.
  await fs.writeTextFile(tmp, JSON.stringify(memToDoc(data), null, 2));

  // Rotate: bak2→bak3, bak1→bak2, current→bak1 (best-effort).
  try {
    for (let i = BACKUP_COUNT; i > 1; i--) {
      const from = backupName(path, i - 1);
      if (await fs.exists(from)) await fs.rename(from, backupName(path, i));
    }
    if (await fs.exists(path)) await fs.rename(path, backupName(path, 1));
  } catch {
    /* backups are best-effort; don't block the main write */
  }
  await fs.rename(tmp, path);
}

// ---- safe mode ------------------------------------------------------------
//
// The rule: NEVER write a vault we could not read.
//
// Three ways we end up looking at data that is not what the user last saved: the
// file was unreadable and we loaded a backup; a collection failed to validate; the
// file is simply gone. In every one of them the old code carried on writing — and
// because flushNow() had no dirty check and fires on `visibilitychange`, merely
// minimising the window was enough to rewrite the vault and rotate the backups.
// BACKUP_COUNT = 3 therefore meant "three hide/show cycles", not "three saves": a
// user could lose everything without touching the keyboard.
//
// Refusing to write is only half of it. Refusing SILENTLY would be worse than the
// bug — the user would keep working, believing they were saving. So safe mode is
// loud: the UI subscribes via onVaultUnsafe() and says so.

let vaultUnsafe = false;
let vaultUnsafeReason = "";
let unsafeListeners: Array<() => void> = [];

/** Stop all writes and tell the UI. Called when the data we hold is not, or may
 *  not be, what the user last saved. */
export function markVaultUnsafe(reason: string): void {
  if (vaultUnsafe) return;
  vaultUnsafe = true;
  vaultUnsafeReason = reason;
  console.error("[vault] safe mode:", reason);
  unsafeListeners.forEach((f) => f());
}

/** Subscribe to "the vault went unsafe". Returns an unsubscribe fn. */
export function onVaultUnsafe(cb: () => void): () => void {
  unsafeListeners.push(cb);
  return () => {
    unsafeListeners = unsafeListeners.filter((f) => f !== cb);
  };
}

export interface VaultHealth {
  unsafe: boolean;
  reason: string;
  source: VaultSource;
  backupIndex: number;
}
export function getVaultHealth(): VaultHealth {
  return { unsafe: vaultUnsafe, reason: vaultUnsafeReason, source: vaultSource, backupIndex: vaultBackupIndex };
}

// ---- flushing -------------------------------------------------------------

// Set by setRaw/removeRaw. Without it, flushNow() rewrote the entire vault (and
// rotated the backups) on every window hide, whether or not anything had changed.
let dirty = false;

function scheduleFlush(): void {
  if (mode !== "file" || !vaultDir || vaultMissing || vaultUnsafe) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushNow(), FLUSH_DELAY);
}

/** Force any pending vault write to disk now. Safe to call anytime — it is a no-op
 *  when nothing changed, and when the vault is unsafe. */
export async function flushNow(): Promise<void> {
  if (mode !== "file" || !vaultDir || vaultMissing) return;
  if (vaultUnsafe) return; // never overwrite what we could not read
  if (!dirty) return; // nothing changed → nothing to write
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  // If the folder vanished while running (user renamed/moved/deleted it), do
  // NOT recreate it via mkdir — flag missing and let the UI show recovery.
  if (await vaultFolderGone(vaultDir)) {
    handleVaultVanished();
    return;
  }
  try {
    await writeVaultFile(vaultDir, mem);
    dirty = false;
  } catch {
    /* ignore — best effort; stay dirty so the next flush retries */
  }
}

/** Subscribe to "active vault vanished at runtime". Returns an unsubscribe fn.
 *  Lets the app switch to the recovery screen without waiting for a restart. */
export function onVaultMissing(cb: () => void): () => void {
  missingListeners.push(cb);
  return () => {
    missingListeners = missingListeners.filter((f) => f !== cb);
  };
}

function handleVaultVanished(): void {
  if (vaultMissing) return;
  vaultMissing = true;
  for (const cb of missingListeners) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

function installFlushHooks(): void {
  if (hooksInstalled || typeof window === "undefined") return;
  hooksInstalled = true;
  // Best-effort flush when the window is hidden or closing.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushNow();
  });
  window.addEventListener("beforeunload", () => void flushNow());
}

// ---- public API -----------------------------------------------------------

/**
 * Initialize the backend. Call once at startup, before mounting the data
 * providers. On the web build this is a no-op that reports `onboarded: true`.
 * On desktop it loads the vault if a location is already configured; otherwise
 * it reports `onboarded: false` so the UI can run the location picker.
 */
export async function initDataStore(): Promise<DataStoreStatus> {
  if (initialized) return status();

  if (!inTauri()) {
    mode = "local";
    onboarded = true; // web/dev has no data-location concept
    initialized = true;
    return status();
  }

  const cfg = readConfig();
  if (cfg?.onboarded && cfg.vaults.length) {
    config = cfg;
    const active = cfg.vaults.find((v) => v.id === cfg.activeId) ?? cfg.vaults[0];
    config.activeId = active.id;
    vaultDir = active.dir;
    mode = "file";
    onboarded = true;
    initialized = true;
    if (await anyVaultFileExists(active.dir)) {
      mem = await loadVaultFile(active.dir);
      dirty = false; // freshly loaded == what's on disk
      installFlushHooks();
    } else {
      // Folder moved/deleted externally — flag it so the UI can offer to locate
      // it. Leave mem empty and skip flush hooks so we never write empty data
      // back over the (now-dangling) pointer.
      vaultMissing = true;
      mem = new Map();
    }
    return status();
  }

  // Desktop, not yet onboarded — stay on localStorage until the user picks a
  // folder; `onboarded: false` tells the bootstrap to show onboarding.
  mode = "local";
  onboarded = false;
  initialized = true;
  return status();
}

/** A sensible default data folder to pre-fill the onboarding picker (desktop). */
export async function suggestVaultDir(): Promise<string> {
  try {
    const { documentDir } = native.path;
    return `${(await documentDir()).replace(/\/+$/, "")}/Invois`;
  } catch {
    return "";
  }
}

/**
 * True if `dir` sits INSIDE another vault — i.e. its parent folder already holds
 * a vault file (e.g. picking a vault's own `Backups/` or `Exports/` subfolder).
 * A folder that IS itself a vault does NOT count (that's an adopt, not a nest).
 * Used to stop onboarding from registering a nested/stray empty vault (the
 * addVault path has an equivalent guard against the registered vault list).
 */
export async function isDirInsideVault(dir: string): Promise<boolean> {
  const clean = dir.replace(/\/+$/, "");
  if (await anyVaultFileExists(clean)) return false; // it IS a vault → not nested
  const parent = clean.replace(/\/[^/]+$/, "");
  if (!parent || parent === clean) return false;
  return anyVaultFileExists(parent);
}

/**
 * Finish onboarding: adopt `dir` as the first business/vault and switch the
 * backend to file mode. If the folder ALREADY holds an Invois vault (e.g. the
 * user reinstalled and picked their old data folder), its data is ADOPTED —
 * loaded as-is instead of being overwritten with an empty vault. Only a
 * brand-new folder gets a fresh empty vault file written. Returns whether an
 * existing vault was adopted (so the caller can skip seeding sample data).
 * Throws "folder-nested" if `dir` sits inside another vault.
 */
export async function completeOnboarding(
  dir: string,
  name?: string
): Promise<{ adopted: boolean }> {
  const clean = dir.replace(/\/+$/, "");
  // Refuse a folder inside another vault (its Backups/Exports subfolder, etc.) —
  // it would create a nested, stray empty vault. Mirrors the addVault guard.
  if (await isDirInsideVault(clean)) {
    throw new Error("folder-nested");
  }
  // Adopt if the folder holds a vault file OR any surviving backup — matches
  // startup (`initDataStore` uses anyVaultFileExists) and lets loadVaultFile
  // recover data even when the primary file was deleted/corrupted.
  const adopted = await anyVaultFileExists(clean);
  mem = adopted ? await loadVaultFile(clean) : new Map();
  dirty = false;
  const id = genVaultId();
  config = {
    vaults: [{ id, name: name?.trim() || basename(clean), dir: clean }],
    activeId: id,
    onboarded: true,
  };
  vaultDir = clean;
  mode = "file";
  onboarded = true;
  initialized = true;
  if (!adopted) {
    await writeVaultFile(clean, mem); // create the file only for a fresh vault
  }
  writeConfig(config);
  installFlushHooks();
  return { adopted };
}

/**
 * Read a single key from a vault file WITHOUT adopting or switching to it (the
 * active store is untouched). Returns null if the folder has no vault or on
 * error. Used to peek at an existing vault during onboarding (e.g. prefill the
 * business profile form).
 */
export async function readVaultKey(dir: string, key: string): Promise<string | null> {
  const clean = dir.replace(/\/+$/, "");
  try {
    // Peek if the folder has a vault file OR any backup (loadVaultFile falls
    // back to backups), so onboarding prefill works even if the primary is gone.
    if (!(await anyVaultFileExists(clean))) return null;
    const map = await loadVaultFile(clean);
    return map.get(key) ?? null;
  } catch {
    return null;
  }
}

// ---- vault registry (switchable data locations) ---------------------------

/** All registered vaults (empty in local mode). Returns fresh copies so callers
 *  (e.g. React state) always get a new reference and can't mutate internals. */
export function listVaults(): VaultEntry[] {
  return config ? config.vaults.map((v) => ({ ...v })) : [];
}

/** The active business/vault, or null in local mode. */
export function getActiveVault(): VaultEntry | null {
  if (!config) return null;
  return config.vaults.find((v) => v.id === config!.activeId) ?? null;
}

/**
 * Register a NEW business at `dir`. If a vault file already exists there it's
 * adopted as-is; otherwise a fresh empty vault is created. Does NOT switch to
 * it. Returns the new id, or throws if the folder is already used by another
 * business.
 */
export async function addVault(dir: string, name?: string): Promise<string> {
  if (mode !== "file" || !config) throw new Error("addVault requires file mode");
  const clean = dir.replace(/\/+$/, "");
  if (config.vaults.some((v) => v.dir === clean)) {
    throw new Error("folder-in-use");
  }
  // Reject a folder that sits INSIDE an existing vault (e.g. its Backups/ or
  // Exports/ subfolder), or that would CONTAIN an existing vault. Either nests a
  // vault inside another → an empty stray vault + confusing recursive backups.
  const nested = config.vaults.some((v) => {
    const vd = v.dir.replace(/\/+$/, "");
    return clean.startsWith(vd + "/") || vd.startsWith(clean + "/");
  });
  if (nested) {
    throw new Error("folder-nested");
  }
  if (!(await vaultExistsIn(clean))) {
    await writeVaultFile(clean, new Map()); // fresh, empty business
  }
  const id = genVaultId();
  config.vaults.push({ id, name: name?.trim() || basename(clean), dir: clean });
  writeConfig(config);
  return id;
}

/**
 * Make `id` the active business. Persists the current vault first, updates the
 * pointer, and returns true; the caller should reload the window so every store
 * re-hydrates from the newly active vault.
 */
export async function switchVault(id: string): Promise<boolean> {
  if (mode !== "file" || !config) return false;
  if (id === config.activeId) return false;
  if (!config.vaults.some((v) => v.id === id)) return false;
  await flushNow();
  config.activeId = id;
  writeConfig(config);
  return true;
}

export function renameVault(id: string, name: string): void {
  if (!config) return;
  const v = config.vaults.find((x) => x.id === id);
  if (v && name.trim()) {
    v.name = name.trim();
    writeConfig(config);
  }
}

/**
 * Forget a business from the registry. Its data files are left on disk (not
 * deleted). Cannot remove the active business or the last remaining one.
 */
export function removeVault(id: string): boolean {
  if (!config) return false;
  if (id === config.activeId || config.vaults.length <= 1) return false;
  config.vaults = config.vaults.filter((v) => v.id !== id);
  writeConfig(config);
  return true;
}

/**
 * Recovery for a missing active vault: re-point the active entry at `dir` where
 * its vault file now lives (e.g. after the user moved the folder). Returns false
 * if `dir` doesn't actually contain a vault file. On success the caller should
 * reload the window so the app re-hydrates from the found vault.
 */
export async function recoverVaultLocation(dir: string): Promise<boolean> {
  if (!config) return false;
  const clean = dir.replace(/\/+$/, "");
  if (!(await vaultExistsIn(clean))) return false;
  const active = getActiveVault();
  if (!active) return false;
  const oldDir = active.dir.replace(/\/+$/, "");
  active.dir = clean;
  writeConfig(config);
  // Leave a one-shot hint so the settings store can move a DEFAULT export folder
  // (the vault's "Exports" subfolder) to the new location after the reload.
  if (oldDir && oldDir !== clean) {
    try {
      localStorage.setItem(EXPORT_RELOCATE_KEY, JSON.stringify({ from: oldDir, to: clean }));
    } catch {
      /* ignore */
    }
  }
  return true;
}

/** One-shot: the {from,to} vault folders from the last recovery relocation, so
 *  the settings store can follow a default export folder to the new location. */
export function takeExportDirRelocation(): { from: string; to: string } | null {
  try {
    const raw = localStorage.getItem(EXPORT_RELOCATE_KEY);
    if (!raw) return null;
    localStorage.removeItem(EXPORT_RELOCATE_KEY);
    return JSON.parse(raw) as { from: string; to: string };
  } catch {
    return null;
  }
}

export function getStatus(): DataStoreStatus {
  return status();
}

/** Dev-only: forget the vault pointer so the app returns to onboarding on the
 *  next reload. NON-DESTRUCTIVE — the vault FILE stays on disk (re-picking the
 *  same folder re-adopts the data); only the localStorage pointer is cleared.
 *  Gated to dev builds at the call site (Settings → Preferences). */
export function devResetOnboarding(): void {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* ignore */
  }
}

// Subfolder inside the vault folder where exported PDFs/PNGs are collected.
const EXPORT_SUBDIR = "Exports";

/** The default export folder: an "Exports" subfolder inside the active vault's
 *  folder, created if missing. Returns null in local/web mode (no vault dir),
 *  where callers fall back to the OS Downloads folder. */
export async function ensureDefaultExportDir(): Promise<string | null> {
  if (mode !== "file" || !vaultDir) return null;
  const dir = `${vaultDir.replace(/\/+$/, "")}/${EXPORT_SUBDIR}`;
  try {
    const fs = native.fs;
    await fs.mkdir(dir, { recursive: true });
    return dir;
  } catch {
    return null;
  }
}

export function getRaw(key: string): string | null {
  if (mode === "file") return mem.has(key) ? mem.get(key)! : null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setRaw(key: string, value: string): void {
  if (mode === "file") {
    if (mem.get(key) === value) return; // no change → don't dirty the vault
    mem.set(key, value);
    dirty = true;
    scheduleFlush();
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeRaw(key: string): void {
  if (mode === "file") {
    if (!mem.has(key)) return;
    mem.delete(key);
    dirty = true;
    scheduleFlush();
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
