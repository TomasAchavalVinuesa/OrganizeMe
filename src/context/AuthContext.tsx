import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import { AuthContext, type AuthCredentials } from './authContextCore'
import type { User } from '@supabase/supabase-js'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('No se pudo recuperar la sesion actual.', error.message)
      }

      if (!isMounted) {
        return
      }

      setUser(data.session?.user ?? null)
      setIsLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async ({ email, password }: AuthCredentials) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const register = async ({ email, password }: AuthCredentials) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (data.session) {
      const { error: logoutError } = await supabase.auth.signOut()

      if (logoutError) {
        throw new Error(logoutError.message)
      }
    }
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        login,
        logout,
        register,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
