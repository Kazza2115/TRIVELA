import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Base configurable : '/TRIVELA/' pour GitHub Pages (défaut),
// '/' pour un domaine racine (Cloudflare Pages → définir VITE_BASE=/).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/TRIVELA/',
})
