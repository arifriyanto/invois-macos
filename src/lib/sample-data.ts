// Seed a single labelled example client + catalog item into a brand-new vault so
// the first-invoice walkthrough has something to pick. Records carry a "(Sample)"
// label and a `sample-` id prefix so they're easy to spot and delete. Written as
// raw store payloads BEFORE the data providers mount (called from onboarding,
// after completeOnboarding), so the stores hydrate with them.
import { getRaw, setRaw } from "./data-store";
import { toMinor } from "./money";
import type { Currency } from "./types";

const CUSTOMERS_KEY = "invois_customers";
const CATALOG_KEY = "invois_catalog";

// Rough, tidy round number per currency for the example service price, in MAJOR
// units (250 = two hundred and fifty dollars). Stored as minor units below.
const SAMPLE_PRICE: Record<Currency, number> = {
  IDR: 2_500_000,
  USD: 250,
  EUR: 250,
  GBP: 200,
  SGD: 350,
};

export function seedSampleData(currency: Currency) {
  try {
    // Never clobber existing data — only seed when both stores are empty.
    const hasCustomers = (getRaw(CUSTOMERS_KEY) ?? "").trim().replace(/\[\s*\]/, "").length > 0;
    const hasCatalog = (getRaw(CATALOG_KEY) ?? "").trim().replace(/\[\s*\]/, "").length > 0;
    if (hasCustomers || hasCatalog) return;

    const customer = {
      id: "sample-client",
      name: "Bright Studio (Sample)",
      email: "hello@example.com",
      phone: "+1 (415) 555-0142",
      address: "123 Market Street, San Francisco, CA",
    };
    const item = {
      id: "sample-item",
      desc: "Logo design (Sample)",
      priceMinor: toMinor(SAMPLE_PRICE[currency], currency),
    };

    setRaw(CUSTOMERS_KEY, JSON.stringify([customer]));
    setRaw(CATALOG_KEY, JSON.stringify([item]));
  } catch {
    /* seeding is best-effort — never block onboarding */
  }
}
