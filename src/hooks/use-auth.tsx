import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

// F1-003 · Gate de perfil (CA-F1-01-02): a sessão sozinha NÃO dá acesso.
// O perfil (profiles.status) manda: disabled é deslogado, pending não opera,
// e falha na leitura do perfil BLOQUEIA a operação (linha vermelha).

export type ProfileStatus = 'pending' | 'active' | 'disabled'
export type UserRole = 'admin' | 'operator' | 'company' | 'driver'

export interface Profile {
  user_id: string
  role: UserRole
  status: ProfileStatus
  full_name: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  accessDenied: string | null
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null; needsEmailConfirmation?: boolean }>
  signOut: () => Promise<{ error: AuthError | null }>
  resendSignUpEmail: (email: string) => Promise<{ error: AuthError | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadProfile = async (sess: Session | null) => {
      if (!sess?.user) {
        setProfile(null)
        setLoading(false)
        return
      }

      // Leitura do perfil: fonte de verdade do acesso.
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, role, status, full_name')
        .eq('user_id', sess.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        // Falha na leitura NÃO vira acesso: bloqueia a operação explicitamente.
        setProfile(null)
        setAccessDenied(
          'Não foi possível verificar seu perfil de acesso. Por segurança, a operação fica bloqueada. Tente novamente em instantes.',
        )
        setLoading(false)
        return
      }

      if (data.status === 'disabled') {
        // Conta desativada: encerra a sessão e informa o motivo.
        setProfile(null)
        setAccessDenied(
          'Sua conta foi desativada. Fale com a administração do sistema para reativar o acesso.',
        )
        setLoading(false)
        await supabase.auth.signOut()
        return
      }

      setAccessDenied(null)
      setProfile(data as Profile)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      loadProfile(s)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      loadProfile(s)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const redirectTo = `${window.location.origin}/`
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    })
    const needsEmailConfirmation = Boolean(data?.user && !data.session)
    return { error, needsEmailConfirmation }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resendSignUpEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    return { error }
  }

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    })
    return { error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        accessDenied,
        signIn,
        signUp,
        signOut,
        resendSignUpEmail,
        resetPasswordForEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
