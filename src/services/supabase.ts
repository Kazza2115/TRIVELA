import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

function initClient() {
  if (!supabaseConfigured) return null
  try {
    return createClient(url!, key!)
  } catch (e) {
    console.error('[Supabase] init error:', e)
    return null
  }
}

export const supabase = initClient()
