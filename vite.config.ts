import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Identifiant unique de build → permet à l'app de détecter qu'une version plus
// récente est déployée et de proposer un rechargement (fini les versions en cache).
const BUILD_ID = Date.now().toString()

// https://vite.dev/config/
// Base configurable : '/TRIVELA/' pour GitHub Pages (défaut),
// '/' pour un domaine racine (Cloudflare Pages → définir VITE_BASE=/).
export default defineConfig({
  plugins: [
    react(),
    {
      // Écrit /version.json dans le build pour la détection de mise à jour côté client.
      name: 'trivela-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: BUILD_ID }) })
      },
    },
  ],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  base: process.env.VITE_BASE ?? '/TRIVELA/',
})
