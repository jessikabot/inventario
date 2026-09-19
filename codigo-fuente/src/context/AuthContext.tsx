import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import type { Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  notice: string
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [booting, setBooting] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const loadProfile = useCallback(async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    const p = data as Profile | null
    if (!p) {
      setNotice('Tu usuario todavía no tiene un perfil en el sistema. Habla con el administrador.')
      setProfile(null)
      await supabase.auth.signOut()
    } else if (!p.active) {
      setNotice('Tu cuenta está desactivada. Habla con el administrador.')
      setProfile(null)
      await supabase.auth.signOut()
    } else {
      setProfile(p)
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setLoadingProfile(false)
      return
    }
    setLoadingProfile(true)
    loadProfile(userId).finally(() => setLoadingProfile(false))
  }, [userId, loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    setNotice('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return error ? friendlyError(error) : null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId)
  }, [userId, loadProfile])

  const value = useMemo(
    () => ({ session, profile, loading: booting || loadingProfile, notice, signIn, signOut, refreshProfile }),
    [session, profile, booting, loadingProfile, notice, signIn, signOut, refreshProfile],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fuera de AuthProvider')
  return v
}
