import { LogIn, ShieldCheck } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

type LoginFormState = {
  email: string
  password: string
}

const initialFormState: LoginFormState = {
  email: '',
  password: '',
}

function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [form, setForm] = useState<LoginFormState>(initialFormState)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const showRegistrationSuccess = searchParams.get('registered') === '1'

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(form)
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No pudimos iniciar sesion. Intentalo nuevamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.25),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_32%)]" />

      <section className="relative grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 shadow-[0_30px_120px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:rounded-[2rem] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden flex-col justify-between border-r border-white/10 bg-[linear-gradient(160deg,rgba(14,116,144,0.35),rgba(2,6,23,0.1))] p-10 lg:flex">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">
              <ShieldCheck className="h-4 w-4" />
              OrganizeMe
            </span>
            <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight text-white">
              Centraliza tu rutina con una entrada segura y simple.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Inicia sesion para acceder a tu panel personal y preparar los
              modulos de tiempo y finanzas desde un solo lugar.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
              <p className="text-sm font-medium text-white">
                Vista inicial preparada
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                La navegacion ya queda lista para crecer con nuevas secciones
                sin rehacer la base de autenticacion.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full p-5 sm:p-8 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="lg:hidden">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">
                <ShieldCheck className="h-4 w-4" />
                OrganizeMe
              </span>
            </div>

            <div className="mt-6 lg:mt-0">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-200/75">
                Bienvenido
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-white sm:text-4xl">
                Inicia sesion
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Usa tu cuenta para continuar con tu espacio personal.
              </p>
            </div>

            {showRegistrationSuccess ? (
              <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Tu cuenta fue creada. Inicia sesion para entrar a tu panel.
              </div>
            ) : null}

            {error ? (
              <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Correo electronico
                </span>
                <input
                  required
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300/65 focus:bg-slate-900/70 focus:ring-4 focus:ring-sky-300/15"
                  name="email"
                  onChange={handleChange}
                  placeholder="tu@correo.com"
                  type="email"
                  value={form.email}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Contrasena
                </span>
                <input
                  required
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300/65 focus:bg-slate-900/70 focus:ring-4 focus:ring-sky-300/15"
                  minLength={6}
                  name="password"
                  onChange={handleChange}
                  placeholder="Tu contrasena"
                  type="password"
                  value={form.password}
                />
              </label>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                <LogIn className="h-4 w-4" />
                {isSubmitting ? 'Ingresando...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/6 p-4 text-sm text-slate-300">
              No tienes cuenta todavia?{' '}
              <Link
                className="font-semibold text-sky-200 transition hover:text-sky-100"
                to="/register"
              >
                Crear una ahora
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Login
