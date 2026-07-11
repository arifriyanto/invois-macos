import type { BusinessSettings, Currency, InvoiceData, Lang, Totals } from "./types";
import { calcTotals, formatDate } from "./format";
import type { TFunc } from "./i18n";

export interface VisibleItem {
  id: string;
  desc: string;
  qty: number;
  price: number;
  sub: number;
}

export interface InvoiceLabels {
  invoice: string;
  from: string;
  to: string;
  dateLabel: string;
  dueLabel: string;
  dueWord: string;
  desc: string;
  qty: string;
  price: string;
  amount: string;
  subtotal: string;
  payment: string;
  paymentInfo: string;
  note: string;
  number: string;
  dueShort: string;
  dateShort: string;
  total: string;
  officialDoc: string;
  noItems: string;
  discount: string;
  tax: string;
}

export interface InvoiceView {
  color: string;
  logo: string | null;
  headerBrand: "logo" | "name";
  bizName: string;
  bizMeta: string[];
  clName: string;
  clMeta: string[];
  invNum: string;
  dateText: string;
  dueText: string;
  note: string;
  items: VisibleItem[];
  totals: Totals;
  currency: Currency;
  showDiscount: boolean;
  discountPctLabel: string;
  showTax: boolean;
  taxRate: number;
  payment: string[];
  labels: InvoiceLabels;
}

export function buildView(bk: BusinessSettings, inv: InvoiceData, t: TFunc, lang: Lang): InvoiceView {
  const visible = inv.items
    .filter((i) => i.desc || i.price > 0)
    .map((i) => ({
      id: i.id,
      desc: i.desc || "—",
      qty: i.qty,
      price: i.price,
      sub: Math.max(0, i.qty) * Math.max(0, i.price),
    }));

  const payment = [bk.bankName, bk.bankAccount, bk.bankOwner].filter(Boolean);

  const labels: InvoiceLabels = {
    invoice: t("inv.invoice"),
    from: t("inv.from"),
    to: t("inv.to"),
    dateLabel: t("inv.dateLabel"),
    dueLabel: t("inv.dueLabel"),
    dueWord: t("inv.dueWord"),
    desc: t("inv.desc"),
    qty: t("inv.qty"),
    price: t("inv.price"),
    amount: t("inv.amount"),
    subtotal: t("inv.subtotal"),
    payment: t("inv.payment"),
    paymentInfo: t("inv.paymentInfo"),
    note: t("inv.note"),
    number: t("inv.number"),
    dueShort: t("inv.dueShort"),
    dateShort: t("inv.dateShort"),
    total: t("inv.total"),
    officialDoc: t("inv.officialDoc"),
    noItems: t("inv.noItems"),
    discount: t("inv.discount"),
    tax: t("inv.tax"),
  };

  return {
    color: bk.color || "#1a1a2e",
    logo: bk.logo,
    headerBrand: bk.headerBrand,
    bizName: bk.bizName || t("inv.bizPlaceholder"),
    bizMeta: [bk.email, bk.phone, bk.address].filter(Boolean),
    clName: inv.client.name || t("inv.clientPlaceholder"),
    clMeta: [inv.client.email, inv.client.phone, inv.client.address].filter(Boolean),
    invNum: inv.number || `INV-${new Date().getFullYear()}-001`,
    dateText: formatDate(inv.date, lang, bk.dateFormat),
    dueText: formatDate(inv.due, lang, bk.dateFormat),
    note: inv.note,
    items: visible,
    totals: calcTotals(inv),
    currency: bk.currency,
    showDiscount: inv.discountEnabled,
    discountPctLabel: inv.discountType === "pct" ? ` (${inv.discount}%)` : "",
    showTax: inv.taxEnabled,
    taxRate: inv.taxRate,
    payment: payment.length ? payment : ["—"],
    labels,
  };
}
