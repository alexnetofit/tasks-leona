import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // NUNCA cachear chamadas de API (server-side functions)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Não tentar precachear nada da pasta /api
        globIgnores: ['**/api/**'],
        // SW novo assume controle imediatamente, sem esperar fechar abas
        skipWaiting: true,
        clientsClaim: true,
        // Tamanho máximo por entry (evita PWA reclamar de bundles grandes)
        maximumFileSizeToCacheInBytes: 5_000_000,
      },
      manifest: {
        name: 'Leona Projetos',
        short_name: 'Projetos',
        description: 'Plataforma de gestão de tarefas e projetos',
        theme_color: '#7c3aed',
        background_color: '#191919',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
