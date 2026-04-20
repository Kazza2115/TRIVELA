import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmN3dHp6aHJzZGZ6eGlyamt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjM2MTMsImV4cCI6MjA5MTk5OTYxM30.BUfzNXfEobrz4CSeyBSj3I8To4F1eR-7AktC_kZfsO8'

// Supabase JS v2 acquires a lock during token refresh on startup.
// If the refresh request hangs, signInWithPassword waits forever.
// Clear any expired session before creating the client so it starts clean.
try {
  const key = `sb-tivcwtzzhrsdfzxirjkw-auth-token`
  const raw = localStorage.getItem(key)
  if (raw) {
    const parsed = JSON.parse(raw)
    const expiresAt: number = parsed?.expires_at ?? 0
    if (expiresAt > 0 && Date.now() / 1000 > expiresAt + 60) {
      localStorage.removeItem(key)
    }
  }
} catch {}

export const supabaseConfigured = true

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
})
