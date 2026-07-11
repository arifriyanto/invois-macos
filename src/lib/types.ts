export type Currency = "IDR" | "USD" | "SGD" | "EUR" | "GBP";
export type TemplateId =
  | "minimal"
  | "bold"
  | "elegant"
  | "retro"
  | "aurora"
  | "mono";
export type DiscountType = "pct" | "flat";
export type NumReset = "yearly" | "monthly" | "never";
export type DateFormat = "long" | "dmy-long" | "dmy" | "mdy" | "ymd";

export interface BusinessSettings {
  logo: string | null;
  bizName: string;
  email: string;
  phone: string;
  address: string;
  color: string;
  /** What to show as the invoice header letterhead: the uploaded logo, or the
   * business name as text. "logo" falls back to the name when no logo is set. */
  headerBrand: "logo" | "name";
  currency: Currency;
  invPrefix: string;
  bankName: string;
  bankAccount: string;
  bankOwner: string;
  // Invoice defaults (seed each new invoice)
  paymentTermDays: number;
  defaultTaxEnabled: boolean;
  defaultTaxRate: number;
  defaultNote: string;
  // Numbering
  numPadding: number;
  numReset: NumReset; // legacy — superseded by numFormat; kept for back-compat
  /** Number format template with tokens, e.g. "{PREFIX}-{YYYY}-{SEQ}". */
  numFormat: string;
  // Format
  dateFormat: DateFormat;
  /** Absolute folder path (chosen via the OS folder picker) where PDF/PNG
   * exports are written in the desktop app. Empty = browser download. */
  exportDir: string;
  /** PDF export engine: "raster" = html2canvas→JPEG (current default, silent
   * save + auto-open), "vector" = native print sheet (crisp/selectable text). */
  pdfEngine: "raster" | "vector";
  /** Color theme = a `data-palette` value from palettes.css (applied to <html>). */
  palette: string;
}

export interface LineItem {
  id: string;
  desc: string;
  qty: number;
  price: number;
}

export interface Client {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface InvoiceData {
  number: string;
  date: string;
  due: string;
  note: string;
  client: Client;
  items: LineItem[];
  discountEnabled: boolean;
  discount: number;
  discountType: DiscountType;
  taxEnabled: boolean;
  taxRate: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export type Lang = "id" | "en";
