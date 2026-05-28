import { ShieldPlus, UserPlus } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

type RegisterFormState = {
  email: string
  password: string
}

const initialFormState: RegisterFormState = {
  email: '',
  password: '',
}

function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState<RegisterFormState>(initialFormState)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      await register(form)
      navigate('/login?registered=1', { replace: true })
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No pudimos crear la cuenta. Intentalo nuevamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(125,211,252,0.2),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.16),_transparent_30%)]" />

      <section className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 shadow-[0_30px_120px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">
        <div className="order-2 border-t border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.35),rgba(2,6,23,0.08))] p-8 lg:order-1 lg:border-t-0 lg:border-r">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">
            <ShieldPlus className="h-4 w-4" />
            Acceso seguro
          </span>

          <h1 className="mt-7 text-3xl font-semibold text-white sm:text-4xl">
            Crea tu cuenta y empieza a organizarlo todo.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">
            Tu espacio ya queda listo para sumar proximos modulos sin rehacer la
            base visual ni la autenticacion.
          </p>

          <div className="mt-8 grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
              <p className="text-sm font-medium text-white">
                Panel escalable desde el dia uno
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                El home queda preparado para integrar Tiempo y Finanzas con una
                navegacion clara y responsive.
              </p>
            </div>
          </div>
        </div>

        <div className="order-1 p-6 sm:p-8 lg:order-2 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-200/75">
              Nueva cuenta
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              Registrate
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Usa un correo valido y una contrasena de al menos 6 caracteres.
            </p>

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
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300/65 focus:bg-slate-900/70 focus:ring-4 focus:ring-sky-300/15"
                  minLength={6}
                  name="password"
                  onChange={handleChange}
                  placeholder="Crea una contrasena segura"
                  type="password"
                  value={form.password}
                />
              </label>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                <UserPlus className="h-4 w-4" />
                {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/6 p-4 text-sm text-slate-300">
              Ya tienes cuenta?{' '}
              <Link
                className="font-semibold text-sky-200 transition hover:text-sky-100"
                to="/login"
              >
                Ir al inicio de sesion
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Register
