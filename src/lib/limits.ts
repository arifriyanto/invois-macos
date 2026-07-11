// Free-tier limits (see invois-app/docs/free-vs-pro-plan.md). Enforced at the
// call sites that create new records, which open the upgrade popup instead when
// a free user is at the limit. Pro (isPro) removes both caps.

/** Max invoices a free user can SAVE. Creating a new one past this gates to Pro.
 *  Existing invoices are never hidden/deleted — only new creation is blocked. */
export const FREE_INVOICE_LIMIT = 3;

/** Max businesses/vaults a free user can register. A 2nd one gates to Pro.
 *  (Relocating the single vault is not "adding" — that stays free.) */
export const FREE_VAULT_LIMIT = 1;
