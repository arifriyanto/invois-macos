// The bridge. Runs in an isolated world: it can use Node, the UI cannot.
// Whatever we expose on `window.invois` is the ENTIRE native surface the app
// has — nothing else leaks through (contextIsolation: true).
//
// This mirrors, one-for-one, what the Tauri plugins used to provide.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("invois", {
  /** Lets the shared code tell "desktop" from "plain browser" (was: __TAURI_INTERNALS__). */
  isDesktop: true,

  /** True inside a packaged .app (main passes it via additionalArguments — it comes
   *  from `app.isPackaged`, i.e. the OS, not from a build-time constant). The UI
   *  uses it to keep dev-only tools shut in a shipped build. */
  isPackaged: process.argv.includes("--invois-packaged=1"),

  fs: {
    exists: (p) => ipcRenderer.invoke("fs:exists", p),
    readDirs: (p) => ipcRenderer.invoke("fs:readDirs", p),
    readText: (p) => ipcRenderer.invoke("fs:readText", p),
    writeText: (p, data) => ipcRenderer.invoke("fs:writeText", p, data),
    // Uint8Array survives the structured clone; main turns it back into a Buffer.
    writeBinary: (p, data) => ipcRenderer.invoke("fs:writeBinary", p, data),
    mkdir: (p) => ipcRenderer.invoke("fs:mkdir", p),
    remove: (p) => ipcRenderer.invoke("fs:remove", p),
    rename: (from, to) => ipcRenderer.invoke("fs:rename", from, to),
  },

  dialog: {
    /** Returns the chosen path, or null if cancelled. `defaultPath` decides where
     *  the panel opens. Mints a security-scoped bookmark behind the scenes when
     *  running sandboxed. */
    pickDirectory: (defaultPath) => ipcRenderer.invoke("dialog:pickDirectory", defaultPath),
  },

  path: {
    downloads: () => ipcRenderer.invoke("path:downloads"),
    documents: () => ipcRenderer.invoke("path:documents"),
    home: () => ipcRenderer.invoke("path:home"),
  },

  shell: {
    openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
  },

  pdf: {
    /** Prints the CURRENT document to `outPath`. The @media print rules decide
     *  what lands on the page (only the invoice). Chromium paginates A4.
     *  `title` goes into the PDF's metadata. */
    toFile: (outPath, title) => ipcRenderer.invoke("pdf:toFile", outPath, title),
  },

  window: {
    isFullscreen: () => ipcRenderer.invoke("win:isFullscreen"),
    /** Subscribe to fullscreen changes. Returns an unsubscribe fn. */
    onFullscreen: (cb) => {
      const fn = (_e, value) => cb(value);
      ipcRenderer.on("win:fullscreen", fn);
      return () => ipcRenderer.off("win:fullscreen", fn);
    },
  },

  menu: {
    /** Native menu clicks arrive here. Returns an unsubscribe fn. */
    onAction: (cb) => {
      const fn = (_e, action) => cb(action);
      ipcRenderer.on("menu-action", fn);
      return () => ipcRenderer.off("menu-action", fn);
    },
  },
});
