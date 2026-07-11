function toRGB(hex: string): [number, number, number] | null {
  const c = hex.replace("#", "").trim();
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Blend two hex colors. t=0 → a, t=1 → b. Returns a concrete hex (no CSS
 *  color-mix), so html2canvas can parse it during export. */
export function mix(a: string, b: string, t: number): string {
  const ca = toRGB(a);
  const cb = toRGB(b);
  if (!ca || !cb) return a;
  const ch = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * t)
    .toString(16)
    .padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/** Pick the most readable text color (#fff or near-black) to place on a given hex background. */
export function readableOn(hex: string): string {
  const c = hex.replace("#", "").trim();
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return "#ffffff";
  const toLin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const r = toLin(parseInt(full.slice(0, 2), 16) / 255);
  const g = toLin(parseInt(full.slice(2, 4), 16) / 255);
  const b = toLin(parseInt(full.slice(4, 6), 16) / 255);
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.45 ? "#1a1a2e" : "#ffffff";
}
