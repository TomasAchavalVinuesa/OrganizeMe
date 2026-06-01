import {
  Camera,
  LogOut,
  Mail,
  Save,
  Scale,
  Upload,
  UserRound,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

type ModuloAjustesCuentaProps = {
  isLoggingOut: boolean
  logoutError: string | null
  onDataChanged: () => void
  onLogout: () => void
  user: User
}

type AccountProfile = {
  apellidos: string
  avatar_url: string
  nombre: string
}

type NutritionProfile = {
  altura_cm: number
  edad: number
  peso_kg: number
}

type AccountFormState = {
  alturaCm: string
  apellidos: string
  avatarUrl: string
  edad: string
  nombre: string
  pesoKg: string
}

const inputClassName =
  'min-h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300/65 focus:ring-4 focus:ring-sky-300/15 sm:text-sm'

function ModuloAjustesCuenta({
  isLoggingOut,
  logoutError,
  onDataChanged,
  onLogout,
  user,
}: ModuloAjustesCuentaProps) {
  const [form, setForm] = useState<AccountFormState>(() =>
    createDefaultAccountForm(user),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchAccountData = useCallback(async () => {
    const [accountResponse, nutritionResponse] = await Promise.all([
      supabase
        .from('cuenta_perfiles')
        .select('nombre, apellidos, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('nutricion_perfiles')
        .select('edad, peso_kg, altura_cm')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (accountResponse.error) {
      throw new Error(accountResponse.error.message)
    }

    if (nutritionResponse.error) {
      throw new Error(nutritionResponse.error.message)
    }

    const accountProfile = normalizeAccountProfile(accountResponse.data)
    const nutritionProfile = normalizeNutritionProfile(nutritionResponse.data)

    setForm({
      nombre:
        accountProfile.nombre ||
        readMetadataString(user.user_metadata.nombre) ||
        readMetadataString(user.user_metadata.first_name) ||
        '',
      apellidos:
        accountProfile.apellidos ||
        readMetadataString(user.user_metadata.apellidos) ||
        readMetadataString(user.user_metadata.last_name) ||
        '',
      avatarUrl:
        accountProfile.avatar_url ||
        readMetadataString(user.user_metadata.avatar_url) ||
        '',
      edad: String(
        nutritionProfile.edad || readMetadataNumber(user.user_metadata.edad) || 30,
      ),
      pesoKg: String(
        nutritionProfile.peso_kg ||
          readMetadataNumber(user.user_metadata.peso_kg) ||
          70,
      ),
      alturaCm: String(
        nutritionProfile.altura_cm ||
          readMetadataNumber(user.user_metadata.altura_cm) ||
          170,
      ),
    })
  }, [user])

  useEffect(() => {
    let isMounted = true

    const loadAccountData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        await fetchAccountData()
      } catch (issue) {
        if (!isMounted) {
          return
        }

        setError(
          issue instanceof Error
            ? issue.message
            : 'No pudimos cargar los ajustes de cuenta.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadAccountData()

    return () => {
      isMounted = false
    }
  }, [fetchAccountData])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setMutationError(null)
    setSuccessMessage(null)
    setIsUploadingAvatar(true)

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Selecciona un archivo de imagen.')
      }

      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${user.id}/${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      setForm((currentForm) => ({
        ...currentForm,
        avatarUrl: data.publicUrl,
      }))
      setSuccessMessage('Foto lista para guardar.')
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos subir la foto.',
      )
    } finally {
      setIsUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleSaveAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const payload = buildAccountPayload(form, user.id)
      const nutritionPayload = buildNutritionPayload(form, user.id)

      const { error: accountError } = await supabase
        .from('cuenta_perfiles')
        .upsert(payload, { onConflict: 'user_id' })

      if (accountError) {
        throw new Error(accountError.message)
      }

      const { error: nutritionError } = await supabase
        .from('nutricion_perfiles')
        .upsert(nutritionPayload, { onConflict: 'user_id' })

      if (nutritionError) {
        throw new Error(nutritionError.message)
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          nombre: payload.nombre,
          apellidos: payload.apellidos,
          avatar_url: payload.avatar_url,
          edad: nutritionPayload.edad,
          peso_kg: nutritionPayload.peso_kg,
          altura_cm: nutritionPayload.altura_cm,
        },
      })

      if (metadataError) {
        throw new Error(metadataError.message)
      }

      onDataChanged()
      setSuccessMessage('Ajustes guardados.')
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos guardar los ajustes.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const displayName =
    [form.nombre, form.apellidos].filter((value) => value.trim()).join(' ') ||
    user.email ||
    'Cuenta'

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {mutationError ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {mutationError}
        </div>
      ) : null}

      {logoutError ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {logoutError}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <AvatarPreview name={displayName} url={form.avatarUrl} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
                Ajustes de cuenta
              </p>
              <h3 className="mt-2 truncate text-xl font-semibold text-white sm:text-2xl">
                {displayName}
              </h3>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                <Mail className="h-4 w-4" />
                {user.email ?? 'Sin email visible'}
              </p>
            </div>
          </div>

          <button
            className="hidden items-center justify-center gap-2 self-start rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70 md:inline-flex"
            disabled={isLoggingOut}
            onClick={onLogout}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}
          </button>
        </div>
      </section>

      <form
        className="grid gap-6 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.25fr)]"
        onSubmit={handleSaveAccount}
      >
        <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-sky-200" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
                Foto de perfil
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Imagen de cuenta
              </h3>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-4">
            <AvatarPreview large name={displayName} url={form.avatarUrl} />
            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
              <Upload className="h-4 w-4" />
              {isUploadingAvatar ? 'Subiendo...' : 'Subir foto'}
              <input
                accept="image/*"
                className="sr-only"
                disabled={isUploadingAvatar}
                onChange={(event) => {
                  void handleAvatarUpload(event)
                }}
                type="file"
              />
            </label>
            <input
              className={inputClassName}
              name="avatarUrl"
              onChange={handleInputChange}
              placeholder="URL de foto"
              value={form.avatarUrl}
            />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
          <div className="flex items-center gap-3">
            <UserRound className="h-5 w-5 text-sky-200" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
                Datos personales
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Informacion del usuario
              </h3>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/45 p-5 text-sm text-slate-300">
              Cargando ajustes...
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Nombre
                  </span>
                  <input
                    className={inputClassName}
                    name="nombre"
                    onChange={handleInputChange}
                    placeholder="Nombre"
                    value={form.nombre}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Apellidos
                  </span>
                  <input
                    className={inputClassName}
                    name="apellidos"
                    onChange={handleInputChange}
                    placeholder="Apellidos"
                    value={form.apellidos}
                  />
                </label>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <Scale className="h-5 w-5 text-emerald-200" />
                  <p className="text-sm font-semibold text-white">
                    Datos corporales
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Edad
                    </span>
                    <input
                      required
                      className={inputClassName}
                      min="1"
                      name="edad"
                      onChange={handleInputChange}
                      type="number"
                      value={form.edad}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Peso kg
                    </span>
                    <input
                      required
                      className={inputClassName}
                      min="1"
                      name="pesoKg"
                      onChange={handleInputChange}
                      step="0.1"
                      type="number"
                      value={form.pesoKg}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Altura cm
                    </span>
                    <input
                      required
                      className={inputClassName}
                      min="1"
                      name="alturaCm"
                      onChange={handleInputChange}
                      step="0.1"
                      type="number"
                      value={form.alturaCm}
                    />
                  </label>
                </div>
              </div>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSaving}
                type="submit"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Guardando...' : 'Guardar ajustes'}
              </button>
            </div>
          )}
        </section>
      </form>

      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70 md:hidden"
        disabled={isLoggingOut}
        onClick={onLogout}
        type="button"
      >
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}
      </button>
    </div>
  )
}

type AvatarPreviewProps = {
  large?: boolean
  name: string
  url: string
}

function AvatarPreview({ large = false, name, url }: AvatarPreviewProps) {
  const sizeClassName = large ? 'h-36 w-36 text-4xl' : 'h-20 w-20 text-2xl'
  const initials = createInitials(name)

  if (url) {
    return (
      <img
        alt={`Foto de ${name}`}
        className={`${sizeClassName} shrink-0 rounded-full border border-white/15 object-cover shadow-[0_16px_36px_rgba(15,23,42,0.32)]`}
        src={url}
      />
    )
  }

  return (
    <div
      className={`${sizeClassName} flex shrink-0 items-center justify-center rounded-full border border-sky-300/25 bg-sky-300/12 font-semibold text-sky-100 shadow-[0_16px_36px_rgba(56,189,248,0.12)]`}
    >
      {initials}
    </div>
  )
}

function createDefaultAccountForm(user: User): AccountFormState {
  return {
    nombre: readMetadataString(user.user_metadata.nombre) ?? '',
    apellidos: readMetadataString(user.user_metadata.apellidos) ?? '',
    avatarUrl: readMetadataString(user.user_metadata.avatar_url) ?? '',
    edad: String(readMetadataNumber(user.user_metadata.edad) || 30),
    pesoKg: String(readMetadataNumber(user.user_metadata.peso_kg) || 70),
    alturaCm: String(readMetadataNumber(user.user_metadata.altura_cm) || 170),
  }
}

function normalizeAccountProfile(value: unknown): AccountProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      nombre: '',
      apellidos: '',
      avatar_url: '',
    }
  }

  const row = value as Record<string, unknown>
  return {
    nombre: readMetadataString(row.nombre) ?? '',
    apellidos: readMetadataString(row.apellidos) ?? '',
    avatar_url: readMetadataString(row.avatar_url) ?? '',
  }
}

function normalizeNutritionProfile(value: unknown): NutritionProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      edad: 0,
      peso_kg: 0,
      altura_cm: 0,
    }
  }

  const row = value as Record<string, unknown>
  return {
    edad: readMetadataNumber(row.edad) || 0,
    peso_kg: readMetadataNumber(row.peso_kg) || 0,
    altura_cm: readMetadataNumber(row.altura_cm) || 0,
  }
}

function buildAccountPayload(form: AccountFormState, userId: string) {
  return {
    user_id: userId,
    nombre: form.nombre.trim(),
    apellidos: form.apellidos.trim(),
    avatar_url: form.avatarUrl.trim(),
  }
}

function buildNutritionPayload(form: AccountFormState, userId: string) {
  const edad = Number.parseInt(form.edad, 10)
  const pesoKg = Number.parseFloat(form.pesoKg)
  const alturaCm = Number.parseFloat(form.alturaCm)

  if (!Number.isFinite(edad) || edad <= 0) {
    throw new Error('Ingresa una edad valida.')
  }

  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    throw new Error('Ingresa un peso valido.')
  }

  if (!Number.isFinite(alturaCm) || alturaCm <= 0) {
    throw new Error('Ingresa una altura valida.')
  }

  return {
    user_id: userId,
    edad,
    peso_kg: pesoKg,
    altura_cm: alturaCm,
  }
}

function readMetadataString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function readMetadataNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function createInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return initials || 'OM'
}

export default ModuloAjustesCuenta
