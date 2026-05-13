import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      disable: true, // Desabilitado temporariamente — SW causando página branca no Safari após lazy loading
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "pwa-icon-192.png", "pwa-icon-512.png"],
      manifest: {
        name: "Workflux",
        short_name: "Workflux",
        description: "Gestão de Campo - Workflux",
        theme_color: "#1e3a5f",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,avif,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Garante que o SW responde com index.html para qualquer rota SPA
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/_/, /^\/api\//, /^\/__/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/ucgcqexunnsrffzrfhqu\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libs
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-popover'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-excel': ['xlsx'],
          // Módulos pesados separados
          'mod-rdo': ['./src/pages/RdoForm', './src/pages/RelatorioRdo'],
          'mod-equipment': ['./src/pages/EquipmentDiaryForm', './src/pages/RelatorioEquipamento'],
          'mod-admin': ['./src/pages/AdminConfiguracoes', './src/pages/SuperAdmin'],
          'mod-relatorios': ['./src/pages/RelatoriosHome', './src/pages/RelatorioAbastecimento', './src/pages/RelatorioManutencao', './src/pages/RelatorioTransportes'],
          'mod-gestao': ['./src/pages/GestaoPessoasDashboard', './src/pages/FichaFuncionario', './src/pages/GestaoFrotasHome'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
