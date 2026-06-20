import Anthropic from "@anthropic-ai/sdk";

// The debrief pipeline runs on Sonnet 4.6 — its low latency matters for an
// interactive, voice-paced loop. Switch to "claude-opus-4-8" if you want
// maximum reasoning quality and can tolerate a bit more latency.
export const DEBRIEF_MODEL = "claude-sonnet-4-6";

/** Returns an Anthropic client, or null if no API key is configured. */
export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}
