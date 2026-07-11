// Read an uploaded logo file into a data URL suitable for an <img>.
//
// SVGs get intrinsic width/height injected (from their viewBox) when missing.
// This was a WKWebView bug (a dimensionless SVG rendered at 0×0, i.e. the logo
// silently vanished). Chromium sizes it correctly, so this is now belt-and-
// braces — but it also keeps html2canvas (PNG export) honest, which does NOT
// reliably size such an SVG. Raster images are read as a base64 data URL.
export const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB

function svgWithDimensions(svg: string): string {
  const tag = svg.match(/<svg[^>]*>/i)?.[0];
  if (!tag) return svg;
  if (/\swidth\s*=/i.test(tag) && /\sheight\s*=/i.test(tag)) return svg; // already sized
  const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)/i);
  if (!vb) return svg;
  const w = parseFloat(vb[1]);
  const h = parseFloat(vb[2]);
  if (!w || !h) return svg;
  return svg.replace(tag, tag.replace(/<svg/i, `<svg width="${w}" height="${h}"`));
}

/** Resolves to a data URL, or rejects with Error("too-big") / Error("read-failed"). */
export function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_LOGO_BYTES) return reject(new Error("too-big"));
    const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    if (isSvg) {
      reader.onload = () => {
        const text = svgWithDimensions(String(reader.result ?? ""));
        resolve("data:image/svg+xml;utf8," + encodeURIComponent(text));
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    }
  });
}
