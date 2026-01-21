/// <reference path="../types/build.d.ts" />
// Single source of truth for client build information
// BUILD_ID is injected at build time via Vite define(__BUILD_ID__), with a fallback
// to VITE_BUILD_ID for local/dev flows that rely on .env.local generation.

// Important: Guard against ReferenceError when __BUILD_ID__ is not defined in dev.
// Using typeof avoids accessing an undeclared identifier.
export const BUILD_ID: string =
  (typeof __BUILD_ID__ !== 'undefined' ? (__BUILD_ID__ as string) : undefined) ||
  ((import.meta.env.VITE_BUILD_ID as string) || 'unknown');

