// Invois — Electron spike (macOS).
//
// PURPOSE: prove the one thing that blocks Tauri on the Mac App Store — that a
// SANDBOXED app can keep access to a user-chosen folder ACROSS RELAUNCHES via
// security-scoped bookmarks.
//
// The flow this exercises:
//   1. User picks a folder (NSOpenPanel). In a MAS build we also ask macOS for a
//      security-scoped BOOKMARK for it (`securityScopedBookmarks: true`).
//   2. We persist { dir, bookmark } in the app's own userData (always writable).
//   3. On EVERY launch we resolve the bookmark and call
//      app.startAccessingSecurityScopedResource(bookmark) — this re-opens the
//      sandbox door to that folder. Normal Node `fs` then just works.
//   4. On quit we call the returned stop() — required, or macOS leaks kernel
//      resources and the app loses its ability to reach outside the sandbox.
//
// If step 3 works after a quit + relaunch WITHOUT re-picking the folder, the
// blocker is solved and Invois can keep "your data, your folder" on the App Store.

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const VAULT_FILE = "invois-data.json";

/** Where we remember which folder the user chose (inside our own container —
 *  always writable, no permission needed). */
const configPath = () => path.join(app.getPath("userData"), "vault-config.json");

/** True only in a Mac App Store build. Electron sets this for us. */
const isMas = () => process.mas === true;

/** @type {{dir: string, bookmark?: string} | null} */
let vaultConfig = null;
/** Call this to close the sandbox door again. MUST be called before quit. */
let stopAccess = null;

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(configPath(), "utf8"));
  } catch {
    return null;
  }
}

async function writeConfig(cfg) {
  await fs.writeFile(configPath(), JSON.stringify(cfg, null, 2), "utf8");
}

/**
 * Re-open the sandbox door for the bookmarked folder. No-op outside a MAS build
 * (there, the app isn't sandboxed and can read the path directly).
 * Returns an error string on failure, or null on success.
 */
function beginAccess(bookmark) {
  releaseAccess();
  if (!bookmark) return null;
  if (!isMas()) return null; // not sandboxed → nothing to unlock
  try {
    stopAccess = app.startAccessingSecurityScopedResource(bookmark);
    return null;
  } catch (e) {
    return String(e);
  }
}

function releaseAccess() {
  if (stopAccess) {
    try {
      stopAccess();
    } catch {
      /* ignore */
    }
    stopAccess = null;
  }
}

// ---- IPC: the tiny surface the test UI drives ------------------------------

ipcMain.handle("vault:status", async () => {
  let canRead = false;
  let readError = null;
  if (vaultConfig?.dir) {
    try {
      await fs.access(path.join(vaultConfig.dir, VAULT_FILE));
      canRead = true;
    } catch (e) {
      readError = String(e.code || e);
    }
  }
  return {
    mas: isMas(),
    packaged: app.isPackaged,
    dir: vaultConfig?.dir ?? null,
    hasBookmark: Boolean(vaultConfig?.bookmark),
    accessActive: Boolean(stopAccess),
    canRead,
    readError,
    userData: app.getPath("userData"),
  };
});

ipcMain.handle("vault:pick", async () => {
  const res = await dialog.showOpenDialog({
    title: "Choose a folder for your Invois data",
    properties: ["openDirectory", "createDirectory"],
    // THE KEY LINE. Only honoured in a MAS build; elsewhere `bookmarks` is empty.
    securityScopedBookmarks: true,
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };

  const dir = res.filePaths[0];

  // Electron's contract (see electron#16664):
  //   []      → not a MAS build, or securityScopedBookmarks was false
  //   ['']    → MAS build, but macOS FAILED to mint the bookmark  ← real failure
  //   ['Ym..'] → success (base64 bookmark)
  const raw = res.bookmarks?.[0];
  let bookmark;
  let error = null;
  if (raw === undefined) {
    error = isMas()
      ? "macOS returned no bookmark at all (unexpected in a MAS build)"
      : null; // fine: not sandboxed, we don't need one
  } else if (raw === "") {
    error = "macOS refused to create a bookmark (check entitlements: files.bookmarks.app-scope + files.user-selected.read-write)";
  } else {
    bookmark = raw;
  }

  vaultConfig = { dir, bookmark };
  await writeConfig(vaultConfig);

  const accessErr = beginAccess(bookmark);
  return {
    canceled: false,
    dir,
    hasBookmark: Boolean(bookmark),
    error: error ?? accessErr,
  };
});

ipcMain.handle("vault:write", async () => {
  if (!vaultConfig?.dir) throw new Error("No folder chosen yet");
  const payload = {
    writtenAt: new Date().toISOString(),
    note: "If you can still read this after quitting and relaunching the app "
      + "WITHOUT re-picking the folder, security-scoped bookmarks work.",
  };
  const file = path.join(vaultConfig.dir, VAULT_FILE);
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return { file, payload };
});

ipcMain.handle("vault:read", async () => {
  if (!vaultConfig?.dir) throw new Error("No folder chosen yet");
  const file = path.join(vaultConfig.dir, VAULT_FILE);
  const text = await fs.readFile(file, "utf8");
  return { file, payload: JSON.parse(text) };
});

ipcMain.handle("vault:forget", async () => {
  releaseAccess();
  vaultConfig = null;
  try {
    await fs.unlink(configPath());
  } catch {
    /* ignore */
  }
  return true;
});

ipcMain.handle("vault:reveal", async () => {
  if (vaultConfig?.dir) await shell.openPath(vaultConfig.dir);
});

// ---- lifecycle -------------------------------------------------------------

async function createWindow() {
  const win = new BrowserWindow({
    width: 760,
    height: 640,
    title: "Invois — bookmark spike",
    backgroundColor: "#f7f8fc",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(async () => {
  // Restore the previous folder BEFORE the UI loads — this is the whole point:
  // no re-picking, no dialog, the app just regains access.
  vaultConfig = await readConfig();
  if (vaultConfig?.bookmark) beginAccess(vaultConfig.bookmark);

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Required: leaking the security scope breaks the sandbox until app restart.
app.on("will-quit", releaseAccess);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
