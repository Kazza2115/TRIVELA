import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  ?? 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmN3dHp6aHJzZGZ6eGlyamt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjM2MTMsImV4cCI6MjA5MTk5OTYxM30.BUfzNXfEobrz4CSeyBSj3I8To4F1eR-7AktC_kZfsO8'

export const supabaseConfigured = true

function initClient() {
  try {
    return createClient(url, key)
  } catch (e) {
    console.error('[Supabase] init error:', e)
    return null
  }
}

export const supabase = initClient()
