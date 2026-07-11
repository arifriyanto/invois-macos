// A one-shot hand-off from onboarding to the app Shell. Onboarding's final CTA
// ("Buat invoice pertama") sets an intent; the Shell reads it once on mount to
// decide where to land (e.g. straight into a fresh invoice editor) and clears it,
// so navigating back to a view later doesn't re-trigger the intent.
type BootIntent = "new-invoice" | null;

let intent: BootIntent = null;

export function setBootIntent(v: BootIntent) {
  intent = v;
}

export function takeBootIntent(): BootIntent {
  const v = intent;
  intent = null;
  return v;
}
