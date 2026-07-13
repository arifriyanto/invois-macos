"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CURRENCY_SYMBOLS } from "@/lib/format";
import { toMajor, toMinor } from "@/lib/money";
import type { Currency } from "@/lib/types";

// Parse a raw input string into a clean numeric value + a grouped display text.
// IDR: integer only, "." thousands separator (Indonesian convention).
// Others: "," thousands + optional "." decimal (up to 2 places).
//
// `value` here is DECIMAL (19.99), because that is what the user typed and what
// the text has to show. The component converts it to minor units at its edge —
// see the note on CurrencyInputProps.value. This function is the inner,
// text-shaped half and deliberately knows nothing about minor units.
function build(raw: string, currency: Currency): { text: string; value: number } {
  const allowDecimal = currency !== "IDR";
  const groupSep = currency === "IDR" ? "." : ",";

  let digits = raw.replace(/[^\d.]/g, "");
  if (!allowDecimal) {
    // No decimals (IDR): "." is the thousands separator, so strip every dot —
    // the display ("1.234.567") must round-trip back to pure digits.
    digits = digits.replace(/\./g, "");
  } else {
    // Keep only the first "." as the decimal separator (rest are grouping).
    const i = digits.indexOf(".");
    if (i >= 0) digits = digits.slice(0, i + 1) + digits.slice(i + 1).replace(/\./g, "");
  }

  const hasDot = allowDecimal && digits.includes(".");
  let [intPart = "", decPart = ""] = digits.split(".");
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (hasDot) decPart = decPart.slice(0, 2);

  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep);
  let text = groupedInt || (hasDot ? "0" : "");
  if (hasDot) text += "." + decPart;

  const numStr = (intPart || "0") + (hasDot && decPart ? "." + decPart : "");
  const value = parseFloat(numStr) || 0;
  return { text, value };
}

interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  /** INTEGER minor units — 1999, not 19.99. This field is one of the two borders
   *  where money changes representation (lib/format.ts formatMoney is the other),
   *  so the decimal the user types lives inside this component and nowhere else. */
  value: number;
  /** Called with INTEGER minor units. */
  onValueChange: (minor: number) => void;
  currency: Currency;
}

export function CurrencyInput({
  value,
  onValueChange,
  currency,
  className,
  placeholder,
  ...rest
}: CurrencyInputProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const ref = React.useRef<HTMLInputElement>(null);

  // minor (1999) → the grouped text the field shows ("1,999" / "19.99").
  const textOf = React.useCallback(
    (minor: number) => (minor ? build(String(toMajor(minor, currency)), currency).text : ""),
    [currency]
  );

  const [text, setText] = React.useState(() => textOf(value));

  // Resync display when value or currency changes from outside. On a currency
  // switch we ALWAYS reformat (the separators differ even when the number is
  // identical, e.g. "1,234,567" → "1.234.567"); on a value change we only
  // reformat if the number actually differs, so mid-edit typing is untouched.
  //
  // The comparison happens in MINOR units on both sides. Comparing decimals here
  // would reintroduce the exact bug this change removes: the text "19.99" parses
  // to a double that is not equal to the double the store holds, the guard fires
  // on every keystroke, and the field rewrites itself under the caret.
  const prevCurrency = React.useRef(currency);
  React.useEffect(() => {
    const currencyChanged = prevCurrency.current !== currency;
    prevCurrency.current = currency;
    const typedMinor = toMinor(build(text, currency).value, currency);
    if (currencyChanged || value !== typedMinor) {
      setText(textOf(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency]);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;

    // "Significant" chars anchor the caret. The grouping separator must NOT
    // count (it shifts as digits are added) — for IDR that's the dot, so we
    // count digits only; for decimal currencies the dot is meaningful.
    const sig = currency === "IDR" ? /[0-9]/ : /[0-9.]/;
    let sigLeft = 0;
    const left = raw.slice(0, caret);
    for (let i = 0; i < left.length; i += 1) if (sig.test(left[i])) sigLeft += 1;

    const { text: newText, value: num } = build(raw, currency);
    setText(newText);
    onValueChange(toMinor(num, currency));

    // Restore caret after React commits, counting past group separators.
    requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      let pos = 0;
      let seen = 0;
      while (pos < newText.length && seen < sigLeft) {
        if (sig.test(newText[pos])) seen += 1;
        pos += 1;
      }
      try {
        node.setSelectionRange(pos, pos);
      } catch {
        /* ignore */
      }
    });
  };

  // Copy/cut without the thousands separators, so pasting elsewhere yields a
  // clean number ("1234567", not "1.234.567"). The decimal point is preserved.
  const groupSep = currency === "IDR" ? "." : ",";
  const stripGroup = (s: string) => s.split(groupSep).join("");

  const handleCopy = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = start === end ? el.value : el.value.slice(start, end);
    e.clipboardData.setData("text/plain", stripGroup(selected));
    e.preventDefault();
  };

  const handleCut = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    e.clipboardData.setData("text/plain", stripGroup(el.value.slice(start, end)));
    e.preventDefault();
    const raw = el.value.slice(0, start) + el.value.slice(end);
    const r = build(raw, currency);
    setText(r.text);
    onValueChange(toMinor(r.value, currency));
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
        {sym}
      </span>
      <input
        ref={ref}
        type="text"
        inputMode={currency === "IDR" ? "numeric" : "decimal"}
        autoComplete="off"
        data-1p-ignore=""
        data-lpignore="true"
        data-form-type="other"
        value={text}
        placeholder={placeholder ?? "0"}
        onChange={handle}
        onCopy={handleCopy}
        onCut={handleCut}
        className={cn(
          "h-9 w-full min-w-0 rounded-md border border-input bg-transparent py-1 pr-3 text-base shadow-xs outline-none transition-[color,box-shadow] tabular-nums md:text-sm",
          "placeholder:text-muted-foreground/60",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          sym.length > 1 ? "pl-9" : "pl-7",
          className
        )}
        {...rest}
      />
    </div>
  );
}
