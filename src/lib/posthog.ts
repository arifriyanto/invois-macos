// Lazy PostHog loader.
//
// `import type` is erased at build time, so posthog-js is NOT part of the
// initial bundle — the library is only fetched (via dynamic import) when a
// PostHog key is configured. Keeps ~50KB of analytics JS off the critical path.
import type { PostHog } from "posthog-js";

let instance: PostHog | null = null;

/** The initialized PostHog instance, or null if analytics isn't loaded/configured. */
export function getPosthog(): PostHog | null {
  return instance;
}

/** Load + initialize PostHog once, only when a key is set. Safe to call on every load. */
export async function initPosthog(): Promise<void> {
  if (instance) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // no key => never ship/run posthog-js

  const { default: posthog } = await import("posthog-js");
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    defaults: "2026-05-30", // proper SPA pageview + pageleave for the app router
    // Privacy-first: invoice data never leaves the device.
    autocapture: false, // don't auto-capture clicks/inputs/on-screen text
    disable_session_recording: true, // never record the screen (preview holds real data)
    person_profiles: "identified_only", // no profiles for anonymous visitors
  });
  instance = posthog;
}
