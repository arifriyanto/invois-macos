import { getPosthog } from "./posthog";

type Props = Record<string, string | number | boolean | null>;

/**
 * Fire a custom product‑analytics event. PostHog only, and only when a
 * `NEXT_PUBLIC_POSTHOG_KEY` is configured — otherwise this is a no‑op, so the
 * desktop build ships without any telemetry by default. (The web‑only Vercel
 * Analytics and Umami sinks were removed for the local‑first desktop app.)
 */
export function trackEvent(name: string, props?: Props) {
  try {
    const posthog = getPosthog();
    if (posthog?.__loaded) posthog.capture(name, props ?? undefined);
  } catch {
    /* ignore */
  }
}
