import {
  Apple,
  BarChart3,
  CalendarRange,
  Dumbbell,
  LayoutDashboard,
  Menu,
  Settings,
  X,
  Wallet,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import ModuloAjustesCuenta from '../components/ModuloAjustesCuenta'
import ModuloEntrenamiento from '../components/ModuloEntrenamiento'
import ModuloFinanzas from '../components/ModuloFinanzas'
import ModuloNutricion from '../components/ModuloNutricion'
import ModuloTiempo from '../components/ModuloTiempo'
import { useAuth } from '../context/useAuth'
import {
  formatCurrency,
  normalizeActividad,
  normalizeCuenta,
  type Actividad,
} from '../lib/dashboardModels'
import {
  formatDateLabel,
  formatTimeLabel,
  parseStoredDateTime,
  startOfDay,
} from '../lib/dateUtils'
import { supabase } from '../lib/supabaseClient'

type DashboardView =
  | 'dashboard'
  | 'tiempo'
  | 'finanzas'
  | 'entrenamiento'
  | 'nutricion'
  | 'ajustes'

type DashboardSummary = {
  cuentasTotal: number
  saldoTotal: number
  tareasHoy: Actividad[]
}

const navigationItems: Array<{
  description: string
  icon: typeof LayoutDashboard
  id: Exclude<DashboardView, 'dashboard' | 'ajustes'>
  title: string
}> = [
  {
    id: 'tiempo',
    title: 'Gestion de Tiempo',
    description: 'Calendario mensual, agenda semanal y organizador de tareas.',
    icon: CalendarRange,
  },
  {
    id: 'finanzas',
    title: 'Finanzas Personales',
    description: 'Cuentas, transacciones y metas de ahorro.',
    icon: Wallet,
  },
  {
    id: 'entrenamiento',
    title: 'Entrenamiento',
    description: 'Ejercicios, rutinas reutilizables y objetivos fisicos.',
    icon: Dumbbell,
  },
  {
    id: 'nutricion',
    title: 'Nutricion',
    description: 'Perfil, comidas, hidratacion y progreso corporal.',
    icon: Apple,
  },
]

const accountNavigationItem: {
  icon: typeof Settings
  id: Extract<DashboardView, 'ajustes'>
  title: string
} = {
  id: 'ajustes',
  title: 'Ajustes de cuenta',
  icon: Settings,
}

const initialSummary: DashboardSummary = {
  cuentasTotal: 0,
  saldoTotal: 0,
  tareasHoy: [],
}

function Home() {
  const { logout, user } = useAuth()
  const [activeView, setActiveView] = useState<DashboardView>('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    return window.innerWidth >= 1024
  })
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (!user) {
      return
    }

    let isMounted = true

    const loadSummary = async () => {
      setSummaryLoading(true)
      setSummaryError(null)

      const todayStart = startOfDay(new Date())
      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(todayStart.getDate() + 1)

      const [cuentasResponse, actividadesResponse] = await Promise.all([
        supabase.from('cuentas').select('*').eq('user_id', user.id),
        supabase
          .from('actividades')
          .select('*')
          .eq('user_id', user.id)
          .eq('oculta_calendarios', false)
          .gte('fecha_inicio', todayStart.toISOString())
          .lt('fecha_inicio', tomorrowStart.toISOString())
          .order('fecha_inicio', { ascending: true }),
      ])

      if (!isMounted) {
        return
      }

      if (cuentasResponse.error) {
        setSummaryError(cuentasResponse.error.message)
        setSummaryLoading(false)
        return
      }

      if (actividadesResponse.error) {
        setSummaryError(actividadesResponse.error.message)
        setSummaryLoading(false)
        return
      }

      const cuentas = (cuentasResponse.data ?? []).map((row, index) =>
        normalizeCuenta(row, index),
      )
      const tareasHoy = (actividadesResponse.data ?? []).map((row, index) =>
        normalizeActividad(row, index),
      )

      setSummary({
        cuentasTotal: cuentas.length,
        saldoTotal: cuentas.reduce((total, cuenta) => total + cuenta.saldo_actual, 0),
        tareasHoy,
      })
      setSummaryLoading(false)
    }

    void loadSummary()

    return () => {
      isMounted = false
    }
  }, [refreshToken, user])

  const handleLogout = async () => {
    setLogoutError(null)
    setIsLoggingOut(true)

    try {
      await logout()
    } catch (logoutIssue) {
      setLogoutError(
        logoutIssue instanceof Error
          ? logoutIssue.message
          : 'No pudimos cerrar la sesion. Intentalo nuevamente.',
      )
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleDataChanged = () => {
    setRefreshToken((currentValue) => currentValue + 1)
  }

  const handleSelectView = (view: DashboardView) => {
    setActiveView(view)

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false)
    }
  }

  const sidebarVisibilityClass =
    'absolute inset-y-0 left-0 z-20 w-[min(320px,100vw)] max-w-[320px] transition-all duration-300 lg:relative lg:z-auto lg:max-w-none'

  const sidebarStateClass = isSidebarOpen
    ? 'translate-x-0 border-r border-white/10 opacity-100'
    : 'pointer-events-none -translate-x-full opacity-0 lg:w-0 lg:translate-x-0 lg:border-r-0'

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_25%),linear-gradient(160deg,_#07111f_0%,_#0f172a_42%,_#111827_100%)]">
      <div className="relative flex min-h-screen w-full overflow-hidden bg-slate-950/55 backdrop-blur-xl">
        {isSidebarOpen ? (
          <button
            aria-label="Ocultar sidebar"
            className="absolute inset-0 z-10 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
            onClick={() => {
              setIsSidebarOpen(false)
            }}
            type="button"
          />
        ) : null}

        <aside
          className={`${sidebarVisibilityClass} ${sidebarStateClass} overflow-hidden bg-[linear-gradient(180deg,rgba(8,47,73,0.55),rgba(15,23,42,0.92))] p-4 sm:p-6`}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="flex items-start justify-between gap-3 rounded-3xl border border-white/10 bg-white/8 p-5">
                <div className="flex flex-col min-w-0 items-start gap-2">
                  <button
                    className={`flex h-12 w-40 shrink-0 items-center justify-center rounded-2xl border text-lg font-black text-sky-100 shadow-[0_16px_34px_rgba(56,189,248,0.12)] transition hover:bg-sky-300/18 ${
                      activeView === 'dashboard'
                        ? 'border-sky-300/40 bg-sky-300/18'
                        : 'border-sky-300/25 bg-sky-300/12'
                    }`}
                    onClick={() => {
                      handleSelectView('dashboard')
                    }}
                    type="button"
                  >
                    Organize Me
                  </button>
                </div>

                <button
                  aria-label="Cerrar sidebar"
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/45 text-slate-200 transition hover:bg-white/10"
                  onClick={() => {
                    setIsSidebarOpen(false)
                  }}
                  type="button"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <nav className="mt-8 space-y-3">
                {navigationItems.map((item) => (
                  <SidebarNavButton
                    key={item.id}
                    active={activeView === item.id}
                    description={item.description}
                    icon={<item.icon className="h-5 w-5" />}
                    onClick={() => {
                      handleSelectView(item.id)
                    }}
                    title={item.title}
                  />
                ))}
              </nav>
            </div>

            <nav className="mt-6 border-t border-white/10 pt-4">
              <SidebarNavButton
                active={activeView === accountNavigationItem.id}
                icon={<accountNavigationItem.icon className="h-5 w-5" />}
                onClick={() => {
                  handleSelectView(accountNavigationItem.id)
                }}
                title={accountNavigationItem.title}
              />
            </nav>
          </div>
        </aside>

        <section className="flex min-w-0 w-full flex-1 flex-col">
          <header className="border-b border-white/10 px-4 py-4 sm:px-8 sm:py-5 lg:px-10">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-4">
                  {!isSidebarOpen ? (
                    <button
                      aria-label="Mostrar sidebar"
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-slate-100 transition hover:bg-white/12"
                      onClick={() => {
                        setIsSidebarOpen(true)
                      }}
                      type="button"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                  ) : null}

                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-200/70">
                      Bienvenido 
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                      {getActiveViewTitle(activeView)}
                    </h2>
                  </div>
                </div>

              </div>
            </div>
          </header>

          <div className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-6 lg:px-10">
            {logoutError ? (
              <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {logoutError}
              </div>
            ) : null}

            {activeView === 'dashboard' ? (
              <DashboardOverview
                error={summaryError}
                loading={summaryLoading}
                summary={summary}
              />
            ) : null}

            {activeView === 'tiempo' && user ? (
              <ModuloTiempo
                onDataChanged={handleDataChanged}
                userId={user.id}
              />
            ) : null}

            {activeView === 'finanzas' && user ? (
              <ModuloFinanzas
                onDataChanged={handleDataChanged}
                userId={user.id}
              />
            ) : null}

            {activeView === 'entrenamiento' && user ? (
              <ModuloEntrenamiento
                onDataChanged={handleDataChanged}
                userId={user.id}
              />
            ) : null}

            {activeView === 'nutricion' && user ? (
              <ModuloNutricion
                onDataChanged={handleDataChanged}
                userId={user.id}
              />
            ) : null}

            {activeView === 'ajustes' && user ? (
              <ModuloAjustesCuenta
                isLoggingOut={isLoggingOut}
                logoutError={logoutError}
                onDataChanged={handleDataChanged}
                onLogout={() => {
                  void handleLogout()
                }}
                user={user}
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}

type DashboardOverviewProps = {
  error: string | null
  loading: boolean
  summary: DashboardSummary
}

function DashboardOverview({
  error,
  loading,
  summary,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
                Balance disponible
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                {loading ? 'Cargando...' : formatCurrency(summary.saldoTotal)}
              </h3>
            </div>

            <div className="inline-flex items-center gap-2 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100">
              <BarChart3 className="h-4 w-4" />
              {summary.cuentasTotal} cuentas asociadas
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
            Actividades de hoy
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            {loading ? '...' : summary.tareasHoy.length}
          </h3>
        </div>
      </div>

      {error ? (
        <div className="rounded-[1.75rem] border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
              Agenda de hoy
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              {formatDateLabel(new Date(), {
                weekday: 'long',
                day: 'numeric',
              })}
            </h3>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-5 text-sm text-slate-300">
              Cargando tus actividades del dia...
            </div>
          ) : summary.tareasHoy.length > 0 ? (
            summary.tareasHoy.map((actividad) => (
              <div
                key={actividad.id}
                className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/45 p-4 md:flex-row md:items-center md:justify-between sm:p-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: resolveActivityColor(actividad) }}
                    />
                    <p className="truncate text-base font-semibold text-white">
                      {actividad.titulo}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {getActivityDisplayDescription(actividad) ||
                      'Sin descripcion adicional.'}
                  </p>
                </div>

                <div className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200 md:w-auto">
                  {getDashboardTimeLabel(actividad)}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/35 p-6 text-sm text-slate-300">
              No tienes actividades registradas para hoy todavia.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type SidebarNavButtonProps = {
  active: boolean
  description?: string
  icon: ReactNode
  onClick: () => void
  title: string
}

function SidebarNavButton({
  active,
  description,
  icon,
  onClick,
  title,
}: SidebarNavButtonProps) {
  return (
    <button
      className={`w-full rounded-3xl border p-4 text-left transition sm:p-5 ${
        active
          ? 'border-sky-300/35 bg-sky-300/12 shadow-[0_16px_40px_rgba(56,189,248,0.08)]'
          : 'border-white/10 bg-white/6 hover:bg-white/10'
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
            active
              ? 'bg-sky-300/20 text-sky-100'
              : 'bg-slate-900/60 text-slate-300'
          }`}
        >
          {icon}
        </span>
        <div>
          <p className="text-base font-semibold text-white">{title}</p>
        </div>
      </div>
      {description ? (
        <p className="mt-4 text-sm leading-6 text-slate-300">{description}</p>
      ) : null}
    </button>
  )
}

export default Home

function getActivityDisplayDescription(actividad: Actividad) {
  return (actividad.descripcion ?? '').replace(/^\[\[subtipo:.+?\]\]\n?/, '').trim()
}

function getDashboardTimeLabel(actividad: Actividad) {
  if ((actividad.descripcion ?? '').startsWith('[[subtipo:cumpleanos]]')) {
    return 'Todo el dia'
  }

  return formatTimeLabel(parseStoredDateTime(actividad.fecha_inicio))
}

function resolveActivityColor(actividad: Actividad) {
  if (actividad.color.startsWith('#')) {
    return actividad.color
  }

  if (actividad.color === 'rose' || actividad.color === 'red') {
    return '#fb7185'
  }

  if (actividad.color === 'amber' || actividad.tipo === 'recordatorio') {
    return '#f59e0b'
  }

  if (actividad.color === 'violet' || actividad.tipo === 'bloque_tiempo') {
    return '#8b5cf6'
  }

  return '#38bdf8'
}

function getActiveViewTitle(activeView: DashboardView) {
  if (activeView === 'dashboard') {
    return 'Resumen del dia'
  }

  if (activeView === 'tiempo') {
    return 'Gestion de Tiempo'
  }

  if (activeView === 'finanzas') {
    return 'Finanzas Personales'
  }

  if (activeView === 'entrenamiento') {
    return 'Entrenamiento'
  }

  if (activeView === 'nutricion') {
    return 'Nutricion'
  }

  return 'Ajustes de cuenta'
}
