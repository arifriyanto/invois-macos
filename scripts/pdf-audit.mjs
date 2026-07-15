// Audit a PDF's STRUCTURE — settle "is it tagged / vector / how many pages",
// with the file's own bytes instead of anyone's memory.
//
//   node scripts/pdf-audit.mjs "path/to/invoice.pdf"
//   node scripts/pdf-audit.mjs "electron.pdf" "tauri.pdf"   # compare two
//
// WHY THIS EXISTS: the Electron-vs-Tauri argument turned on a claim — "WKWebView's
// createPDF can't produce a TAGGED PDF" — that had never been checked against a
// real export, only asserted (and an earlier related claim, "it's raster", turned
// out to be wrong). This script makes the question falsifiable: run it on a PDF
// from each build and read the answer off the bytes.
//
// THREE things it reports, and what each one means:
//
//   TAGGED   — does the document carry a logical structure tree (StructTreeRoot +
//              MarkInfo/Marked true), the thing a screen reader walks and the thing
//              App Store accessibility review looks for. Chromium's printToPDF sets
//              generateTaggedPDF; WKWebView's WKPDFConfiguration has no such option.
//   TEXT     — is there real, selectable text (BT…ET text objects with Tj/TJ show
//              operators), as opposed to a page that is one big image. This is the
//              "can the client copy the amount" question.
//   PAGES    — how many page objects. A slice-and-merge pipeline (Tauri) and a
//              native paginator (Chromium) can both produce many pages; this is
//              just a sanity read.
//
// HOW: brute force over the raw bytes — inflate every stream and scan. This mirrors
// scripts/pdf-fonts.mjs on purpose: `strings` sees nothing (PDF cross-reference and
// content is compressed) and pdf-lib could not parse Chromium's object streams, so
// we decompress everything ourselves and look at the ground truth.

import { readFile } from "node:fs/promises";
import { inflateSync, inflateRawSync } from "node:zlib";

const files = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (files.length === 0) {
  console.error('usage: node scripts/pdf-audit.mjs "<file.pdf>" ["<second.pdf>"]');
  process.exit(1);
}

/** Concatenate the raw file text plus every inflated stream, so a marker is found
 *  whether it sits in the trailer, an object stream, or a content stream. */
function expand(buf) {
  const parts = [buf.toString("latin1")];
  let pos = 0;
  for (;;) {
    const s = buf.indexOf("stream", pos);
    if (s === -1) break;
    if (buf.subarray(Math.max(0, s - 3), s).toString("latin1") === "end") {
      pos = s + 6;
      continue;
    }
    const e = buf.indexOf("endstream", s);
    if (e === -1) break;
    let start = s + 6;
    if (buf[start] === 0x0d) start++;
    if (buf[start] === 0x0a) start++;
    const body = buf.subarray(start, e);
    let out = null;
    for (const fn of [inflateSync, inflateRawSync]) {
      try {
        out = fn(body);
        break;
      } catch {
        /* try the next codec, then fall back to raw */
      }
    }
    parts.push((out ?? body).toString("latin1"));
    pos = e + 9;
  }
  return parts.join("\n");
}

function count(text, re) {
  return (text.match(re) ?? []).length;
}

async function audit(file) {
  const buf = await readFile(file);
  const text = expand(buf);

  // TAGGED: a structure tree the document actually points at. We want more than the
  // word appearing once — /MarkInfo with /Marked true is Chromium's explicit "this
  // is a tagged document" flag, and /StructElem nodes are the tree itself.
  const hasStructTreeRoot = /\/StructTreeRoot/.test(text);
  const markedTrue = /\/Marked\s+true/.test(text);
  const structElems = count(text, /\/StructElem/g);
  const tagged = hasStructTreeRoot && (markedTrue || structElems > 0);

  // TEXT: BT…ET is a text object; Tj/TJ paint glyphs. Either proves real text.
  const textObjects = count(text, /\bBT\b/g);
  const showOps = count(text, /\b(Tj|TJ)\b/g);
  const hasText = textObjects > 0 || showOps > 0;

  // IMAGE: an image XObject drawn on the page. Not damning on its own (logos), but a
  // page that is ALL image and NO text is a raster snapshot.
  const images = count(text, /\/Subtype\s*\/Image/g);

  // PAGES: /Type /Page (but not /Pages, the tree root).
  const pages = count(text, /\/Type\s*\/Page(?![a-zA-Z])/g);

  // Producer, for context (Chromium = "Skia/PDF", WKWebView differs).
  const prod = buf.toString("latin1").match(/\/Producer\s*\(([^)]*)\)/);

  return { file, tagged, hasStructTreeRoot, markedTrue, structElems, hasText, textObjects, showOps, images, pages, producer: prod?.[1] ?? "—" };
}

function render(r) {
  const yn = (b) => (b ? "✓ YES" : "✗ NO ");
  console.log(`\n${r.file}`);
  console.log(`  Producer : ${r.producer}`);
  console.log(`  Pages    : ${r.pages || "?"}`);
  console.log(`  ${yn(r.tagged)}  TAGGED  (StructTreeRoot=${r.hasStructTreeRoot}, Marked true=${r.markedTrue}, StructElem=${r.structElems})`);
  console.log(`  ${yn(r.hasText)}  TEXT    (text objects BT=${r.textObjects}, show ops Tj/TJ=${r.showOps})  <- selectable / copyable`);
  console.log(`  ${r.images > 0 ? "•" : " "}       IMAGE   (image XObject=${r.images})`);
}

const results = [];
for (const f of files) {
  try {
    results.push(await audit(f));
  } catch (e) {
    console.error(`\n${f}\n  could not read: ${e.message}`);
  }
}

for (const r of results) render(r);

if (results.length === 2) {
  const [a, b] = results;
  const name = (r) => r.file.split("/").pop();
  console.log(`\n${"-".repeat(60)}\nCOMPARISON`);
  console.log(`  TAGGED : ${name(a)} = ${a.tagged ? "yes" : "no"}  |  ${name(b)} = ${b.tagged ? "yes" : "no"}`);
  if (a.tagged !== b.tagged) {
    const [taggedOne, plainOne] = a.tagged ? [a, b] : [b, a];
    console.log(`\n  -> Settled by the bytes: ${name(taggedOne)} is tagged, ${name(plainOne)} is not.`);
  } else if (a.tagged && b.tagged) {
    console.log(`\n  -> Both tagged. If one of them is the Tauri export, the "Tauri is untagged" claim is wrong.`);
  } else {
    console.log(`\n  -> Neither is tagged. If one is the Electron export, its build is off (generateTaggedPDF should be on).`);
  }
}

console.log();
