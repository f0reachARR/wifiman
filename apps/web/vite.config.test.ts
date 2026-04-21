import { describe, expect, it } from 'vitest';
import { vitePwaOptions } from './vite.config.js';

describe('vite PWA config', () => {
  it('SPA navigation fallback を明示している', () => {
    expect(vitePwaOptions.workbox.navigateFallback).toBe('/index.html');
    expect(vitePwaOptions.workbox.navigateFallbackDenylist).toEqual([/^\/api\//]);
  });
});
