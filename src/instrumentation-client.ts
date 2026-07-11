import { initPosthog } from "@/lib/posthog";

// Client-side PostHog init (Next.js App Router). Runs once on load.
// Lazily loads posthog-js only when NEXT_PUBLIC_POSTHOG_KEY is set, so the
// library stays out of the initial bundle when analytics isn't configured.
void initPosthog();
