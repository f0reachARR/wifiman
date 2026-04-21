import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';

export const vitePwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate' as const,
  manifest: {
    name: 'WiFiMan',
    short_name: 'WiFiMan',
    description: 'ロボコン会場向け WiFi 運用支援アプリ',
    theme_color: '#173f35',
    background_color: '#f7f3ea',
    display: 'standalone' as const,
    scope: '/',
    start_url: '/',
    icons: [
      {
        src: '/pwa-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [],
  },
  devOptions: {
    enabled: false,
  },
};

export default defineConfig({
  plugins: [react(), VitePWA(vitePwaOptions)],
  server: {
    host: '0.0.0.0',
    port: 4174,
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
  },
});
