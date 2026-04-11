/**
 * Chronicle registry — pure types and validation only.
 *
 * This module is intentionally free of any filesystem access so it can be
 * imported safely from API route handlers without triggering Next.js NFT
 * tracing of build-time-only paths. For path resolution, see
 * `chronicle-config.ts` (server-only).
 */

export const SUPPORTED_CHRONICLES = ["interlude"] as const;

export type Chronicle = (typeof SUPPORTED_CHRONICLES)[number];

export function isChronicle(value: string): value is Chronicle {
  return (SUPPORTED_CHRONICLES as readonly string[]).includes(value);
}
