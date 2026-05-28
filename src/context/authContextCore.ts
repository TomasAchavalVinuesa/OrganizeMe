import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type AuthCredentials = {
  email: string
  password: string
}

export type AuthContextValue = {
  isLoading: boolean
  login: (credentials: AuthCredentials) => Promise<void>
  logout: () => Promise<void>
  register: (credentials: AuthCredentials) => Promise<void>
  user: User | null
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
