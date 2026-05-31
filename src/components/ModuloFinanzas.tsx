import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  formatCurrency,
  normalizeCuenta,
  normalizeMetaAhorro,
  normalizeTareaKanban,
  normalizeTransaccion,
  type Cuenta,
  type MetaAhorro,
  type TareaKanban,
  type Transaccion,
} from '../lib/dashboardModels'
import { formatDateLabel } from '../lib/dateUtils'
import { supabase } from '../lib/supabaseClient'

type ModuloFinanzasProps = {
  onDataChanged: () => void
  userId: string
}

type FinanzasTab = 'cuentas' | 'transacciones' | 'metas'
type GoalTab = MetaAhorro['plazo']

type AccountFormState = {
  nombre: string
  saldoActual: string
  tipo: Cuenta['tipo']
}

type TransactionFormState = {
  categoria: string
  cuentaId: string
  monto: string
  tareaId: string
  tipo: Transaccion['tipo']
}

type GoalFormState = {
  fechaLimite: string
  goalId: string | null
  montoActual: string
  montoObjetivo: string
  nombre: string
  plazo: GoalTab
}

const selectClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/65 focus:ring-4 focus:ring-sky-300/15'

const optionClassName = 'bg-slate-900 text-white'

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300/65 focus:ring-4 focus:ring-sky-300/15'

function ModuloFinanzas({ onDataChanged, userId }: ModuloFinanzasProps) {
  const [activeTab, setActiveTab] = useState<FinanzasTab>('cuentas')
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [tareasActivas, setTareasActivas] = useState<TareaKanban[]>([])
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [metas, setMetas] = useState<MetaAhorro[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [isSavingTransaction, setIsSavingTransaction] = useState(false)
  const [isSavingGoal, setIsSavingGoal] = useState(false)
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalTab, setGoalTab] = useState<GoalTab>('corto')
  const [accountForm, setAccountForm] = useState<AccountFormState>({
    nombre: '',
    tipo: 'banco',
    saldoActual: '0',
  })
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>({
    tipo: 'egreso',
    monto: '',
    categoria: '',
    cuentaId: '',
    tareaId: '',
  })
  const [goalForm, setGoalForm] = useState<GoalFormState>(createDefaultGoalForm())

  const fetchFinanceData = useCallback(async () => {
    const [cuentasResponse, tareasResponse, transaccionesResponse, metasResponse] =
      await Promise.all([
        supabase
          .from('cuentas')
          .select('*')
          .eq('user_id', userId)
          .order('nombre', { ascending: true }),
        supabase
          .from('tareas_kanban')
          .select('*')
          .eq('user_id', userId)
          .neq('columna', 'done')
          .neq('columna', 'archived')
          .order('columna', { ascending: true })
          .order('posicion', { ascending: true }),
        supabase
          .from('transacciones')
          .select('*')
          .eq('user_id', userId)
          .order('fecha', { ascending: false })
          .limit(8),
        supabase
          .from('metas_ahorro')
          .select('*')
          .eq('user_id', userId)
          .order('plazo', { ascending: true })
          .order('fecha_limite', { ascending: true }),
      ])

    if (cuentasResponse.error) {
      throw new Error(cuentasResponse.error.message)
    }

    if (tareasResponse.error) {
      throw new Error(tareasResponse.error.message)
    }

    if (transaccionesResponse.error) {
      throw new Error(transaccionesResponse.error.message)
    }

    if (metasResponse.error) {
      throw new Error(metasResponse.error.message)
    }

    const cuentasData = (cuentasResponse.data ?? []).map((row, index) =>
      normalizeCuenta(row, index),
    )

    setCuentas(cuentasData)
    setTareasActivas(
      (tareasResponse.data ?? []).map((row, index) =>
        normalizeTareaKanban(row, index),
      ),
    )
    setTransacciones(
      (transaccionesResponse.data ?? []).map((row, index) =>
        normalizeTransaccion(row, index),
      ),
    )
    setMetas(
      (metasResponse.data ?? []).map((row, index) =>
        normalizeMetaAhorro(row, index),
      ),
    )
    setTransactionForm((currentForm) => ({
      ...currentForm,
      cuentaId: currentForm.cuentaId || cuentasData[0]?.id || '',
    }))
  }, [userId])

  useEffect(() => {
    let isMounted = true

    const loadFinanceData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        await fetchFinanceData()
      } catch (issue) {
        if (!isMounted) {
          return
        }

        setError(
          issue instanceof Error
            ? issue.message
            : 'No pudimos cargar la informacion financiera.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadFinanceData()

    return () => {
      isMounted = false
    }
  }, [fetchFinanceData])

  const cuentasTotales = useMemo(() => {
    return cuentas.reduce((total, cuenta) => total + cuenta.saldo_actual, 0)
  }, [cuentas])

  const groupedGoals = useMemo(() => {
    return metas.reduce<Record<GoalTab, MetaAhorro[]>>(
      (grouped, goal) => {
        grouped[goal.plazo].push(goal)
        return grouped
      },
      { corto: [], mediano: [], largo: [] },
    )
  }, [metas])

  const handleAccountInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setAccountForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleTransactionInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setTransactionForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleGoalInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setGoalForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const refreshAll = async () => {
    await fetchFinanceData()
  }

  const openCreateGoalModal = () => {
    setMutationError(null)
    setGoalForm(createDefaultGoalForm(goalTab))
    setShowGoalModal(true)
  }

  const openEditGoalModal = (goal: MetaAhorro) => {
    setMutationError(null)
    setGoalForm({
      goalId: goal.id,
      nombre: goal.nombre,
      montoActual: String(goal.monto_actual),
      montoObjetivo: String(goal.monto_objetivo),
      plazo: goal.plazo,
      fechaLimite: goal.fecha_limite ?? '',
    })
    setShowGoalModal(true)
  }

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setIsSavingAccount(true)

    try {
      const saldoActual = Number.parseFloat(accountForm.saldoActual) || 0
      const { error: insertError } = await supabase.from('cuentas').insert({
        user_id: userId,
        nombre: accountForm.nombre.trim(),
        tipo: accountForm.tipo,
        saldo_actual: saldoActual,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      await refreshAll()
      onDataChanged()
      setAccountForm({
        nombre: '',
        tipo: 'banco',
        saldoActual: '0',
      })
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos crear la cuenta.',
      )
    } finally {
      setIsSavingAccount(false)
    }
  }

  const handleCreateTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setIsSavingTransaction(true)

    try {
      const monto = Number.parseFloat(transactionForm.monto)
      if (!Number.isFinite(monto) || monto <= 0) {
        throw new Error('Ingresa un monto valido para la transaccion.')
      }

      const account = cuentas.find((cuenta) => cuenta.id === transactionForm.cuentaId)
      if (!account) {
        throw new Error('Selecciona una cuenta disponible.')
      }

      let delta = 0
      if (transactionForm.tipo === 'ingreso') {
        delta = monto
      }
      if (transactionForm.tipo === 'egreso' || transactionForm.tipo === 'transferencia') {
        delta = -monto
      }

      const nuevoSaldo = account.saldo_actual + delta

      const { error: accountUpdateError } = await supabase
        .from('cuentas')
        .update({
          saldo_actual: nuevoSaldo,
        })
        .eq('id', account.id)
        .eq('user_id', userId)

      if (accountUpdateError) {
        throw new Error(accountUpdateError.message)
      }

      const { error: transactionInsertError } = await supabase
        .from('transacciones')
        .insert({
          user_id: userId,
          tipo: transactionForm.tipo,
          monto,
          categoria: transactionForm.categoria.trim(),
          cuenta_id: account.id,
          tarea_id: transactionForm.tareaId || null,
          fecha: new Date().toISOString(),
          es_recurrente: false,
        })

      if (transactionInsertError) {
        await supabase
          .from('cuentas')
          .update({
            saldo_actual: account.saldo_actual,
          })
          .eq('id', account.id)
          .eq('user_id', userId)

        throw new Error(transactionInsertError.message)
      }

      await refreshAll()
      onDataChanged()
      setTransactionForm({
        tipo: 'egreso',
        monto: '',
        categoria: '',
        cuentaId: account.id,
        tareaId: '',
      })
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos guardar la transaccion.',
      )
    } finally {
      setIsSavingTransaction(false)
    }
  }

  const handleSaveGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setIsSavingGoal(true)

    try {
      const payload = {
        nombre: goalForm.nombre.trim(),
        monto_objetivo: Number.parseFloat(goalForm.montoObjetivo) || 0,
        monto_actual: Number.parseFloat(goalForm.montoActual) || 0,
        plazo: goalForm.plazo,
        fecha_limite: goalForm.fechaLimite || null,
      }

      if (!payload.nombre) {
        throw new Error('Ingresa un nombre para la meta.')
      }

      if (payload.monto_objetivo <= 0) {
        throw new Error('El monto objetivo debe ser mayor que cero.')
      }

      if (goalForm.goalId) {
        const { error: updateError } = await supabase
          .from('metas_ahorro')
          .update(payload)
          .eq('id', goalForm.goalId)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: insertError } = await supabase.from('metas_ahorro').insert({
          user_id: userId,
          ...payload,
        })

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      await refreshAll()
      onDataChanged()
      setShowGoalModal(false)
      setGoalForm(createDefaultGoalForm(goalTab))
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos guardar la meta.',
      )
    } finally {
      setIsSavingGoal(false)
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    setMutationError(null)
    setDeletingGoalId(goalId)

    try {
      const { error: deleteError } = await supabase
        .from('metas_ahorro')
        .delete()
        .eq('id', goalId)
        .eq('user_id', userId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await refreshAll()
      onDataChanged()
      if (goalForm.goalId === goalId) {
        setShowGoalModal(false)
        setGoalForm(createDefaultGoalForm(goalTab))
      }
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos eliminar la meta.',
      )
    } finally {
      setDeletingGoalId(null)
    }
  }

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

      <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
              Finanzas Personales
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Cuentas, movimientos y metas con mejor gestion
            </h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <FinanzasTabButton
              active={activeTab === 'cuentas'}
              icon={<WalletCards className="h-4 w-4" />}
              label="Panel de Cuentas y Saldos"
              onClick={() => {
                setActiveTab('cuentas')
              }}
            />
            <FinanzasTabButton
              active={activeTab === 'transacciones'}
              icon={<ReceiptText className="h-4 w-4" />}
              label="Historial y Transacciones"
              onClick={() => {
                setActiveTab('transacciones')
              }}
            />
            <FinanzasTabButton
              active={activeTab === 'metas'}
              icon={<PiggyBank className="h-4 w-4" />}
              label="Metas de Ahorro"
              onClick={() => {
                setActiveTab('metas')
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/45 p-4 text-sm text-slate-300 sm:p-6">
            Cargando cuentas, transacciones y metas...
          </div>
        ) : null}
      </section>

      {!isLoading && activeTab === 'cuentas' ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
            <div className="flex items-center gap-3">
              <WalletCards className="h-5 w-5 text-sky-200" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
                  Panel de cuentas
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  {formatCurrency(cuentasTotales)}
                </h3>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {cuentas.length > 0 ? (
                cuentas.map((cuenta) => (
                  <article
                    key={cuenta.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/45 p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">
                          {cuenta.nombre}
                        </p>
                      </div>

                      <Landmark className="h-5 w-5 text-sky-200" />
                    </div>

                    <p className="mt-5 break-words text-xl font-semibold text-white sm:text-2xl">
                      {formatCurrency(cuenta.saldo_actual)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300 md:col-span-2">
                  Aun no tienes cuentas registradas.
                </div>
              )}
            </div>
          </div>

          <form
            className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6"
            onSubmit={handleCreateAccount}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
              Nueva cuenta
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Agrega efectivo, banco o billetera virtual
            </h3>

            <div className="mt-6 space-y-4">
              <input
                required
                className={inputClassName}
                name="nombre"
                onChange={handleAccountInputChange}
                placeholder="Nombre de la cuenta"
                value={accountForm.nombre}
              />
              <select
                className={selectClassName}
                name="tipo"
                onChange={handleAccountInputChange}
                value={accountForm.tipo}
              >
                <option className={optionClassName} value="efectivo">
                  Efectivo
                </option>
                <option className={optionClassName} value="banco">
                  Banco
                </option>
                <option className={optionClassName} value="billetera_virtual">
                  Billetera virtual
                </option>
              </select>
              <input
                required
                className={inputClassName}
                min="0"
                name="saldoActual"
                onChange={handleAccountInputChange}
                placeholder="Saldo inicial"
                step="0.01"
                type="number"
                value={accountForm.saldoActual}
              />
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSavingAccount}
                type="submit"
              >
                <Plus className="h-4 w-4" />
                {isSavingAccount ? 'Guardando...' : 'Crear cuenta'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {!isLoading && activeTab === 'transacciones' ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <form
            className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6"
            onSubmit={handleCreateTransaction}
          >
            <div className="flex items-center gap-3">
              {transactionForm.tipo === 'ingreso' ? (
                <ArrowUpCircle className="h-5 w-5 text-emerald-300" />
              ) : transactionForm.tipo === 'transferencia' ? (
                <ArrowRightLeft className="h-5 w-5 text-sky-300" />
              ) : (
                <ArrowDownCircle className="h-5 w-5 text-rose-300" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
                  Registro de transacciones
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  Ingresa, registra un gasto o una transferencia
                </h3>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <select
                className={selectClassName}
                name="tipo"
                onChange={handleTransactionInputChange}
                value={transactionForm.tipo}
              >
                <option className={optionClassName} value="ingreso">
                  Ingreso
                </option>
                <option className={optionClassName} value="egreso">
                  Egreso
                </option>
                <option className={optionClassName} value="transferencia">
                  Transferencia
                </option>
              </select>
              <input
                required
                className={inputClassName}
                min="0.01"
                name="monto"
                onChange={handleTransactionInputChange}
                placeholder="Monto"
                step="0.01"
                type="number"
                value={transactionForm.monto}
              />
              <input
                required
                className={inputClassName}
                name="categoria"
                onChange={handleTransactionInputChange}
                placeholder="Categoria"
                value={transactionForm.categoria}
              />
              <select
                required
                className={selectClassName}
                name="cuentaId"
                onChange={handleTransactionInputChange}
                value={transactionForm.cuentaId}
              >
                <option className={optionClassName} value="">
                  Selecciona una cuenta
                </option>
                {cuentas.map((cuenta) => (
                  <option
                    key={cuenta.id}
                    className={optionClassName}
                    value={cuenta.id}
                  >
                    {cuenta.nombre}
                  </option>
                ))}
              </select>
              <select
                className={`${selectClassName} md:col-span-2`}
                name="tareaId"
                onChange={handleTransactionInputChange}
                value={transactionForm.tareaId}
              >
                <option className={optionClassName} value="">
                  Vincular a una tarea activa (opcional)
                </option>
                {tareasActivas.map((tarea) => (
                  <option
                    key={tarea.id}
                    className={optionClassName}
                    value={tarea.id}
                  >
                    {tarea.titulo}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSavingTransaction}
              type="submit"
            >
              <Plus className="h-4 w-4" />
              {isSavingTransaction ? 'Guardando...' : 'Guardar transaccion'}
            </button>
          </form>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
              Ultimos movimientos
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Historial reciente
            </h3>

            <div className="mt-6 space-y-3">
              {transacciones.length > 0 ? (
                transacciones.map((transaccion) => (
                  <div
                    key={transaccion.id}
                    className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/45 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {transaccion.categoria}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                        {transaccion.fecha
                          ? formatDateLabel(new Date(transaccion.fecha), {
                              day: '2-digit',
                              month: 'short',
                            })
                          : 'Sin fecha'}
                      </p>
                    </div>

                    <span
                      className={`self-start text-sm font-semibold sm:self-center ${
                        transaccion.tipo === 'ingreso'
                          ? 'text-emerald-300'
                          : transaccion.tipo === 'transferencia'
                            ? 'text-sky-300'
                            : 'text-rose-300'
                      }`}
                    >
                      {transaccion.tipo === 'ingreso'
                        ? '+'
                        : transaccion.tipo === 'transferencia'
                          ? '~'
                          : '-'}
                      {formatCurrency(transaccion.monto)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300">
                  Aun no registraste transacciones.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === 'metas' ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <PiggyBank className="h-5 w-5 text-sky-200" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
                  Objetivos de ahorro
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  Metas por horizonte
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <GoalTabButton
                active={goalTab === 'corto'}
                label="Corto Plazo"
                onClick={() => {
                  setGoalTab('corto')
                }}
              />
              <GoalTabButton
                active={goalTab === 'mediano'}
                label="Mediano Plazo"
                onClick={() => {
                  setGoalTab('mediano')
                }}
              />
              <GoalTabButton
                active={goalTab === 'largo'}
                label="Largo Plazo"
                onClick={() => {
                  setGoalTab('largo')
                }}
              />
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
                onClick={openCreateGoalModal}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Nueva meta
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {groupedGoals[goalTab].length > 0 ? (
              groupedGoals[goalTab].map((goal) => {
                const progress = calculateGoalProgress(goal)

                return (
                  <article
                    key={goal.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/45 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">
                          {goal.nombre}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Horizonte {goal.plazo}
                        </p>
                      </div>

                      <span className="rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                        {progress.toFixed(0)}%
                      </span>
                    </div>

                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#0ea5e9)]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <GoalDataPoint
                        label="Actual"
                        value={formatCurrency(goal.monto_actual)}
                      />
                      <GoalDataPoint
                        label="Objetivo"
                        value={formatCurrency(goal.monto_objetivo)}
                      />
                      <GoalDataPoint
                        label="Limite"
                        value={
                          goal.fecha_limite
                            ? formatDateLabel(new Date(goal.fecha_limite), {
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Sin definir'
                        }
                      />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        className="rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-300/18"
                        onClick={() => {
                          openEditGoalModal(goal)
                        }}
                        type="button"
                      >
                        Editar meta
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={deletingGoalId === goal.id}
                        onClick={() => {
                          void handleDeleteGoal(goal.id)
                        }}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingGoalId === goal.id ? 'Eliminando...' : 'Eliminar meta'}
                      </button>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300 xl:col-span-2">
                No hay metas cargadas para este horizonte todavia.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {showGoalModal ? (
        <ModalFrame
          onClose={() => {
            setShowGoalModal(false)
          }}
          subtitle={
            goalForm.goalId
              ? 'Ajusta progreso, objetivo y fecha limite'
              : 'Crea una nueva meta de ahorro'
          }
          title={goalForm.goalId ? 'Editar meta' : 'Nueva meta'}
        >
          <form className="mt-6 space-y-4" onSubmit={handleSaveGoal}>
            <input
              required
              className={inputClassName}
              name="nombre"
              onChange={handleGoalInputChange}
              placeholder="Nombre de la meta"
              value={goalForm.nombre}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                required
                className={inputClassName}
                min="0"
                name="montoActual"
                onChange={handleGoalInputChange}
                placeholder="Monto actual"
                step="0.01"
                type="number"
                value={goalForm.montoActual}
              />
              <input
                required
                className={inputClassName}
                min="0.01"
                name="montoObjetivo"
                onChange={handleGoalInputChange}
                placeholder="Monto objetivo"
                step="0.01"
                type="number"
                value={goalForm.montoObjetivo}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <select
                className={selectClassName}
                name="plazo"
                onChange={handleGoalInputChange}
                value={goalForm.plazo}
              >
                <option className={optionClassName} value="corto">
                  Corto plazo
                </option>
                <option className={optionClassName} value="mediano">
                  Mediano plazo
                </option>
                <option className={optionClassName} value="largo">
                  Largo plazo
                </option>
              </select>

              <input
                className={inputClassName}
                name="fechaLimite"
                onChange={handleGoalInputChange}
                type="date"
                value={goalForm.fechaLimite}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSavingGoal}
                type="submit"
              >
                <PiggyBank className="h-4 w-4" />
                {isSavingGoal ? 'Guardando...' : goalForm.goalId ? 'Guardar cambios' : 'Crear meta'}
              </button>

              {goalForm.goalId ? (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={deletingGoalId === goalForm.goalId}
                  onClick={() => {
                    void handleDeleteGoal(goalForm.goalId as string)
                  }}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingGoalId === goalForm.goalId ? 'Eliminando...' : 'Eliminar meta'}
                </button>
              ) : null}
            </div>
          </form>
        </ModalFrame>
      ) : null}
    </div>
  )
}

function createDefaultGoalForm(defaultPlazo: GoalTab = 'corto'): GoalFormState {
  return {
    goalId: null,
    nombre: '',
    montoActual: '0',
    montoObjetivo: '',
    plazo: defaultPlazo,
    fechaLimite: '',
  }
}

function calculateGoalProgress(goal: MetaAhorro) {
  if (goal.monto_objetivo <= 0) {
    return 0
  }

  return Math.min(100, (goal.monto_actual / goal.monto_objetivo) * 100)
}

type FinanzasTabButtonProps = {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}

function FinanzasTabButton({
  active,
  icon,
  label,
  onClick,
}: FinanzasTabButtonProps) {
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition sm:w-auto ${
        active
          ? 'border-sky-300/35 bg-sky-300/12 text-sky-100'
          : 'border-white/10 bg-white/6 text-slate-300'
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  )
}

type GoalTabButtonProps = {
  active: boolean
  label: string
  onClick: () => void
}

function GoalTabButton({ active, label, onClick }: GoalTabButtonProps) {
  return (
    <button
      className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium transition sm:w-auto ${
        active
          ? 'border-sky-300/35 bg-sky-300/12 text-sky-100'
          : 'border-white/10 bg-white/6 text-slate-300'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

type GoalDataPointProps = {
  label: string
  value: string
}

function GoalDataPoint({ label, value }: GoalDataPointProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

type ModalFrameProps = {
  children: ReactNode
  onClose: () => void
  subtitle: string
  title: string
}

function ModalFrame({ children, onClose, subtitle, title }: ModalFrameProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-8">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-[0_24px_100px_rgba(2,6,23,0.65)] sm:max-h-[calc(100vh-4rem)] sm:rounded-[2rem] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/75 sm:text-sm sm:tracking-[0.26em]">
              {title}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">{subtitle}</h3>
          </div>

          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white transition hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

export default ModuloFinanzas
