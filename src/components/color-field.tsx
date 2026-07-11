"use client";
import * as React from "react";
import { Pipette } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const PRESETS = [
  "#1a1a2e", "#0f172a", "#2563eb", "#0ea5e9",
  "#059669", "#ca8a04", "#ea580c", "#dc2626",
  "#7c3aed", "#db2777",
];

function normalize(c: string) {
  let v = c.trim();
  if (v && !v.startsWith("#")) v = "#" + v;
  return v;
}

export function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  // Client-only feature detection for the EyeDropper API. useSyncExternalStore
  // returns the server snapshot (false) during the static-export prerender and
  // the client value after hydration — no effect, no setState, no hydration
  // mismatch. The API is either present or not, so there's nothing to subscribe
  // to (the subscribe callback is a no-op).
  const hasEyeDropper = React.useSyncExternalStore(
    () => () => {},
    () => "EyeDropper" in window,
    () => false,
  );

  async function pickFromScreen() {
    const Ctor = (
      window as unknown as {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    if (!Ctor) return;
    try {
      const { sRGBHex } = await new Ctor().open();
      onChange(sRGBHex);
    } catch {
      /* user cancelled — ignore */
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 font-normal">
          <span className="size-5 rounded-md border shrink-0" style={{ background: value }} />
          <span className="tabular-nums uppercase">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[216px] p-3 space-y-3 [&_.react-colorful]:!w-full [&_.react-colorful]:!h-36 [&_.react-colorful\_\_saturation]:rounded-t-md [&_.react-colorful\_\_hue]:!h-3 [&_.react-colorful\_\_hue]:rounded-b-md"
      >
        <HexColorPicker color={value} onChange={onChange} />
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(normalize(e.target.value))}
            className="uppercase"
            maxLength={7}
          />
          {hasEyeDropper && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={pickFromScreen}
              title="Ambil warna dari layar"
              className="shrink-0"
            >
              <Pipette />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={c}
              className="size-6 rounded-md border cursor-pointer transition-transform hover:scale-110"
              style={{ background: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
