import { describe, expect, it } from "vitest";
import { DICTS } from "./i18n";

/**
 * The two dictionaries must stay in lockstep.
 *
 * Without this, a missing translation is INVISIBLE: `t()` falls back to the other
 * language, so a stray English string just appears mid-sentence in an Indonesian
 * UI and nobody notices until a user points at it. And `lang` also drives the
 * INVOICE's own labels, so a gap can end up in a document sent to a client.
 *
 * Cheap fence, and it does the remembering so we don't have to.
 */
describe("i18n dictionaries", () => {
  const id = Object.keys(DICTS.id).sort();
  const en = Object.keys(DICTS.en).sort();

  it("have identical keys in both languages", () => {
    expect(id.filter((k) => !DICTS.en[k])).toEqual([]); // missing in English
    expect(en.filter((k) => !DICTS.id[k])).toEqual([]); // missing in Indonesian
  });

  it("have no empty strings", () => {
    for (const [lang, dict] of Object.entries(DICTS)) {
      const blank = Object.entries(dict)
        .filter(([, v]) => !v.trim())
        .map(([k]) => `${lang}:${k}`);
      expect(blank).toEqual([]);
    }
  });

  it("only shares a string between languages on purpose", () => {
    // Indonesian borrows plenty of these words wholesale — "Email", "Total",
    // "Invoice", "Status", "Dashboard" are what an Indonesian freelancer actually
    // says. Forcing a translation would read worse, not better. So the rule is not
    // "translate everything": it is "every shared string is a decision someone
    // made", listed here. A NEW one showing up in this test means a translation
    // was forgotten, which is exactly what we want to hear about.
    const SHARED_ON_PURPOSE = new Set([
      // loanwords used as-is in Indonesian
      "f.email", "bk.logo", "set.brandLogo", "inv.invoice", "inv.subtotal", "inv.total",
      "list.total", "list.status", "list.filterStatus", "act.edit", "dlg.editItem",
      "ed.editInvoice", "nav.home", "db.outstanding", "num.custom", "set.prefix",
      "set.templateField",
      // proper nouns, codes and sample data
      "pro.title", "lang.id", "lang.en", "cur.IDR", "cur.EUR", "ph.bankAccount",
    ]);
    const shared = id.filter(
      (k) => !SHARED_ON_PURPOSE.has(k) && DICTS.id[k] === DICTS.en[k] && DICTS.id[k].length > 3,
    );
    expect(shared, `untranslated? id === en for: ${shared.join(", ")}`).toEqual([]);
  });
});
