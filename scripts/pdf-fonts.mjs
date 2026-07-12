// List the fonts inside a PDF — a licence check, not a curiosity.
//
//   npm run pdf:fonts -- "path/to/invoice.pdf"
//   npm run pdf:fonts -- "path/to/invoice.pdf" --debug
//
// WHY: Apple's fonts (SF Pro, SF Mono, Apple Color Emoji) may be used to draw the
// app on screen, but must NOT be embedded into a document the user sends to a
// client. Chromium embeds whatever the printed page actually used, and one CSS
// fallback (`system-ui`, `ui-monospace`) is enough to pull one in silently.
//
// HOW: brute force over the raw bytes, on purpose. `strings` finds nothing (PDF
// object tables are compressed) and pdf-lib could not read Chromium's object
// streams. So we inflate every stream in the file and look for fonts in TWO
// independent ways, because either one alone can miss:
//
//   1. /BaseFont and /FontName — the names the PDF *declares*.
//   2. the embedded font PROGRAM itself. A TTF/OTF carries its own name inside
//      its `name` table (often UTF-16, i.e. "R\0o\0b\0o\0t\0o"). This is the
//      ground truth: it is the actual typeface data sitting in the file, whatever
//      the dictionaries claim.

import { readFile } from "node:fs/promises";
import { inflateSync, inflateRawSync } from "node:zlib";

const [file, ...flags] = process.argv.slice(2);
const DEBUG = flags.includes("--debug");
if (!file) {
  console.error('usage: npm run pdf:fonts -- "<file.pdf>" [--debug]');
  process.exit(1);
}

const buf = await readFile(file);

const declared = new Set(); // from /BaseFont, /FontName
const programs = new Set(); // from the embedded font files' own name tables
const types = new Map(); // diagnostics: what object types we actually saw

// Faces we ship ourselves (self-hosted via next/font) — anything else is suspect.
const OURS = ["Inter", "RobotoMono", "Roboto Mono", "DMSerifDisplay", "DM Serif", "Sora"];
// Apple / system faces, under every name they turn up as.
const SYSTEM =
  /SFPro|SF Pro|SFNS|\.SF|SFMono|SF Mono|AppleSystemUIFont|Apple Color Emoji|AppleColorEmoji|LastResort|Helvetica|Menlo|Monaco|Geneva|PingFang|Hiragino|Times New Roman|Courier/i;

function scanText(text) {
  for (const m of text.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+\-_,.]+)/g)) declared.add(m[1]);
  for (const m of text.matchAll(/\/FontName\s*\/([A-Za-z0-9+\-_,.]+)/g)) declared.add(m[1]);
  for (const m of text.matchAll(/\/Type\s*\/([A-Za-z0-9]+)/g)) {
    types.set(m[1], (types.get(m[1]) ?? 0) + 1);
  }
}

// A font program's `name` table stores strings in UTF-16BE — so "Sora" appears as
// S\0o\0r\0a. Stripping NULs makes both encodings searchable with one pass.
function scanFontProgram(bytes) {
  const flat = bytes.toString("latin1").replace(/\0/g, "");
  for (const name of [...OURS, "SF Pro", "SF Mono", ".AppleSystemUIFont", "Apple Color Emoji", "Helvetica"]) {
    if (flat.includes(name)) programs.add(name);
  }
}

scanText(buf.toString("latin1"));

let streams = 0;
let inflated = 0;
let pos = 0;
for (;;) {
  const s = buf.indexOf("stream", pos);
  if (s === -1) break;
  // "endstream" also contains "stream" — skip those hits.
  if (buf.subarray(Math.max(0, s - 3), s).toString("latin1") === "end") {
    pos = s + 6;
    continue;
  }
  const e = buf.indexOf("endstream", s);
  if (e === -1) break;
  streams++;
  let start = s + 6;
  if (buf[start] === 0x0d) start++;
  if (buf[start] === 0x0a) start++;
  const body = buf.subarray(start, e);

  let out = null;
  for (const fn of [inflateSync, inflateRawSync]) {
    try {
      out = fn(body);
      inflated++;
      break;
    } catch {
      /* try the next codec */
    }
  }
  const data = out ?? body; // not compressed → read as-is
  scanText(data.toString("latin1"));
  scanFontProgram(data);
  pos = e + 9;
}

// Metadata, since we are in the file anyway: should say Invois, not "Skia/PDF".
const meta = {};
const flat = buf.toString("latin1");
for (const key of ["Producer", "Creator", "Author", "Title"]) {
  const m = flat.match(new RegExp(`/${key}\\s*\\(([^)]*)\\)`));
  if (m) meta[key] = m[1];
}

const all = new Set([...declared, ...programs]);
const bad = [...all].filter((f) => SYSTEM.test(f));
const isEmbedded = (f) => /^[A-Z]{6}\+/.test(f) || programs.has(f);

console.log(`\n${file}`);

if (Object.keys(meta).length) {
  console.log("\nMetadata:");
  for (const [k, v] of Object.entries(meta)) {
    console.log(`  ${k === "Producer" && !/invois/i.test(v) ? "✗" : "✓"} ${k}: ${v}`);
  }
}

console.log("\nFonts declared by the PDF:");
if (declared.size) {
  for (const f of [...declared].sort()) {
    const how = /^[A-Z]{6}\+/.test(f) ? "embedded subset" : "referenced only";
    console.log(`  ${SYSTEM.test(f) ? "✗" : "✓"} ${f}  (${how})`);
  }
} else {
  console.log("  (none)");
}

console.log("\nFont programs actually found inside the file:");
if (programs.size) {
  for (const f of [...programs].sort()) console.log(`  ${SYSTEM.test(f) ? "✗" : "✓"} ${f}`);
} else {
  console.log("  (none)");
}

if (DEBUG || !all.size) {
  console.log(`\n[debug] ${streams} streams, ${inflated} inflated`);
  console.log(
    `[debug] object types seen: ${
      [...types.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join(", ") || "none"
    }`,
  );
}

console.log(
  bad.length
    ? `\n✗ FAIL — system font(s) in the file: ${bad.join(", ")}\n` +
        `  Find the CSS that fell back to system-ui / ui-monospace, or the glyph\n` +
        `  (emoji? non-Latin?) our own fonts do not cover.\n`
    : all.size
      ? `\n✓ PASS — only self-hosted fonts (${[...all].filter(isEmbedded).length} embedded).\n`
      : "\n? INCONCLUSIVE — no fonts read at all. Send Claude the [debug] lines.\n",
);
process.exit(bad.length || !all.size ? 1 : 0);
