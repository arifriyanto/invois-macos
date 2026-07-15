// README.md → architecture.html
//
// Satu sumber kebenaran, satu keluaran turunan. HTML-nya TIDAK boleh diedit
// tangan: kalau isi yang sama hidup di dua file, ia akan menjadi dua isi yang
// berbeda — itu cuma soal waktu, dan diagram yang salah lebih berbahaya daripada
// tidak ada diagram sama sekali.
//
//   node docs/architecture/build.mjs
//
// Mermaid dimuat dari CDN (butuh internet saat halaman DIBUKA, bukan saat
// di-build). Itu satu-satunya ketergantungan luar di sini.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(resolve(HERE, "README.md"), "utf8");

// Render Markdown seperlunya saja — heading, tabel, paragraf, blok mermaid,
// `code`, **tebal**, *miring*. Bukan parser Markdown umum, dan tidak berpura-pura
// jadi itu: ia cuma perlu cukup pintar untuk file ini.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<i>$1</i>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

const lines = md.split("\n");
const out = [];
let i = 0;
let n = 0; // penomoran diagram, untuk id unik

while (i < lines.length) {
  const line = lines[i];

  // Blok mermaid → <pre class="mermaid">, mentah, tanpa escape apa pun selain <>&
  if (line.trim() === "```mermaid") {
    const buf = [];
    i++;
    while (i < lines.length && lines[i].trim() !== "```") buf.push(lines[i++]);
    i++; // tutup fence
    out.push(`<pre class="mermaid" id="d${++n}">${esc(buf.join("\n"))}</pre>`);
    continue;
  }

  // Tabel
  if (line.startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
    const cells = (r) =>
      r
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells); // rows[1] = pemisah ---
    out.push(
      `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
        body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("") +
        `</tbody></table>`
    );
    continue;
  }

  const h = /^(#{1,6})\s+(.*)$/.exec(line);
  if (h) {
    const lvl = h[1].length;
    const id = h[2]
      .toLowerCase()
      .replace(/[^a-z0-9\s-—]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    out.push(`<h${lvl} id="${id}">${inline(h[2])}</h${lvl}>`);
    i++;
    continue;
  }

  if (line.trim() === "---") {
    out.push("<hr>");
    i++;
    continue;
  }

  if (line.trim() === "") {
    i++;
    continue;
  }

  // Paragraf: kumpulkan sampai baris kosong (Markdown melipat baris; HTML tidak)
  const para = [];
  while (i < lines.length && lines[i].trim() !== "" && !/^[|#]|^```|^---$/.test(lines[i])) {
    para.push(lines[i++]);
  }
  out.push(`<p>${inline(para.join(" "))}</p>`);
}

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invois — alur aplikasi</title>
<style>
  :root { --fg:#0b1220; --muted:#5b6577; --border:#e3e7ee; --card:#fff; --accent:#2f5fe0; }
  * { box-sizing: border-box }
  body { margin:0; background:#f2f4f8; color:var(--fg);
         font:16px/1.65 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;
         -webkit-font-smoothing:antialiased }
  main { max-width:1000px; margin:0 auto; padding:56px 24px 120px }
  h1 { font-size:32px; letter-spacing:-.02em; margin:0 0 8px }
  h2 { font-size:23px; letter-spacing:-.015em; margin:56px 0 14px; padding-top:8px }
  h3 { font-size:17px; margin:32px 0 10px }
  p { margin:14px 0; max-width:74ch }
  hr { border:0; border-top:1px solid var(--border); margin:48px 0 }
  code { font:13.5px ui-monospace,SFMono-Regular,Menlo,monospace;
         background:#e8ecf3; padding:1.5px 5px; border-radius:4px }
  a { color:var(--accent) }
  table { border-collapse:collapse; width:100%; margin:18px 0; background:var(--card);
          border:1px solid var(--border); border-radius:10px; overflow:hidden; font-size:14.5px }
  th, td { text-align:left; padding:9px 13px; border-bottom:1px solid var(--border) }
  th { background:#f7f9fc; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted) }
  tbody tr:last-child td { border-bottom:0 }
  pre.mermaid { background:var(--card); border:1px solid var(--border); border-radius:14px;
                padding:28px; margin:22px 0; overflow-x:auto; text-align:center;
                box-shadow:0 1px 3px rgba(9,20,60,.05) }
  em, i { color:var(--muted) }
</style>
</head>
<body>
<main>
${out.join("\n")}
</main>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({
    startOnLoad: true,
    theme: "base",
    themeVariables: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      fontSize: "14px",
      primaryColor: "#f2f4f8",
      primaryTextColor: "#0b1220",
      primaryBorderColor: "#c3ccdb",
      lineColor: "#8792a6",
    },
    flowchart: { curve: "basis", useMaxWidth: true },
  });
</script>
</body>
</html>
`;

writeFileSync(resolve(HERE, "architecture.html"), html);
console.log(`docs/architecture/architecture.html  —  ${n} diagram, ${(html.length / 1024).toFixed(0)} KB`);
