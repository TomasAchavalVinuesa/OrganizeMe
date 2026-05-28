import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

function AppRoutes() {
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute isAuthenticated={user !== null}>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/login"
        element={
          <GuestRoute isAuthenticated={user !== null}>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute isAuthenticated={user !== null}>
            <Register />
          </GuestRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={user !== null ? '/' : '/login'} replace />}
      />
    </Routes>
  )
}

type RouteGuardProps = {
  children: ReactNode
  isAuthenticated: boolean
}

function ProtectedRoute({ children, isAuthenticated }: RouteGuardProps) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function GuestRoute({ children, isAuthenticated }: RouteGuardProps) {
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(82,113,255,0.28),_transparent_42%),linear-gradient(135deg,_#07111f_0%,_#0d1b2f_45%,_#111827_100%)] px-6 py-10 text-slate-100">
      <div className="flex w-full max-w-md flex-col items-center rounded-[2rem] border border-white/10 bg-white/8 p-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <span className="mb-5 h-14 w-14 animate-spin rounded-full border-4 border-sky-300/25 border-t-sky-300" />
        <p className="text-sm font-medium uppercase tracking-[0.32em] text-sky-200/80">
          OrganizeMe
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Preparando tu espacio
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Estamos verificando tu sesion para llevarte directo a tu panel.
        </p>
      </div>
    </main>
  )
}

export default App
