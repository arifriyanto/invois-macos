"use client";
import * as native from "@/lib/native";
import { migrateMoneyToMinor } from "./vault-migrate";
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

/**
 * The file declares its own format, and a reader that does not understand it must
 * REFUSE rather than guess. This is not hypothetical bookkeeping — it is the exact
 * accident that cost Arif his vault on 13 Jul 2026.
 *
 * Format 2 (nested) is readable by format-1 code only by accident: the old reader
 * hands each value straight to JSON.parse, so an object arrives as "[object Object]",
 * throws, and gets swallowed into an empty list — and the old writer then saves that
 * emptiness over the file. Backward compatibility (new reads old) was never the
 * danger. FORWARD compatibility was: an older build meeting a newer file destroys it
 * silently.
 *
 * We cannot retrofit that check into code already written, but we can stop it ever
 * happening again: from here on, a file that claims a format we do not know puts the
 * vault into safe mode and nothing is written.
 */
const VAULT_FORMAT = 3;
// 1 = double-encoded (values were JSON strings)
// 2 = nested values
// 3 = money as integer minor units (prices were decimal `price` fields)
const FORMAT_KEY = "__invois";

interface FormatMarker {
  format: number;
}

/** Disk → memory. Accepts every format we have ever written: a string value is the
 *  legacy double-encoded form and is taken as-is, and pre-3 money is converted to
 *  minor units here, so the rest of the app only ever sees the current shape. */
function docToMem(doc: VaultDoc): Map<string, string> {
  const marker = doc[FORMAT_KEY] as FormatMarker | undefined;
  const format = typeof marker?.format === "number" ? marker.format : 1;
  if (format > VAULT_FORMAT) {
    // Written by a NEWER build of Invois. Read what we can, but never write: we do
    // not know what fields we would be dropping.
    markVaultUnsafe(`vault was written by a newer version of Invois (format ${format})`);
  }

  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(doc)) {
    if (k === FORMAT_KEY) continue; // bookkeeping, not app data
    m.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }

  // Money: decimal → integer minor units. Guarded by `format < 3` AND by the
  // migration's own per-field check, so a vault that is already in minor units is
  // not scaled a second time (which would turn $19.99 into $1,999.00). Belt and
  // braces on purpose: the format marker is absent from format-1 files, so it is
  // not, on its own, something to bet the user's invoices on.
  if (format < 3 && format <= VAULT_FORMAT) {
    migrateMoneyToMinor(m);
  }

  return m;
}

/**
 * A MIGRATION DOES NOT MAKE THE VAULT DIRTY. Opening the app must never, by
 * itself, rewrite the user's file.
 *
 * This used to set a `migratedOnLoad` flag which initDataStore turned into
 * `dirty = true` — so the migrated form would "land on the next save". But the
 * flush hooks fire on quit, and a dirty vault flushes. So merely OPENING the app
 * and closing it again converted the file to format 3. The comment right here
 * claimed the opposite; the code did not honour it. Arif caught it with an md5
 * (case 9.2).
 *
 * Why it matters, beyond tidiness: converting on open takes away the user's
 * retreat. Someone opens a new build, is unsure, quits, and goes back to the
 * version they trust — and now that version meets a format it does not know and
 * refuses to work. We would have upgraded their data without asking, on the
 * strength of them having double-clicked the icon once.
 *
 * So the migration lives in memory and lands the first time the user actually
 * changes something. It is idempotent, so re-running it on every load costs
 * nothing and risks nothing. A vault that is opened and never edited stays
 * exactly as it was found — which is the only honest thing for a read to do.
 */

/** Memory → disk. Always writes the current nested form, stamped with its format. A
 *  value that somehow is not valid JSON is stored as a string rather than dropped. */
function memToDoc(m: Map<string, string>): VaultDoc {
  const doc: VaultDoc = { [FORMAT_KEY]: { format: VAULT_FORMAT } };
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

/**
 * Write the vault. The primary file must NEVER stop existing, not for an instant.
 *
 * The old code rotated by MOVING the primary out of the way (`rename(path, .bak1)`)
 * and only then renamed the temp file into place. Between those two steps the vault
 * did not exist. Anything that interrupted the process there — a quit, a crash, a
 * dev-server reload — took the user's only copy with it. That is not theoretical:
 * it happened on Arif's machine on 13 Jul 2026, and left behind nothing but backups.
 *
 * The move was never necessary. On macOS `rename(tmp, path)` ALREADY replaces the
 * destination atomically; the old file is released the moment the new one lands.
 * We were destroying the only copy to clear a space that did not need clearing.
 *
 * So: COPY the primary into .bak1 (it stays where it is), rotate the older backups
 * by copy too, and finish with the one atomic rename. Every step is now recoverable,
 * and at every instant of it there is a complete vault on disk.
 */
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

  // Rotate by COPY, oldest first: bak2→bak3, bak1→bak2, primary→bak1. The primary
  // is never moved, so it never disappears. Best-effort: a failed rotation must not
  // block the save.
  const copy = async (from: string, to: string) => {
    if (await fs.exists(from)) await fs.writeTextFile(to, await fs.readTextFile(from));
  };
  try {
    for (let i = BACKUP_COUNT; i > 1; i--) {
      await copy(backupName(path, i - 1), backupName(path, i));
    }
    await copy(path, backupName(path, 1));
  } catch {
    /* backups are best-effort; don't block the main write */
  }

  // The only destructive step, and it is atomic: the vault is either the old file
  // or the new one, never nothing.
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
/** Bumped every time the vault becomes unsafe. A stable, primitive snapshot for
 *  useSyncExternalStore — the banner cannot subscribe to an object that is rebuilt
 *  on every read. */
let unsafeVersion = 0;
export function getVaultUnsafeVersion(): number {
  return unsafeVersion;
}

export function markVaultUnsafe(reason: string): void {
  if (vaultUnsafe) return;
  vaultUnsafe = true;
  vaultUnsafeReason = reason;
  unsafeVersion += 1;
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
      // Freshly loaded == what is on disk. A migration does NOT change that: it
      // lives in memory and lands on the user's first real edit. See the note
      // above migrateMoneyToMinor's call site.
      dirty = false;
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
 * True if `dir` sits INSIDE another vault — i.e. some ANCESTOR folder holds a
 * vault file (e.g. picking a vault's own `Backups/` or `Exports/` subfolder).
 * A folder that IS itself a vault does NOT count (that's an adopt, not a nest).
 *
 * This asks the DISK, not the registry, and that distinction is the whole point.
 * A vault that is not currently registered — the user re-onboarded elsewhere, or
 * has not added it as a business yet — is still a vault, and still must not have
 * another one nested inside it. `addVault` used to check only `config.vaults`,
 * so `~/qa/v-baru/Backups` was accepted the moment v-baru fell out of the
 * registry, and a stray empty vault was written into another vault's backup
 * folder. The registry is a list of what we happen to know about; the disk is
 * what is true.
 *
 * It walks every ancestor, not just the immediate parent: `<vault>/Backups/sub`
 * is nested just as surely as `<vault>/Backups`.
 */
export async function isDirInsideVault(dir: string): Promise<boolean> {
  const clean = dir.replace(/\/+$/, "");
  if (await anyVaultFileExists(clean)) return false; // it IS a vault → not nested

  let cur = clean;
  for (;;) {
    const parent = cur.replace(/\/[^/]+$/, "");
    if (!parent || parent === cur) return false; // reached the root
    if (await anyVaultFileExists(parent)) return true;
    cur = parent;
  }
}

/**
 * The mirror image: true if `dir` CONTAINS a vault (one of its subfolders is one).
 *
 * Nesting is bad in both directions, and we only ever guarded one of them.
 * `addVault` caught the containing case by consulting the registry — but
 * onboarding has no registry, so picking `~/Desktop/qa` while `qa/v-baru` and
 * `qa/v-adopsi` were vaults was accepted, and a third vault was created on top of
 * the other two. Found by Arif, 14 Jul 2026.
 *
 * Only IMMEDIATE children are checked. A full recursive walk of, say, ~/Documents
 * would be slow enough to notice, and this is not a security boundary — it is a
 * guard rail against an easy mistake. A vault buried three levels down will still
 * slip through, and that is a trade we are making on purpose rather than by
 * accident.
 */
export async function dirContainsVault(dir: string): Promise<boolean> {
  const clean = dir.replace(/\/+$/, "");
  try {
    const children = await native.fs.readDirs(clean);
    for (const name of children) {
      if (await anyVaultFileExists(`${clean}/${name}`)) return true;
    }
  } catch {
    /* can't read it → don't block the user over it */
  }
  return false;
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
  // Refuse nesting in BOTH directions: a folder inside another vault (its
  // Backups/Exports subfolder), and a folder that contains one (picking ~/Desktop/qa
  // while qa/v-baru is already a vault). Either way you end up with vaults inside
  // vaults, recursive backups, and no clear answer to "which file is my data".
  if ((await isDirInsideVault(clean)) || (await dirContainsVault(clean))) {
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
  // Exports/ subfolder), or that would CONTAIN one. Either nests a vault inside
  // another → a stray empty vault and recursive backups.
  //
  // TWO checks, because they catch different things and this used to have only
  // the first:
  //
  //  1. The REGISTRY, which is the only way to see a folder that would CONTAIN a
  //     known vault (we cannot cheaply scan a folder's descendants).
  //
  //  2. The DISK, which is the only way to see a vault we are not currently
  //     tracking. That gap was real: after re-onboarding to another folder,
  //     `~/qa/v-baru` left the registry, so `~/qa/v-baru/Backups` sailed past the
  //     registry check — and since no vault file existed *in* Backups, the code
  //     below happily WROTE one there, inside another vault's backup folder.
  //     Onboarding already asked the disk (isDirInsideVault); this path did not.
  //     Two guards for the same rule, and the weaker one was the one that writes.
  const nestedInRegistered = config.vaults.some((v) => {
    const vd = v.dir.replace(/\/+$/, "");
    return clean.startsWith(vd + "/") || vd.startsWith(clean + "/");
  });
  if (nestedInRegistered || (await isDirInsideVault(clean)) || (await dirContainsVault(clean))) {
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

/**
 * The {from,to} vault folders from the last recovery relocation, so the settings
 * store can follow a DEFAULT export folder to the new location.
 *
 * This used to be a single `take()` that read the hint and deleted it in one go.
 * That was a bug, and a nasty one to see: React StrictMode invokes effects TWICE
 * in development. The first invocation consumed the hint, awaited the filesystem
 * — and by the time it came back, StrictMode's cleanup had already flipped its
 * `cancelled` flag, so the result was thrown away. The second invocation found
 * nothing left to do. The hint was spent without ever being applied, and the
 * export folder silently stayed pointing at the vault's old home.
 *
 * So: reading and clearing are separate now. Read it, apply it, and only then say
 * you are done with it. A one-shot token that can be consumed by work that gets
 * discarded is not a one-shot token; it is a leak.
 */
export function peekExportDirRelocation(): { from: string; to: string } | null {
  try {
    const raw = localStorage.getItem(EXPORT_RELOCATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { from: string; to: string };
  } catch {
    return null;
  }
}

/** Call once the relocation above has actually been applied. */
export function clearExportDirRelocation(): void {
  try {
    localStorage.removeItem(EXPORT_RELOCATE_KEY);
  } catch {
    /* ignore */
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
