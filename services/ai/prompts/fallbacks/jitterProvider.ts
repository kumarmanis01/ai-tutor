/**
 * Local jitter provider shim for fallback logic.
 *
 * This file provides an injectable jitter provider for the fallback retry
 * logic. It's colocated with the fallback code to ensure test resolvability.
 *
 * EDIT LOG:
 * - 2026-02-05 | copilot | added local jitter provider shim
 */

export type JitterProvider = {
  random: () => number;
};

let _provider: JitterProvider = { random: () => Math.random() };

export function getJitterProvider(): JitterProvider {
  return _provider;
}

export function setJitterProvider(p: JitterProvider) {
  _provider = p;
}

export function resetJitterProvider() {
  _provider = { random: () => Math.random() };
}
