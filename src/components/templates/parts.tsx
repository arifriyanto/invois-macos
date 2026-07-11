import * as React from "react";
import { formatCurrency } from "@/lib/format";
import { mix, readableOn } from "@/lib/color";
import type { InvoiceView } from "@/lib/view";

export const accent = (color: string): React.CSSProperties =>
  ({
    // Fixed base text colour so the invoice is palette-independent: without this
    // the body text inherits the app's `--foreground` (which changes per palette
    // and goes light on a dark theme, vanishing on the white page).
    color: "#1a1a2e",
    ["--inv-accent" as string]: color,
    ["--inv-on-accent" as string]: readableOn(color),
    // Secondary accent for gradients (blend toward violet). Computed in JS as a
    // concrete hex so html2canvas can render it on export (color-mix is unsupported).
    ["--inv-accent-2" as string]: mix(color, "#7c5cff", 0.55),
  } as React.CSSProperties);

export function MetaLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <React.Fragment key={i}>
          {l}
          {i < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </>
  );
}

export function NoteLines({ text }: { text: string }) {
  return <MetaLines lines={text.split("\n")} />;
}

export function Logo({ view }: { view: InvoiceView }) {
  // eslint-disable-next-line @next/next/no-img-element
  return view.logo ? <img src={view.logo} className="inv-logo" alt="logo" /> : null;
}

export function ItemsTable({ view, last }: { view: InvoiceView; last: string }) {
  const { items, currency, labels } = view;
  return (
    <>
      <div className="inv-items-header">
        <div>{labels.desc}</div>
        <div>{labels.qty}</div>
        <div className="col-right">{labels.price}</div>
        <div className="col-right">{last}</div>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "16px 0", color: "#6f6f6f", fontSize: 13 }}>{labels.noItems}</div>
      ) : (
        items.map((i) => (
          <div className="inv-item-row" key={i.id}>
            <div className="inv-item-desc">{i.desc}</div>
            <div className="inv-item-qty">{i.qty}</div>
            <div className="col-right">{formatCurrency(i.price, currency)}</div>
            <div className="col-right">{formatCurrency(i.sub, currency)}</div>
          </div>
        ))
      )}
    </>
  );
}

export function SummaryTable({ view }: { view: InvoiceView }) {
  const { totals, currency, labels } = view;
  return (
    <div className="inv-summary-table">
      <div className="inv-summary-row">
        <span>{labels.subtotal}</span>
        <span>{formatCurrency(totals.subtotal, currency)}</span>
      </div>
      {view.showDiscount && (
        <div className="inv-summary-row">
          <span>{labels.discount}{view.discountPctLabel}</span>
          <span>− {formatCurrency(totals.discount, currency)}</span>
        </div>
      )}
      {view.showTax && (
        <div className="inv-summary-row">
          <span>{labels.tax} ({view.taxRate}%)</span>
          <span>{formatCurrency(totals.tax, currency)}</span>
        </div>
      )}
      <div className="inv-summary-row total">
        <span>{labels.total}</span>
        <span>{formatCurrency(totals.total, currency)}</span>
      </div>
    </div>
  );
}

export function AddressColumns({ view }: { view: InvoiceView }) {
  return (
    <>
      <div className="inv-from">
        <div className="inv-addr-label">{view.labels.from}</div>
        <div className="inv-addr-name">{view.bizName}</div>
        {view.bizMeta.length > 0 && (
          <div className="inv-addr-detail">
            <MetaLines lines={view.bizMeta} />
          </div>
        )}
      </div>
      <div className="inv-to">
        <div className="inv-addr-label">{view.labels.to}</div>
        <div className="inv-addr-name">{view.clName}</div>
        {view.clMeta.length > 0 && (
          <div className="inv-addr-detail">
            <MetaLines lines={view.clMeta} />
          </div>
        )}
      </div>
    </>
  );
}

export function BizBlock({ view }: { view: InvoiceView }) {
  // Header letterhead: follow the headerBrand setting — show the logo, or the
  // business name as text. "logo" falls back to the name when none is uploaded.
  // Full sender details (and the name) live in the "From" block.
  const showLogo = view.headerBrand !== "name" && Boolean(view.logo);
  return (
    <div>
      {showLogo ? (
        <Logo view={view} />
      ) : (
        <div className="inv-biz-name">{view.bizName}</div>
      )}
    </div>
  );
}
