import * as native from "@/lib/native";
// Client-only invoice export helpers.
//
// PDF is NOT here any more: Electron's printToPDF gives us a real vector PDF
// (see lib/print.tsx), so the old jsPDF raster pipeline and the pdf-lib
// metadata stamping are gone. What is left is the PNG path — which genuinely
// needs a raster of the invoice — plus the shared file-writing helpers.

const A4_PX_WIDTH = 794; // A4 @ 96dpi

// html2canvas places text slightly lower than the browser. Nudge every
// text-bearing element up in the (off-screen) clone so the raster output
// matches the on-screen preview. Tune if needed.
const PDF_TEXT_NUDGE = 5;

function onDesktop(): boolean {
  return native.isDesktop();
}

/**
 * Make sure the export folder exists right before writing. Self-heals the common
 * case where the user deleted or renamed the folder out from under us (e.g. the
 * default vault "Exports" subfolder) — we simply recreate it. Idempotent + best-
 * effort; no-op on web/dev.
 */
export async function ensureExportDir(folder: string | null): Promise<void> {
  const clean = (folder ?? "").trim().replace(/\/+$/, "");
  if (!clean || !onDesktop()) return;
  try {
    const { mkdir } = native.fs;
    await mkdir(clean, { recursive: true });
  } catch {
    /* best-effort — the write will surface any real failure */
  }
}

/**
 * First non-existing path in `folder` for `filename`: never overwrites an
 * existing file — appends " (1)", " (2)", … before the extension instead.
 * Falls back to the plain path if the fs check is unavailable.
 */
export async function uniqueFilePath(folder: string, filename: string): Promise<string> {
  const clean = folder.replace(/\/+$/, "");
  try {
    const { exists } = native.fs;
    const dot = filename.lastIndexOf(".");
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : "";
    for (let n = 0; ; n++) {
      const candidate = `${clean}/${stem}${n === 0 ? "" : ` (${n})`}${ext}`;
      if (!(await exists(candidate))) return candidate;
    }
  } catch {
    return `${clean}/${filename}`;
  }
}

/**
 * Write bytes to `dir` (an absolute folder path chosen via the OS folder picker)
 * in the desktop app, or trigger a browser download (dev/web, or when no folder
 * is set). Never overwrites — same-number exports get a " (n)" suffix. Returns
 * the final filename that was written.
 */
async function saveFile(
  filename: string,
  bytes: Uint8Array,
  mime: string,
  dir: string | null,
  openAfter = false
): Promise<string> {
  const folder = (dir ?? "").trim().replace(/\/+$/, "");
  if (folder && onDesktop()) {
    await ensureExportDir(folder); // recreate it if the user deleted/renamed it
    const fullPath = await uniqueFilePath(folder, filename);
    const { writeFile } = native.fs;
    await writeFile(fullPath, bytes);
    if (openAfter) {
      // Open the saved file with the OS default app (best-effort).
      try {
        const { openPath } = native.opener;
        await openPath(fullPath);
      } catch {
        /* opening is a nicety — never fail the export over it */
      }
    }
    return fullPath.split("/").pop() ?? filename;
  }
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

/** Render the invoice into a canvas via html2canvas (shared by PDF & PNG). */
async function renderInvoiceCanvas(
  paper: HTMLElement,
  opts: { draft?: boolean } = {}
): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_PX_WIDTH}px;background:#fff;z-index:-1;`;
  const clone = paper.cloneNode(true) as HTMLElement;
  clone.style.cssText = `position:relative;width:${A4_PX_WIDTH}px;box-shadow:none;border-radius:0;max-width:none;`;
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  clone.querySelectorAll<HTMLElement>("*").forEach((node) => {
    const hasText = Array.from(node.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0
    );
    if (hasText) {
      node.style.position = "relative";
      node.style.top = `-${PDF_TEXT_NUDGE}px`;
    }
  });

  // Export-only: in Retro, html2canvas renders the big serif "Invoice" low,
  // crowding the subtitle. Lift the title visually (no layout change, so the
  // centered header columns don't shift). Preview is untouched.
  if (clone.querySelector(".tpl-retro")) {
    // html2canvas renders the big serif "Invoice" low; lift it to keep it centered.
    const title = clone.querySelector<HTMLElement>(".inv-title");
    if (title) title.style.top = "-16px";
  }
  if (clone.querySelector(".tpl-bold")) {
    // Bold's title is even larger (48px) → renders lower, needs more lift.
    const title = clone.querySelector<HTMLElement>(".inv-title");
    if (title) title.style.top = "-18px";
    // Lift just the total's spans (export-only) so it reads centered.
    clone
      .querySelectorAll<HTMLElement>(".inv-summary-row.total > span")
      .forEach((el) => {
        el.style.top = "-8px";
      });
  }
  if (clone.querySelector(".tpl-aurora")) {
    // Aurora's big serif title renders low, crowding the invoice number below.
    // Lift it (export-only) to restore the gap.
    const title = clone.querySelector<HTMLElement>(".inv-title");
    if (title) title.style.top = "-14px";
    // Aurora's Total sits in a tall gradient pill; html2canvas renders the text
    // low. Lift just the total's spans (export-only) so it reads centered.
    clone
      .querySelectorAll<HTMLElement>(".inv-summary-row.total > span")
      .forEach((el) => {
        el.style.top = "-8px";
      });
  }

  // Draft watermark: a translucent diagonal "DRAFT" over the whole page, so an
  // export of an unsaved invoice is visibly provisional. Added after the text
  // nudges so the loop above doesn't touch it.
  if (opts.draft) {
    const wm = document.createElement("div");
    wm.textContent = "DRAFT";
    wm.style.cssText = [
      "position:absolute",
      "top:50%",
      "left:50%",
      "transform:translate(-50%,-50%) rotate(-28deg)",
      "font-family:'Sora',system-ui,-apple-system,sans-serif",
      "font-size:170px",
      "font-weight:800",
      "letter-spacing:0.08em",
      "text-transform:uppercase",
      "color:rgba(239,68,68,0.12)",
      "white-space:nowrap",
      "pointer-events:none",
      "z-index:2147483647",
    ].join(";");
    clone.appendChild(wm);
  }

  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* ignore */
  }

  // Force a reflow + a fixed settle delay so the just-applied inline offsets are
  // fully laid out before capture. The 1st export is naturally delayed by font
  // loading; later exports (fonts cached) need this explicit wait — otherwise
  // html2canvas captures before layout settles and offsets shift.
  void wrapper.offsetHeight;
  await new Promise((r) => setTimeout(r, 250));

  try {
    return await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: A4_PX_WIDTH,
      windowWidth: A4_PX_WIDTH,
    });
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ---- PNG tEXt metadata (Author/Software = "Invois") -----------------------
let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngTextChunk(keyword: string, text: string): Uint8Array {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  const txt = enc.encode(text);
  // tEXt data = keyword + NULL separator (0x00) + text.
  const data = new Uint8Array(kw.length + 1 + txt.length);
  data.set(kw, 0);
  data[kw.length] = 0;
  data.set(txt, kw.length + 1);
  const type = enc.encode("tEXt");
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(type, 4);
  out.set(data, 8);
  const crcIn = new Uint8Array(4 + data.length);
  crcIn.set(type, 0);
  crcIn.set(data, 4);
  dv.setUint32(8 + data.length, crc32(crcIn));
  return out;
}
/** Insert tEXt metadata chunks right after IHDR. Best-effort — returns the
 *  input unchanged if the bytes aren't a recognizable PNG. */
function addPngMetadata(png: Uint8Array, entries: [string, string][]): Uint8Array {
  // PNG signature (8) + IHDR chunk (4 len + 4 "IHDR" + 13 data + 4 CRC = 25).
  const insertAt = 33;
  if (png.length < insertAt || png[0] !== 0x89 || png[1] !== 0x50) return png;
  const chunks = entries.map(([k, v]) => pngTextChunk(k, v));
  const extra = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(png.length + extra);
  out.set(png.subarray(0, insertAt), 0);
  let off = insertAt;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  out.set(png.subarray(insertAt), off);
  return out;
}

export async function exportInvoicePNG(
  paper: HTMLElement,
  filename: string,
  dir: string | null = null,
  draft = false,
  openAfter = false
): Promise<string> {
  const canvas = await renderInvoiceCanvas(paper, { draft });
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png")
  );
  const raw = new Uint8Array(await blob.arrayBuffer());
  const bytes = addPngMetadata(raw, [
    ["Author", "Invois"],
    ["Software", "Invois"],
  ]);
  return saveFile(filename, bytes, "image/png", dir, openAfter);
}
