import { createClient } from '@supabase/supabase-js'

declare global {
  interface Window {
    APP_CONFIG?: { SUPABASE_URL?: string; SUPABASE_KEY?: string }
  }
}

const cfg = window.APP_CONFIG ?? {}
const url = String(cfg.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').trim()
const key = String(cfg.SUPABASE_KEY || import.meta.env.VITE_SUPABASE_KEY || '').trim()

export const isConfigured =
  /^https?:\/\/.+/.test(url) && !url.includes('PEGA_AQUI') && key.length > 20 && !key.includes('PEGA_AQUI')

export const supabase = createClient(
  isConfigured ? url : 'https://placeholder.supabase.co',
  isConfigured ? key : 'placeholder-key-placeholder-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
)

export const BUCKET = 'product-images'

export function imageUrl(path?: string | null): string | null {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
