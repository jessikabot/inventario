import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { setCurrency } from '../lib/format'
import { useAuth } from './AuthContext'
import type { Settings } from '../lib/types'

interface SettingsState {
  settings: Settings
  refresh: () => Promise<void>
}

const DEFAULTS: Settings = { business_name: 'Mi tienda', currency: 'Bs', default_min_stock: 3 }
const Ctx = createContext<SettingsState>({ settings: DEFAULTS, refresh: async () => {} })

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [settings, setSettings] = useState<Settings>(DEFAULTS)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('business_name, currency, default_min_stock').eq('id', 1).maybeSingle()
    if (data) {
      const s = data as Settings
      setCurrency(s.currency)
      setSettings(s)
    }
  }, [])

  useEffect(() => {
    if (profile) refresh()
  }, [profile, refresh])

  const value = useMemo(() => ({ settings, refresh }), [settings, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
