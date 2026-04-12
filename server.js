import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app  = express()
const PORT = process.env.PORT || 3000

// Serve the built Vite app (dist/)
app.use(express.static(join(__dirname, 'dist')))

// SPA fallback — toutes les routes renvoient index.html (Express v5)
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  TRIVELA — serveur démarré sur http://0.0.0.0:${PORT}`)
})
