// Invois — Electron main process.
//
// This is the "native" half of the app. The renderer (our Next.js UI) can't
// touch the filesystem or macOS APIs directly — it asks us over IPC, and we do
// the work. That's what `contextIsolation` buys us: the UI stays sandboxed even
// from Node.
//
// Everything here replaces the Rust layer from the Tauri build:
//   Tauri plugin-fs        → Node `fs`
//   Tauri plugin-dialog    → Electron `dialog`   (+ security-scoped bookmarks)
//   Tauri plugin-opener    → Electron `shell`
//   Tauri api/path         → Electron `app.getPath()`
//   Tauri custom Rust menu → Electron `Menu`
//   Rust `render_pdf_slice`→ Chromium `webContents.printToPDF()`  ← much simpler

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const isDev = process.env.ELECTRON_DEV === "1";
/** True only in a Mac App Store build (Electron sets this). */
const isMas = () => process.mas === true;

// ---------------------------------------------------------------------------
// App identity.
//
// In dev we run Apple's *stock* Electron binary, so the Dock icon, the app name
// and the About panel all come from Electron's own Info.plist — that's why it
// says "Electron". A packaged build gets its identity from electron-builder
// (productName + build/icon.icns). The three calls below paper over the dev
// case so it doesn't look wrong while you work.
// ---------------------------------------------------------------------------
app.setName("Invois");

const ICON = path.join(__dirname, "..", "build", "icon.png");

app.setAboutPanelOptions({
  applicationName: "Invois",
  applicationVersion: app.getVersion(),
  version: "", // hide Electron's build number
  copyright: "© 2026 Arif Riyanto",
  iconPath: ICON,
});

// `app://` must be declared PRIVILEGED before the app is ready — and this is not
// cosmetic. A plain custom scheme gets an *opaque origin*, which means
// localStorage throws… and localStorage is where we keep the vault pointer. The
// production build would boot straight into onboarding, every single launch.
// `standard` gives it a real origin; `secure` puts it on par with https.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let mainWindow = null;

// ---------------------------------------------------------------------------
// Security-scoped bookmarks — the whole reason we're on Electron.
//
// Under the App Store sandbox, picking a folder only grants access for THIS
// session. To keep it across relaunches we must store a "bookmark" macOS gives
// us, and re-open the door on every launch. Outside the sandbox this is all a
// no-op (a Developer-ID build can just read the path).
// ---------------------------------------------------------------------------

/** Bookmarks we've been granted, keyed by folder path. Persisted in userData. */
let bookmarks = {};
/** Live "stop" handles — MUST be called before quit or macOS leaks kernel resources. */
const openScopes = new Map();

const bookmarksFile = () => path.join(app.getPath("userData"), "bookmarks.json");

async function loadBookmarks() {
  try {
    bookmarks = JSON.parse(await fs.readFile(bookmarksFile(), "utf8"));
  } catch {
    bookmarks = {};
  }
}
async function saveBookmarks() {
  await fs.writeFile(bookmarksFile(), JSON.stringify(bookmarks, null, 2), "utf8");
}

/** Re-open the sandbox door for a folder we were granted before. */
function openScope(dir) {
  if (!isMas() || openScopes.has(dir)) return;
  const bm = bookmarks[dir];
  if (!bm) return;
  try {
    openScopes.set(dir, app.startAccessingSecurityScopedResource(bm));
  } catch (e) {
    console.error("[bookmark] failed to open scope for", dir, e);
  }
}

function closeAllScopes() {
  for (const stop of openScopes.values()) {
    try {
      stop();
    } catch {
      /* ignore */
    }
  }
  openScopes.clear();
}

// ---------------------------------------------------------------------------
// IPC — the exact surface the UI needs. Mirrors what the Tauri plugins gave us.
// ---------------------------------------------------------------------------

// -- filesystem --
// Immediate children of a folder, directories only. Used to refuse a folder that
// CONTAINS a vault (the mirror of refusing one that sits inside a vault) — see
// isDirInsideVault / folderContainsVault in data-store.ts. Deliberately one level
// deep: a full recursive walk of, say, ~/Documents would be slow and is not worth
// it for the case it would catch.
ipcMain.handle("fs:readDirs", async (_e, p) => {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
});

ipcMain.handle("fs:exists", async (_e, p) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("fs:readText", (_e, p) => fs.readFile(p, "utf8"));
ipcMain.handle("fs:writeText", (_e, p, data) => fs.writeFile(p, data, "utf8"));
ipcMain.handle("fs:writeBinary", (_e, p, data) => fs.writeFile(p, Buffer.from(data)));
ipcMain.handle("fs:mkdir", (_e, p) => fs.mkdir(p, { recursive: true }));
ipcMain.handle("fs:remove", (_e, p) => fs.rm(p, { force: true }));
ipcMain.handle("fs:rename", (_e, from, to) => fs.rename(from, to));

// -- folder picker (this is where a bookmark is minted) --
ipcMain.handle("dialog:pickDirectory", async (_e, defaultPath) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    // Where the panel opens. Without it macOS picks for us (in practice:
    // Downloads), which is a poor first impression for "choose your vault".
    ...(defaultPath ? { defaultPath } : {}),
    // Only honoured in a MAS build. Elsewhere `bookmarks` comes back empty,
    // which is fine — an unsandboxed app doesn't need one.
    securityScopedBookmarks: true,
  });
  if (res.canceled || !res.filePaths[0]) return null;

  const dir = res.filePaths[0];
  const raw = res.bookmarks?.[0];
  // Electron's contract (electron#16664): '' means macOS REFUSED to mint one.
  if (raw) {
    bookmarks[dir] = raw;
    await saveBookmarks();
    openScope(dir);
  } else if (isMas()) {
    console.error("[bookmark] macOS refused to create a bookmark for", dir);
  }
  return dir;
});

// -- OS paths --
ipcMain.handle("path:downloads", () => app.getPath("downloads"));
ipcMain.handle("path:documents", () => app.getPath("documents"));
ipcMain.handle("path:home", () => app.getPath("home"));

// -- open a file/folder in Finder / default app --
ipcMain.handle("shell:openPath", (_e, p) => shell.openPath(p));

// -- window state (the UI hides its custom title bar in fullscreen) --
ipcMain.handle("win:isFullscreen", () => mainWindow?.isFullScreen() ?? false);

// -- PDF ---------------------------------------------------------------------
// Chromium prints the CURRENT document using our @media print rules (which hide
// the app chrome and leave only the invoice). It paginates A4 for us — no page
// slicing, no pdf-lib, no Rust. This is the biggest win of the move.
ipcMain.handle("pdf:toFile", async (_e, outPath, title) => {
  if (!mainWindow) throw new Error("no window");
  const data = await mainWindow.webContents.printToPDF({
    pageSize: "A4",
    printBackground: true,
    margins: { marginType: "none" },
    preferCSSPageSize: true,
    // Embed the document STRUCTURE (headings, table, rows, cells), not just text
    // floating at coordinates. Without it a PDF viewer has to guess what a drag
    // across cells means, and partial selection feels like it jumps around.
    // Also makes the invoice readable by a screen reader. Costs a few KB.
    generateTaggedPDF: true,
  });
  await fs.writeFile(outPath, await stampMetadata(data, title));
  return outPath;
});

/**
 * Re-sign the PDF as ours.
 *
 * printToPDF has no metadata options: Chromium writes the bytes through Skia, so
 * the file arrives stamped `Producer: Skia/PDF`. The client who opens the invoice
 * sees a graphics library's name in Get Info instead of the product's. pdf-lib
 * rewrites just the info dictionary — the page content, the tags and the fonts
 * are untouched.
 *
 * pdf-lib lives HERE, in the main process, not in the renderer: it never enters
 * the app bundle the UI loads. Best-effort — a metadata failure must never cost
 * the user their export, so we fall back to the original bytes.
 */
async function stampMetadata(bytes, title) {
  try {
    const { PDFDocument } = require("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    doc.setProducer("Invois");
    doc.setCreator("Invois");
    doc.setAuthor("Invois");
    if (title) doc.setTitle(title);
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());
    return Buffer.from(await doc.save());
  } catch (e) {
    console.error("[pdf] metadata stamp failed, writing unstamped file:", e);
    return bytes;
  }
}

// ---------------------------------------------------------------------------
// Right-click menu.
//
// Electron ships NO context menu — Chromium's default one is disabled, which is
// why right-click does nothing. We build our own:
//   • in a text field  → the usual Cut / Copy / Paste / Select All (always)
//   • in dev           → plus Reload and Inspect element
// Outside a text field in production, right-click stays inert on purpose: this
// is an app, not a web page.
// ---------------------------------------------------------------------------

function attachContextMenu(win) {
  win.webContents.on("context-menu", (_e, params) => {
    const items = [];

    if (params.isEditable) {
      items.push(
        { role: "cut", enabled: params.editFlags.canCut },
        { role: "copy", enabled: params.editFlags.canCopy },
        { role: "paste", enabled: params.editFlags.canPaste },
        { type: "separator" },
        { role: "selectAll" },
      );
    } else if (params.selectionText) {
      items.push({ role: "copy" });
    }

    if (isDev) {
      if (items.length) items.push({ type: "separator" });
      items.push(
        { label: "Reload", accelerator: "Cmd+R", click: () => win.webContents.reload() },
        {
          label: "Inspect element",
          click: () => win.webContents.inspectElement(params.x, params.y),
        },
      );
    }

    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
}

// ---------------------------------------------------------------------------
// Native macOS menu → forwarded to the UI as "menu-action" (same contract the
// Rust menu used, so shell.tsx barely changes).
// ---------------------------------------------------------------------------

function send(action) {
  mainWindow?.webContents.send("menu-action", action);
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "Settings…", accelerator: "Cmd+,", click: () => send("settings") },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        { label: "New Invoice", accelerator: "Cmd+N", click: () => send("new_invoice") },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Home", accelerator: "Cmd+1", click: () => send("view_home") },
        { label: "Invoices", accelerator: "Cmd+2", click: () => send("view_invoice") },
        { label: "Clients", accelerator: "Cmd+3", click: () => send("view_customers") },
        { label: "Catalog", accelerator: "Cmd+4", click: () => send("view_katalog") },
        { type: "separator" },
        { label: "Toggle Sidebar", accelerator: "Cmd+B", click: () => send("toggle_sidebar") },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ role: "toggleDevTools" }, { role: "reload" }] : []),
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Window + app loading
//
// dev  → the Next dev server (hot reload)
// prod → the static export in `out/`, served over a custom `app://` protocol.
//        We avoid file:// because Next emits absolute asset paths (/_next/…),
//        which file:// resolves against the filesystem root and breaks.
// ---------------------------------------------------------------------------

/** Fixed authority for the app:// origin. Any host works (we only read the
 *  path), but pinning one keeps the origin — and therefore localStorage —
 *  stable across launches. */
const APP_HOST = "invois";

function registerAppProtocol() {
  const root = path.join(__dirname, "..", "out");
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    // Static export writes extension-less routes as `<route>.html`.
    if (!path.extname(rel)) rel += ".html";
    const file = path.join(root, rel);
    // Never serve outside `out/`.
    if (!file.startsWith(root)) return new Response("forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    // The app draws its own title bar (brand + Pro pill), so hide the native one
    // but keep the traffic lights, inset.
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 13 },
    backgroundColor: "#ffffff", // kills the black flash the WKWebView build had
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Tell the renderer whether it is running inside a PACKAGED .app. The UI
      // uses this as a second lock on the dev-only tools (Developer menu, Pro
      // toggle): `NODE_ENV` is a build-time constant, so if a dev bundle were
      // ever shipped by accident, those tools would open up in a paid app. This
      // value comes from the OS, not from the build.
      additionalArguments: [`--invois-packaged=${app.isPackaged ? "1" : "0"}`],
      // OS-level renderer sandbox. Our preload only touches contextBridge +
      // ipcRenderer, both of which stay available under it, so this costs us
      // nothing and buys a real boundary.
      sandbox: true,
    },
  });

  attachContextMenu(mainWindow);

  const fullscreenChanged = () =>
    mainWindow?.webContents.send("win:fullscreen", mainWindow.isFullScreen());
  mainWindow.on("enter-full-screen", fullscreenChanged);
  mainWindow.on("leave-full-screen", fullscreenChanged);

  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (isDev) {
    await mainWindow.loadURL("http://localhost:3000");
  } else {
    await mainWindow.loadURL(`app://${APP_HOST}/index.html`);
  }
}

app.whenReady().then(async () => {
  // Dev only: the packaged app carries its icon in the bundle already.
  if (isDev) {
    try {
      app.dock?.setIcon(ICON);
    } catch {
      /* icon is cosmetic — never block startup over it */
    }
  }

  await loadBookmarks();
  // Re-open every folder we were previously granted, BEFORE the UI boots — so
  // the vault just works, with no re-picking.
  for (const dir of Object.keys(bookmarks)) openScope(dir);

  if (!isDev) registerAppProtocol();
  buildMenu();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ---------------------------------------------------------------------------
// Navigation lockdown.
//
// The renderer holds the keys to the filesystem (fs:* IPC). So the one thing it
// must never do is load somebody else's page. Nothing in Invois navigates or
// opens windows — so we forbid both outright, for every web contents that ever
// exists. Any URL that wants to leave the app goes to the user's browser instead.
//
// This is the single most valuable guard in an Electron app, and it's why the
// broad fs:* surface is acceptable: no foreign code can ever reach it.
// ---------------------------------------------------------------------------
app.on("web-contents-created", (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const ok = isDev
      ? url.startsWith("http://localhost:3000")
      : url.startsWith(`app://${APP_HOST}/`);
    if (!ok) {
      event.preventDefault();
      if (url.startsWith("https://")) void shell.openExternal(url);
    }
  });

  // Never attach a preload (i.e. the bridge) to anything we didn't create.
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

app.on("will-quit", closeAllScopes);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
