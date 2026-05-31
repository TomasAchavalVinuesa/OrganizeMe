import {
  Activity as ActivityIcon,
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Edit3,
  Image as ImageIcon,
  ListPlus,
  Plus,
  Save,
  Search,
  Target,
  Timer,
  Trash2,
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
  normalizeActividad,
  normalizeEntrenamientoEjercicio,
  normalizeEntrenamientoObjetivo,
  normalizeEntrenamientoRutina,
  normalizeEntrenamientoRutinaEjercicio,
  type Actividad,
  type EntrenamientoEjercicio,
  type EntrenamientoObjetivo,
  type EntrenamientoRutina,
  type EntrenamientoRutinaEjercicio,
} from '../lib/dashboardModels'
import {
  addDays,
  endOfDay,
  formatDateLabel,
  formatTimeLabel,
  parseStoredDateTime,
  startOfDay,
  startOfWeek,
} from '../lib/dateUtils'
import { supabase } from '../lib/supabaseClient'

type ModuloEntrenamientoProps = {
  onDataChanged: () => void
  userId: string
}

type EntrenamientoTab = 'biblioteca' | 'rutinas' | 'objetivos'

type ExerciseFormState = {
  descripcion: string
  exerciseId: string | null
  grupoMuscular: string
  imagenUrl: string
  instrucciones: string
  nombre: string
}

type RoutineFormState = {
  descripcion: string
  nombre: string
  routineId: string | null
  tiempoEstimadoMinutos: string
}

type ObjectiveFormState = {
  fechaFin: string
  fechaInicio: string
  metrica: EntrenamientoObjetivo['metrica']
  nombre: string
  objetivoEntrenamientos: string
  objetivoHoras: string
  objectiveId: string | null
}

type ScheduleFormState = {
  date: string
  notas: string
  routineId: string
  startTime: string
}

type RoutineItemEditableField =
  | 'descanso_segundos'
  | 'modo'
  | 'notas'
  | 'repeticiones'
  | 'series'
  | 'temporizador_segundos'

type WeeklyTrainingPoint = {
  count: number
  hours: number
  label: string
}

type MuscleDistributionPoint = {
  label: string
  value: number
}

const selectClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/65 focus:ring-4 focus:ring-emerald-300/15'

const optionClassName = 'bg-slate-900 text-white'

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-300/65 focus:ring-4 focus:ring-emerald-300/15'

const textareaClassName =
  'min-h-28 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-300/65 focus:ring-4 focus:ring-emerald-300/15'

const muscleGroups = [
  'Pecho',
  'Espalda',
  'Piernas',
  'Hombros',
  'Brazos',
  'Core',
  'Gluteos',
  'Cardio',
  'Movilidad',
]

const initialExerciseForm: ExerciseFormState = {
  exerciseId: null,
  nombre: '',
  descripcion: '',
  instrucciones: '',
  imagenUrl: '',
  grupoMuscular: 'Pecho',
}

const initialRoutineForm: RoutineFormState = {
  routineId: null,
  nombre: '',
  descripcion: '',
  tiempoEstimadoMinutos: '45',
}

const defaultExercises: Array<Omit<ExerciseFormState, 'exerciseId'>> = [
  {
    nombre: 'Sentadilla',
    descripcion: 'Ejercicio base para fuerza de tren inferior.',
    instrucciones:
      'Coloca los pies al ancho de hombros, baja con el pecho abierto y empuja el piso para volver a subir.',
    imagenUrl:
      'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=900&q=80',
    grupoMuscular: 'Piernas',
  },
  {
    nombre: 'Flexiones',
    descripcion: 'Movimiento de empuje con peso corporal.',
    instrucciones:
      'Alinea hombros, cadera y tobillos, baja controlado hasta acercar el pecho al piso y extiende los brazos.',
    imagenUrl:
      'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=900&q=80',
    grupoMuscular: 'Pecho',
  },
  {
    nombre: 'Remo con mancuerna',
    descripcion: 'Tiraje unilateral para espalda media.',
    instrucciones:
      'Apoya una mano, inclina el torso y lleva la mancuerna hacia la cadera sin rotar el tronco.',
    imagenUrl:
      'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=80',
    grupoMuscular: 'Espalda',
  },
  {
    nombre: 'Plancha',
    descripcion: 'Trabajo isometrico de estabilidad.',
    instrucciones:
      'Apoya antebrazos, activa abdomen y gluteos, y manten una linea recta sin hundir la cadera.',
    imagenUrl:
      'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=900&q=80',
    grupoMuscular: 'Core',
  },
  {
    nombre: 'Press militar',
    descripcion: 'Empuje vertical para hombros.',
    instrucciones:
      'Sostiene el peso a la altura de hombros, estabiliza el tronco y empuja por encima de la cabeza.',
    imagenUrl:
      'https://images.unsplash.com/photo-1534367507873-d2d7e24c797f?auto=format&fit=crop&w=900&q=80',
    grupoMuscular: 'Hombros',
  },
  {
    nombre: 'Zancadas',
    descripcion: 'Ejercicio unilateral para piernas y gluteos.',
    instrucciones:
      'Da un paso largo, baja la rodilla posterior con control y empuja desde el talon delantero para subir.',
    imagenUrl:
      'https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&w=900&q=80',
    grupoMuscular: 'Gluteos',
  },
]

function ModuloEntrenamiento({ onDataChanged, userId }: ModuloEntrenamientoProps) {
  const [activeTab, setActiveTab] = useState<EntrenamientoTab>('biblioteca')
  const [ejercicios, setEjercicios] = useState<EntrenamientoEjercicio[]>([])
  const [rutinas, setRutinas] = useState<EntrenamientoRutina[]>([])
  const [routineItems, setRoutineItems] = useState<EntrenamientoRutinaEjercicio[]>([])
  const [objective, setObjective] = useState<EntrenamientoObjetivo | null>(null)
  const [physicalActivities, setPhysicalActivities] = useState<Actividad[]>([])
  const [currentRoutineId, setCurrentRoutineId] = useState<string | null>(null)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [routineSearch, setRoutineSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [showExerciseModal, setShowExerciseModal] = useState(false)
  const [showRoutineModal, setShowRoutineModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [exerciseForm, setExerciseForm] =
    useState<ExerciseFormState>(initialExerciseForm)
  const [routineForm, setRoutineForm] = useState<RoutineFormState>(initialRoutineForm)
  const [objectiveForm, setObjectiveForm] = useState<ObjectiveFormState>(() =>
    createDefaultObjectiveForm(),
  )
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() =>
    createDefaultScheduleForm(),
  )
  const [savingExercise, setSavingExercise] = useState(false)
  const [savingRoutine, setSavingRoutine] = useState(false)
  const [savingCurrentRoutine, setSavingCurrentRoutine] = useState(false)
  const [savingObjective, setSavingObjective] = useState(false)
  const [schedulingRoutine, setSchedulingRoutine] = useState(false)
  const [addingExerciseId, setAddingExerciseId] = useState<string | null>(null)
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null)
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null)
  const [deletingRoutineItemId, setDeletingRoutineItemId] = useState<string | null>(
    null,
  )

  const fetchTrainingData = useCallback(async () => {
    const [
      ejerciciosResponse,
      rutinasResponse,
      routineItemsResponse,
      objetivosResponse,
      activitiesResponse,
    ] = await Promise.all([
      supabase
        .from('entrenamiento_ejercicios')
        .select('*')
        .eq('user_id', userId)
        .order('nombre', { ascending: true }),
      supabase
        .from('entrenamiento_rutinas')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('entrenamiento_rutina_ejercicios')
        .select('*')
        .order('orden', { ascending: true }),
      supabase
        .from('entrenamiento_objetivos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('actividades')
        .select('*')
        .eq('user_id', userId)
        .ilike('descripcion', '[[subtipo:actividad_fisica]]%')
        .order('fecha_inicio', { ascending: false }),
    ])

    if (ejerciciosResponse.error) {
      throw new Error(ejerciciosResponse.error.message)
    }

    if (rutinasResponse.error) {
      throw new Error(rutinasResponse.error.message)
    }

    if (routineItemsResponse.error) {
      throw new Error(routineItemsResponse.error.message)
    }

    if (objetivosResponse.error) {
      throw new Error(objetivosResponse.error.message)
    }

    if (activitiesResponse.error) {
      throw new Error(activitiesResponse.error.message)
    }

    const nextExercises = (ejerciciosResponse.data ?? []).map((row, index) =>
      normalizeEntrenamientoEjercicio(row, index),
    )
    const nextRoutines = (rutinasResponse.data ?? []).map((row, index) =>
      normalizeEntrenamientoRutina(row, index),
    )
    const nextItems = (routineItemsResponse.data ?? []).map((row, index) =>
      normalizeEntrenamientoRutinaEjercicio(row, index),
    )
    const nextObjective =
      (objetivosResponse.data ?? []).map((row, index) =>
        normalizeEntrenamientoObjetivo(row, index),
      )[0] ?? null

    setEjercicios(nextExercises)
    setRutinas(nextRoutines)
    setRoutineItems(nextItems)
    setObjective(nextObjective)
    setPhysicalActivities(
      (activitiesResponse.data ?? []).map((row, index) =>
        normalizeActividad(row, index),
      ),
    )
    setObjectiveForm(
      nextObjective
        ? createObjectiveFormFromRecord(nextObjective)
        : createDefaultObjectiveForm(),
    )
    setCurrentRoutineId((currentValue) => {
      if (currentValue && nextRoutines.some((rutina) => rutina.id === currentValue)) {
        return currentValue
      }

      return (
        nextRoutines.find((rutina) => rutina.estado === 'borrador')?.id ??
        nextRoutines[0]?.id ??
        null
      )
    })
  }, [userId])

  useEffect(() => {
    let isMounted = true

    const loadTrainingData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        await fetchTrainingData()
      } catch (issue) {
        if (!isMounted) {
          return
        }

        setError(
          issue instanceof Error
            ? issue.message
            : 'No pudimos cargar el modulo de entrenamiento.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadTrainingData()

    return () => {
      isMounted = false
    }
  }, [fetchTrainingData])

  const exerciseById = useMemo(() => {
    return ejercicios.reduce<Record<string, EntrenamientoEjercicio>>(
      (grouped, ejercicio) => {
        grouped[ejercicio.id] = ejercicio
        return grouped
      },
      {},
    )
  }, [ejercicios])

  const filteredExercises = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(exerciseSearch)

    return ejercicios.filter((exercise) => {
      const searchable = normalizeSearchValue(
        `${exercise.nombre} ${exercise.grupo_muscular}`,
      )
      return searchable.includes(normalizedSearch)
    })
  }, [ejercicios, exerciseSearch])

  const filteredRoutines = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(routineSearch)

    return rutinas.filter((rutina) =>
      normalizeSearchValue(`${rutina.nombre} ${rutina.descripcion ?? ''}`).includes(
        normalizedSearch,
      ),
    )
  }, [routineSearch, rutinas])

  const currentRoutine = useMemo(() => {
    return rutinas.find((rutina) => rutina.id === currentRoutineId) ?? null
  }, [currentRoutineId, rutinas])

  const currentRoutineItems = useMemo(() => {
    if (!currentRoutine) {
      return []
    }

    return routineItems
      .filter((item) => item.rutina_id === currentRoutine.id)
      .sort((first, second) => first.orden - second.orden)
  }, [currentRoutine, routineItems])

  const scheduledPhysicalActivities = useMemo(() => {
    const now = new Date()
    return physicalActivities
      .filter((activity) => parseStoredDateTime(activity.fecha_inicio) >= now)
      .slice(0, 5)
  }, [physicalActivities])

  const objectiveStats = useMemo(() => {
    return calculateObjectiveStats(objective, physicalActivities)
  }, [objective, physicalActivities])

  const weeklyTrainingData = useMemo(() => {
    return createWeeklyTrainingData(objectiveStats.completedActivities)
  }, [objectiveStats.completedActivities])

  const muscleDistribution = useMemo(() => {
    return createMuscleDistribution(routineItems, exerciseById)
  }, [exerciseById, routineItems])

  const refreshAll = async () => {
    await fetchTrainingData()
  }

  const openCreateExerciseModal = () => {
    setMutationError(null)
    setExerciseForm(initialExerciseForm)
    setShowExerciseModal(true)
  }

  const openEditExerciseModal = (exercise: EntrenamientoEjercicio) => {
    setMutationError(null)
    setExerciseForm({
      exerciseId: exercise.id,
      nombre: exercise.nombre,
      descripcion: exercise.descripcion,
      instrucciones: exercise.instrucciones,
      imagenUrl: exercise.imagen_url,
      grupoMuscular: exercise.grupo_muscular,
    })
    setShowExerciseModal(true)
  }

  const openCreateRoutineModal = () => {
    setMutationError(null)
    setRoutineForm(initialRoutineForm)
    setShowRoutineModal(true)
  }

  const openEditRoutineModal = (routine: EntrenamientoRutina) => {
    setMutationError(null)
    setRoutineForm({
      routineId: routine.id,
      nombre: routine.nombre,
      descripcion: routine.descripcion ?? '',
      tiempoEstimadoMinutos: String(routine.tiempo_estimado_minutos),
    })
    setShowRoutineModal(true)
  }

  const openScheduleRoutineModal = (routine: EntrenamientoRutina) => {
    setMutationError(null)
    setScheduleForm(createDefaultScheduleForm(routine.id))
    setShowScheduleModal(true)
  }

  const handleExerciseFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setExerciseForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleRoutineFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target

    setRoutineForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleObjectiveFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setObjectiveForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleScheduleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target

    setScheduleForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleSaveExercise = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingExercise(true)

    try {
      const payload = {
        user_id: userId,
        nombre: exerciseForm.nombre.trim(),
        descripcion: exerciseForm.descripcion.trim(),
        instrucciones: exerciseForm.instrucciones.trim(),
        imagen_url: exerciseForm.imagenUrl.trim(),
        grupo_muscular: exerciseForm.grupoMuscular.trim() || 'General',
      }

      if (!payload.nombre) {
        throw new Error('Ingresa un nombre para el ejercicio.')
      }

      if (exerciseForm.exerciseId) {
        const { error: updateError } = await supabase
          .from('entrenamiento_ejercicios')
          .update(payload)
          .eq('id', exerciseForm.exerciseId)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: insertError } = await supabase
          .from('entrenamiento_ejercicios')
          .insert(payload)

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      await refreshAll()
      setShowExerciseModal(false)
      setExerciseForm(initialExerciseForm)
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos guardar el ejercicio.',
      )
    } finally {
      setSavingExercise(false)
    }
  }

  const handleDeleteExercise = async (exercise: EntrenamientoEjercicio) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Eliminar "${exercise.nombre}" de la biblioteca?`)
    ) {
      return
    }

    setMutationError(null)
    setDeletingExerciseId(exercise.id)

    try {
      const { error: deleteError } = await supabase
        .from('entrenamiento_ejercicios')
        .delete()
        .eq('id', exercise.id)
        .eq('user_id', userId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await refreshAll()
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos eliminar el ejercicio.',
      )
    } finally {
      setDeletingExerciseId(null)
    }
  }

  const handleLoadDefaultExercises = async () => {
    setMutationError(null)
    setSavingExercise(true)

    try {
      const existingNames = new Set(
        ejercicios.map((exercise) => normalizeSearchValue(exercise.nombre)),
      )
      const rowsToInsert = defaultExercises
        .filter((exercise) => !existingNames.has(normalizeSearchValue(exercise.nombre)))
        .map((exercise) => ({
          user_id: userId,
          nombre: exercise.nombre,
          descripcion: exercise.descripcion,
          instrucciones: exercise.instrucciones,
          imagen_url: exercise.imagenUrl,
          grupo_muscular: exercise.grupoMuscular,
        }))

      if (rowsToInsert.length === 0) {
        setMutationError('La biblioteca inicial ya esta cargada.')
        return
      }

      const { error: insertError } = await supabase
        .from('entrenamiento_ejercicios')
        .insert(rowsToInsert)

      if (insertError) {
        throw new Error(insertError.message)
      }

      await refreshAll()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos cargar los ejercicios base.',
      )
    } finally {
      setSavingExercise(false)
    }
  }

  const handleSaveRoutine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingRoutine(true)

    try {
      const estimatedMinutes = Math.max(
        1,
        Number.parseInt(routineForm.tiempoEstimadoMinutos, 10) || 45,
      )
      const payload = {
        user_id: userId,
        nombre: routineForm.nombre.trim(),
        descripcion: routineForm.descripcion.trim() || null,
        tiempo_estimado_minutos: estimatedMinutes,
      }

      if (!payload.nombre) {
        throw new Error('Ingresa un nombre para la rutina.')
      }

      if (routineForm.routineId) {
        const { error: updateError } = await supabase
          .from('entrenamiento_rutinas')
          .update(payload)
          .eq('id', routineForm.routineId)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('entrenamiento_rutinas')
          .insert({
            ...payload,
            estado: 'borrador',
          })
          .select('*')
          .single()

        if (insertError) {
          throw new Error(insertError.message)
        }

        if (data) {
          const createdRoutine = normalizeEntrenamientoRutina(data, 0)
          setCurrentRoutineId(createdRoutine.id)
        }
      }

      await refreshAll()
      setShowRoutineModal(false)
      setRoutineForm(initialRoutineForm)
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos guardar la rutina.',
      )
    } finally {
      setSavingRoutine(false)
    }
  }

  const ensureCurrentRoutine = async () => {
    if (currentRoutine) {
      return currentRoutine
    }

    const { data, error: insertError } = await supabase
      .from('entrenamiento_rutinas')
      .insert({
        user_id: userId,
        nombre: `Rutina abierta ${formatDateLabel(new Date(), {
          day: '2-digit',
          month: 'short',
        })}`,
        descripcion: null,
        tiempo_estimado_minutos: 45,
        estado: 'borrador',
      })
      .select('*')
      .single()

    if (insertError) {
      throw new Error(insertError.message)
    }

    const createdRoutine = normalizeEntrenamientoRutina(data, 0)
    setRutinas((currentRoutines) => [createdRoutine, ...currentRoutines])
    setCurrentRoutineId(createdRoutine.id)
    return createdRoutine
  }

  const handleAddExerciseToCurrentRoutine = async (exercise: EntrenamientoEjercicio) => {
    setMutationError(null)
    setAddingExerciseId(exercise.id)

    try {
      const routine = await ensureCurrentRoutine()
      const nextOrder = routineItems.filter((item) => item.rutina_id === routine.id).length
      const { error: insertError } = await supabase
        .from('entrenamiento_rutina_ejercicios')
        .insert({
          rutina_id: routine.id,
          ejercicio_id: exercise.id,
          orden: nextOrder,
          series: 3,
          repeticiones: 10,
          temporizador_segundos: null,
          modo: 'repeticiones',
          descanso_segundos: 60,
          notas: null,
        })

      if (insertError) {
        throw new Error(insertError.message)
      }

      await refreshAll()
      setActiveTab('rutinas')
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos agregar el ejercicio a la rutina.',
      )
    } finally {
      setAddingExerciseId(null)
    }
  }

  const handleRoutineItemChange = (
    itemId: string,
    field: RoutineItemEditableField,
    value: string,
  ) => {
    setRoutineItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item
        }

        if (field === 'modo') {
          const nextMode =
            value === 'temporizador' || value === 'repeticiones'
              ? value
              : 'repeticiones'

          return {
            ...item,
            modo: nextMode,
            repeticiones: nextMode === 'repeticiones' ? item.repeticiones ?? 10 : null,
            temporizador_segundos:
              nextMode === 'temporizador' ? item.temporizador_segundos ?? 60 : null,
          }
        }

        if (field === 'notas') {
          return {
            ...item,
            notas: value,
          }
        }

        const parsedValue = Math.max(0, Number.parseInt(value, 10) || 0)
        return {
          ...item,
          [field]: parsedValue,
        }
      }),
    )
  }

  const handleSaveCurrentRoutine = async () => {
    if (!currentRoutine) {
      return
    }

    setMutationError(null)
    setSavingCurrentRoutine(true)

    try {
      const { error: routineUpdateError } = await supabase
        .from('entrenamiento_rutinas')
        .update({
          estado: 'guardada',
        })
        .eq('id', currentRoutine.id)
        .eq('user_id', userId)

      if (routineUpdateError) {
        throw new Error(routineUpdateError.message)
      }

      await Promise.all(
        currentRoutineItems.map((item, index) => {
          const payload = {
            orden: index,
            series: Math.max(1, item.series),
            repeticiones:
              item.modo === 'repeticiones'
                ? Math.max(1, item.repeticiones ?? 10)
                : null,
            temporizador_segundos:
              item.modo === 'temporizador'
                ? Math.max(10, item.temporizador_segundos ?? 60)
                : null,
            modo: item.modo,
            descanso_segundos: Math.max(0, item.descanso_segundos),
            notas: item.notas?.trim() || null,
          }

          return supabase
            .from('entrenamiento_rutina_ejercicios')
            .update(payload)
            .eq('id', item.id)
        }),
      )

      await refreshAll()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos guardar los ejercicios de la rutina.',
      )
    } finally {
      setSavingCurrentRoutine(false)
    }
  }

  const handleDeleteRoutineItem = async (itemId: string) => {
    setMutationError(null)
    setDeletingRoutineItemId(itemId)

    try {
      const { error: deleteError } = await supabase
        .from('entrenamiento_rutina_ejercicios')
        .delete()
        .eq('id', itemId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await refreshAll()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos quitar el ejercicio de la rutina.',
      )
    } finally {
      setDeletingRoutineItemId(null)
    }
  }

  const handleDeleteRoutine = async (routine: EntrenamientoRutina) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Eliminar la rutina "${routine.nombre}"?`)
    ) {
      return
    }

    setMutationError(null)
    setDeletingRoutineId(routine.id)

    try {
      const { error: deleteItemsError } = await supabase
        .from('entrenamiento_rutina_ejercicios')
        .delete()
        .eq('rutina_id', routine.id)

      if (deleteItemsError) {
        throw new Error(deleteItemsError.message)
      }

      const { error: deleteRoutineError } = await supabase
        .from('entrenamiento_rutinas')
        .delete()
        .eq('id', routine.id)
        .eq('user_id', userId)

      if (deleteRoutineError) {
        throw new Error(deleteRoutineError.message)
      }

      await refreshAll()
      if (currentRoutineId === routine.id) {
        setCurrentRoutineId(null)
      }
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos eliminar la rutina.',
      )
    } finally {
      setDeletingRoutineId(null)
    }
  }

  const handleScheduleRoutine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSchedulingRoutine(true)

    try {
      const routine = rutinas.find((item) => item.id === scheduleForm.routineId)
      if (!routine) {
        throw new Error('Selecciona una rutina para agendar.')
      }

      const startAt = new Date(`${scheduleForm.date}T${scheduleForm.startTime || '09:00'}`)
      const endAt = new Date(
        startAt.getTime() + routine.tiempo_estimado_minutos * 60 * 1000,
      )

      const { error: insertError } = await supabase.from('actividades').insert({
        user_id: userId,
        titulo: `Entrenamiento: ${routine.nombre}`,
        descripcion: buildPhysicalActivityDescription(
          scheduleForm.notas.trim() || routine.descripcion || '',
        ),
        tipo: 'evento',
        categoria: 'actividad_fisica',
        fecha_inicio: startAt.toISOString(),
        fecha_fin: endAt.toISOString(),
        color: '#22c55e',
        visible_calendario_mensual: false,
        datos_extra: {
          categoria: 'actividad_fisica',
          rutina_id: routine.id,
        },
        serie_id: null,
        ocurrencia_fecha: scheduleForm.date,
        oculta_calendarios: false,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      await refreshAll()
      onDataChanged()
      setShowScheduleModal(false)
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos agendar la rutina.',
      )
    } finally {
      setSchedulingRoutine(false)
    }
  }

  const handleRegisterRoutineCompleted = async (routine: EntrenamientoRutina) => {
    setMutationError(null)
    setSchedulingRoutine(true)

    try {
      const endAt = new Date()
      const startAt = new Date(
        endAt.getTime() - routine.tiempo_estimado_minutos * 60 * 1000,
      )
      const { error: insertError } = await supabase.from('actividades').insert({
        user_id: userId,
        titulo: `Entrenamiento completado: ${routine.nombre}`,
        descripcion: buildPhysicalActivityDescription(routine.descripcion ?? ''),
        tipo: 'evento',
        categoria: 'actividad_fisica',
        fecha_inicio: startAt.toISOString(),
        fecha_fin: endAt.toISOString(),
        color: '#22c55e',
        visible_calendario_mensual: false,
        datos_extra: {
          categoria: 'actividad_fisica',
          rutina_id: routine.id,
          completada: true,
        },
        serie_id: null,
        ocurrencia_fecha: toDateInputValue(startAt),
        oculta_calendarios: false,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      await refreshAll()
      onDataChanged()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos registrar el entrenamiento completado.',
      )
    } finally {
      setSchedulingRoutine(false)
    }
  }

  const handleSaveObjective = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingObjective(true)

    try {
      const payload = {
        user_id: userId,
        nombre: objectiveForm.nombre.trim(),
        metrica: objectiveForm.metrica,
        objetivo_horas: Number.parseFloat(objectiveForm.objetivoHoras) || 0,
        objetivo_entrenamientos:
          Number.parseInt(objectiveForm.objetivoEntrenamientos, 10) || 0,
        fecha_inicio: objectiveForm.fechaInicio,
        fecha_fin: objectiveForm.fechaFin || null,
      }

      if (!payload.nombre) {
        throw new Error('Ingresa un nombre para el objetivo.')
      }

      if (!payload.fecha_inicio) {
        throw new Error('Define una fecha de inicio para el objetivo.')
      }

      if (payload.metrica === 'horas' && payload.objetivo_horas <= 0) {
        throw new Error('El objetivo de horas debe ser mayor que cero.')
      }

      if (
        payload.metrica === 'entrenamientos' &&
        payload.objetivo_entrenamientos <= 0
      ) {
        throw new Error('El objetivo de entrenamientos debe ser mayor que cero.')
      }

      if (objectiveForm.objectiveId) {
        const { error: updateError } = await supabase
          .from('entrenamiento_objetivos')
          .update(payload)
          .eq('id', objectiveForm.objectiveId)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: insertError } = await supabase
          .from('entrenamiento_objetivos')
          .insert(payload)

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      await refreshAll()
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos guardar el objetivo.',
      )
    } finally {
      setSavingObjective(false)
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
              Entrenamiento
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Biblioteca, rutinas y progreso fisico
            </h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <EntrenamientoTabButton
              active={activeTab === 'biblioteca'}
              icon={<Dumbbell className="h-4 w-4" />}
              label="Biblioteca"
              onClick={() => {
                setActiveTab('biblioteca')
              }}
            />
            <EntrenamientoTabButton
              active={activeTab === 'rutinas'}
              icon={<ListPlus className="h-4 w-4" />}
              label="Rutinas"
              onClick={() => {
                setActiveTab('rutinas')
              }}
            />
            <EntrenamientoTabButton
              active={activeTab === 'objetivos'}
              icon={<Target className="h-4 w-4" />}
              label="Objetivos"
              onClick={() => {
                setActiveTab('objetivos')
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/45 p-4 text-sm text-slate-300 sm:p-6">
            Cargando ejercicios, rutinas y objetivos...
          </div>
        ) : null}
      </section>

      {!isLoading && activeTab === 'biblioteca' ? (
        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <Dumbbell className="h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
                    Biblioteca de ejercicios
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                    ABM con busqueda por nombre o grupo muscular
                  </h3>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={savingExercise}
                  onClick={() => {
                    void handleLoadDefaultExercises()
                  }}
                  type="button"
                >
                  <ImageIcon className="h-4 w-4" />
                  Cargar base
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                  onClick={openCreateExerciseModal}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo ejercicio
                </button>
              </div>
            </div>

            <label className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                onChange={(event) => {
                  setExerciseSearch(event.target.value)
                }}
                placeholder="Buscar por ejercicio o grupo muscular"
                value={exerciseSearch}
              />
            </label>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {filteredExercises.length > 0 ? (
              filteredExercises.map((exercise) => (
                <article
                  key={exercise.id}
                  className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/8 shadow-[0_16px_48px_rgba(15,23,42,0.25)]"
                >
                  {exercise.imagen_url ? (
                    <img
                      alt=""
                      className="h-44 w-full object-cover"
                      src={exercise.imagen_url}
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-slate-900/70">
                      <Dumbbell className="h-12 w-12 text-emerald-200/80" />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-lg font-semibold text-white">
                          {exercise.nombre}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.22em] text-emerald-200/70">
                          {exercise.grupo_muscular}
                        </p>
                      </div>
                      <Dumbbell className="h-5 w-5 shrink-0 text-emerald-200" />
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-300">
                      {exercise.descripcion || 'Sin descripcion cargada.'}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {exercise.instrucciones || 'Sin instrucciones cargadas.'}
                    </p>

                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-3"
                        disabled={addingExerciseId === exercise.id}
                        onClick={() => {
                          void handleAddExerciseToCurrentRoutine(exercise)
                        }}
                        type="button"
                      >
                        <ListPlus className="h-4 w-4" />
                        {addingExerciseId === exercise.id
                          ? 'Agregando...'
                          : 'Anadir a mi entrenamiento actual'}
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100 transition hover:bg-sky-300/18"
                        onClick={() => {
                          openEditExerciseModal(exercise)
                        }}
                        type="button"
                      >
                        <Edit3 className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-2"
                        disabled={deletingExerciseId === exercise.id}
                        onClick={() => {
                          void handleDeleteExercise(exercise)
                        }}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingExerciseId === exercise.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-slate-900/35 p-4 text-sm text-slate-300 sm:p-6 xl:col-span-3">
                No hay ejercicios para esa busqueda. Puedes crear uno nuevo o cargar
                la biblioteca base.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === 'rutinas' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
                  Rutinas guardadas
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  Reutiliza entrenamientos
                </h3>
              </div>
              <button
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 transition hover:bg-emerald-300"
                onClick={openCreateRoutineModal}
                type="button"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                onChange={(event) => {
                  setRoutineSearch(event.target.value)
                }}
                placeholder="Buscar rutina"
                value={routineSearch}
              />
            </label>

            <div className="mt-5 space-y-3">
              {filteredRoutines.length > 0 ? (
                filteredRoutines.map((routine) => (
                  <article
                    key={routine.id}
                    className={`rounded-3xl border p-4 transition ${
                      currentRoutineId === routine.id
                        ? 'border-emerald-300/35 bg-emerald-300/10'
                        : 'border-white/10 bg-slate-900/45'
                    }`}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => {
                        setCurrentRoutineId(routine.id)
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-base font-semibold text-white">
                            {routine.nombre}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                            {routine.estado === 'guardada' ? 'Guardada' : 'Borrador'}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold text-slate-200">
                          <Clock3 className="h-3.5 w-3.5" />
                          {routine.tiempo_estimado_minutos}m
                        </span>
                      </div>
                    </button>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100 transition hover:bg-sky-300/18"
                        onClick={() => {
                          openEditRoutineModal(routine)
                        }}
                        type="button"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 transition hover:bg-emerald-300/18"
                        onClick={() => {
                          openScheduleRoutineModal(routine)
                        }}
                        type="button"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Agendar
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={deletingRoutineId === routine.id}
                        onClick={() => {
                          void handleDeleteRoutine(routine)
                        }}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingRoutineId === routine.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300">
                  No hay rutinas para esa busqueda.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
              {currentRoutine ? (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
                        Entrenamiento actual
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                        {currentRoutine.nombre}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {currentRoutine.descripcion || 'Sin descripcion cargada.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/18"
                        onClick={() => {
                          openEditRoutineModal(currentRoutine)
                        }}
                        type="button"
                      >
                        <Edit3 className="h-4 w-4" />
                        Datos
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={savingCurrentRoutine}
                        onClick={() => {
                          void handleSaveCurrentRoutine()
                        }}
                        type="button"
                      >
                        <Save className="h-4 w-4" />
                        {savingCurrentRoutine ? 'Guardando...' : 'Guardar rutina'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MetricPill
                      icon={<Clock3 className="h-4 w-4" />}
                      label="Tiempo estimado"
                      value={formatDurationMinutes(currentRoutine.tiempo_estimado_minutos)}
                    />
                    <MetricPill
                      icon={<Dumbbell className="h-4 w-4" />}
                      label="Ejercicios"
                      value={String(currentRoutineItems.length)}
                    />
                    <MetricPill
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      label="Estado"
                      value={currentRoutine.estado === 'guardada' ? 'Guardada' : 'Borrador'}
                    />
                  </div>

                  <div className="mt-6 space-y-4">
                    {currentRoutineItems.length > 0 ? (
                      currentRoutineItems.map((item) => {
                        const exercise = exerciseById[item.ejercicio_id]

                        return (
                          <article
                            key={item.id}
                            className="rounded-3xl border border-white/10 bg-slate-900/45 p-4"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="break-words text-base font-semibold text-white">
                                  {exercise?.nombre ?? 'Ejercicio eliminado'}
                                </p>
                                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-emerald-200/70">
                                  {exercise?.grupo_muscular ?? 'Sin grupo'}
                                </p>
                              </div>
                              <button
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={deletingRoutineItemId === item.id}
                                onClick={() => {
                                  void handleDeleteRoutineItem(item.id)
                                }}
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                              <label className="space-y-2">
                                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                  Modo
                                </span>
                                <select
                                  className={selectClassName}
                                  onChange={(event) => {
                                    handleRoutineItemChange(
                                      item.id,
                                      'modo',
                                      event.target.value,
                                    )
                                  }}
                                  value={item.modo}
                                >
                                  <option className={optionClassName} value="repeticiones">
                                    Repeticiones
                                  </option>
                                  <option className={optionClassName} value="temporizador">
                                    Temporizador
                                  </option>
                                </select>
                              </label>
                              <NumberField
                                label="Series"
                                min={1}
                                onChange={(value) => {
                                  handleRoutineItemChange(item.id, 'series', value)
                                }}
                                value={item.series}
                              />
                              {item.modo === 'repeticiones' ? (
                                <NumberField
                                  label="Reps"
                                  min={1}
                                  onChange={(value) => {
                                    handleRoutineItemChange(
                                      item.id,
                                      'repeticiones',
                                      value,
                                    )
                                  }}
                                  value={item.repeticiones ?? 10}
                                />
                              ) : (
                                <NumberField
                                  label="Segundos"
                                  min={10}
                                  onChange={(value) => {
                                    handleRoutineItemChange(
                                      item.id,
                                      'temporizador_segundos',
                                      value,
                                    )
                                  }}
                                  value={item.temporizador_segundos ?? 60}
                                />
                              )}
                              <NumberField
                                label="Descanso"
                                min={0}
                                onChange={(value) => {
                                  handleRoutineItemChange(
                                    item.id,
                                    'descanso_segundos',
                                    value,
                                  )
                                }}
                                value={item.descanso_segundos}
                              />
                              <label className="space-y-2 md:col-span-2 xl:col-span-1">
                                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                  Notas
                                </span>
                                <input
                                  className={inputClassName}
                                  onChange={(event) => {
                                    handleRoutineItemChange(
                                      item.id,
                                      'notas',
                                      event.target.value,
                                    )
                                  }}
                                  placeholder="Opcional"
                                  value={item.notas ?? ''}
                                />
                              </label>
                            </div>
                          </article>
                        )
                      })
                    ) : (
                      <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300">
                        Agrega ejercicios desde la biblioteca para armar esta rutina.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/18"
                      onClick={() => {
                        openScheduleRoutineModal(currentRoutine)
                      }}
                      type="button"
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Agendar proximo entrenamiento
                    </button>
                    <button
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={schedulingRoutine}
                      onClick={() => {
                        void handleRegisterRoutineCompleted(currentRoutine)
                      }}
                      type="button"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Registrar completado
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-6 text-sm text-slate-300">
                  Crea una rutina o agrega un ejercicio desde la biblioteca para abrir
                  tu entrenamiento actual.
                </div>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
              <div className="flex items-center gap-3">
                <CalendarPlus className="h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
                    Agenda fisica
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                    Proximos entrenamientos
                  </h3>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {scheduledPhysicalActivities.length > 0 ? (
                  scheduledPhysicalActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/45 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-white">
                          {activity.titulo}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                          {formatDateLabel(parseStoredDateTime(activity.fecha_inicio), {
                            day: '2-digit',
                            month: 'short',
                            weekday: 'short',
                          })}
                        </p>
                      </div>
                      <span className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200">
                        {formatTimeLabel(parseStoredDateTime(activity.fecha_inicio))}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300">
                    No hay entrenamientos fisicos futuros en tu agenda.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === 'objetivos' ? (
        <section className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
                    Objetivo actual
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                    {objective?.nombre ?? 'Define tu objetivo'}
                  </h3>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Entrenamientos"
                  value={`${objectiveStats.completedWorkouts}/${objective?.objetivo_entrenamientos || 0}`}
                />
                <StatCard
                  label="Horas entrenadas"
                  value={`${objectiveStats.completedHours.toFixed(1)}/${objective?.objetivo_horas || 0}`}
                />
                <StatCard
                  label="Progreso"
                  value={`${objectiveStats.progress.toFixed(0)}%`}
                />
              </div>

              <div className="mt-6">
                <ProgressBar progress={objectiveStats.progress} />
              </div>
            </div>

            <form
              className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6"
              onSubmit={handleSaveObjective}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
                Configuracion
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Horas o entrenamientos
              </h3>

              <div className="mt-6 space-y-4">
                <input
                  required
                  className={inputClassName}
                  name="nombre"
                  onChange={handleObjectiveFormChange}
                  placeholder="Nombre del objetivo"
                  value={objectiveForm.nombre}
                />
                <select
                  className={selectClassName}
                  name="metrica"
                  onChange={handleObjectiveFormChange}
                  value={objectiveForm.metrica}
                >
                  <option className={optionClassName} value="entrenamientos">
                    Entrenamientos completados
                  </option>
                  <option className={optionClassName} value="horas">
                    Horas entrenadas
                  </option>
                </select>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    className={inputClassName}
                    min="0"
                    name="objetivoEntrenamientos"
                    onChange={handleObjectiveFormChange}
                    placeholder="Entrenamientos objetivo"
                    type="number"
                    value={objectiveForm.objetivoEntrenamientos}
                  />
                  <input
                    className={inputClassName}
                    min="0"
                    name="objetivoHoras"
                    onChange={handleObjectiveFormChange}
                    placeholder="Horas objetivo"
                    step="0.25"
                    type="number"
                    value={objectiveForm.objetivoHoras}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    required
                    className={inputClassName}
                    name="fechaInicio"
                    onChange={handleObjectiveFormChange}
                    type="date"
                    value={objectiveForm.fechaInicio}
                  />
                  <input
                    className={inputClassName}
                    name="fechaFin"
                    onChange={handleObjectiveFormChange}
                    type="date"
                    value={objectiveForm.fechaFin}
                  />
                </div>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={savingObjective}
                  type="submit"
                >
                  <Save className="h-4 w-4" />
                  {savingObjective ? 'Guardando...' : 'Guardar objetivo'}
                </button>
              </div>
            </form>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartPanel
              icon={<BarChart3 className="h-5 w-5 text-emerald-200" />}
              title="Ultimas semanas"
            >
              <WeeklyBarChart
                data={weeklyTrainingData}
                metric={objective?.metrica ?? objectiveForm.metrica}
              />
            </ChartPanel>

            <ChartPanel
              icon={<ActivityIcon className="h-5 w-5 text-emerald-200" />}
              title="Grupos musculares"
            >
              <MuscleDistributionChart data={muscleDistribution} />
            </ChartPanel>
          </div>

          <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-emerald-200" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
                  Actividad Fisica
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  Eventos que cuentan para el objetivo
                </h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {objectiveStats.completedActivities.length > 0 ? (
                objectiveStats.completedActivities.slice(0, 8).map((activity) => {
                  const startAt = parseStoredDateTime(activity.fecha_inicio)
                  const endAt = parseStoredDateTime(
                    activity.fecha_fin ?? activity.fecha_inicio,
                  )

                  return (
                    <div
                      key={activity.id}
                      className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/45 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-white">
                          {activity.titulo}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                          {formatDateLabel(startAt, {
                            day: '2-digit',
                            month: 'short',
                            weekday: 'short',
                          })}
                        </p>
                      </div>
                      <span className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200">
                        {formatDurationMinutes(
                          Math.max(
                            1,
                            Math.round((endAt.getTime() - startAt.getTime()) / 60000),
                          ),
                        )}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300">
                  Aun no hay actividades fisicas completadas dentro del periodo.
                </div>
              )}
            </div>
          </section>
        </section>
      ) : null}

      {showExerciseModal ? (
        <ModalFrame
          onClose={() => {
            setShowExerciseModal(false)
          }}
          subtitle={
            exerciseForm.exerciseId
              ? 'Actualiza datos, imagen y tecnica'
              : 'Carga un nuevo ejercicio a tu biblioteca'
          }
          title={exerciseForm.exerciseId ? 'Editar ejercicio' : 'Nuevo ejercicio'}
        >
          <form className="mt-6 space-y-4" onSubmit={handleSaveExercise}>
            <input
              required
              className={inputClassName}
              name="nombre"
              onChange={handleExerciseFormChange}
              placeholder="Nombre del ejercicio"
              value={exerciseForm.nombre}
            />
            <select
              className={selectClassName}
              name="grupoMuscular"
              onChange={handleExerciseFormChange}
              value={exerciseForm.grupoMuscular}
            >
              {muscleGroups.map((group) => (
                <option key={group} className={optionClassName} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <input
              className={inputClassName}
              name="imagenUrl"
              onChange={handleExerciseFormChange}
              placeholder="URL de imagen ilustrativa"
              value={exerciseForm.imagenUrl}
            />
            <textarea
              className={textareaClassName}
              name="descripcion"
              onChange={handleExerciseFormChange}
              placeholder="Descripcion"
              value={exerciseForm.descripcion}
            />
            <textarea
              className={textareaClassName}
              name="instrucciones"
              onChange={handleExerciseFormChange}
              placeholder="Como se realiza"
              value={exerciseForm.instrucciones}
            />
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={savingExercise}
              type="submit"
            >
              <Dumbbell className="h-4 w-4" />
              {savingExercise ? 'Guardando...' : 'Guardar ejercicio'}
            </button>
          </form>
        </ModalFrame>
      ) : null}

      {showRoutineModal ? (
        <ModalFrame
          onClose={() => {
            setShowRoutineModal(false)
          }}
          subtitle={
            routineForm.routineId
              ? 'Ajusta nombre, descripcion y tiempo estimado'
              : 'Crea una rutina para mantenerla abierta'
          }
          title={routineForm.routineId ? 'Editar rutina' : 'Nueva rutina'}
        >
          <form className="mt-6 space-y-4" onSubmit={handleSaveRoutine}>
            <input
              required
              className={inputClassName}
              name="nombre"
              onChange={handleRoutineFormChange}
              placeholder="Nombre de la rutina"
              value={routineForm.nombre}
            />
            <input
              required
              className={inputClassName}
              min="1"
              name="tiempoEstimadoMinutos"
              onChange={handleRoutineFormChange}
              placeholder="Tiempo estimado en minutos"
              type="number"
              value={routineForm.tiempoEstimadoMinutos}
            />
            <textarea
              className={textareaClassName}
              name="descripcion"
              onChange={handleRoutineFormChange}
              placeholder="Descripcion opcional"
              value={routineForm.descripcion}
            />
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={savingRoutine}
              type="submit"
            >
              <Save className="h-4 w-4" />
              {savingRoutine ? 'Guardando...' : 'Guardar rutina'}
            </button>
          </form>
        </ModalFrame>
      ) : null}

      {showScheduleModal ? (
        <ModalFrame
          onClose={() => {
            setShowScheduleModal(false)
          }}
          subtitle="Crea un evento Actividad Fisica en tu agenda semanal"
          title="Agendar entrenamiento"
        >
          <form className="mt-6 space-y-4" onSubmit={handleScheduleRoutine}>
            <select
              className={selectClassName}
              name="routineId"
              onChange={(event) => {
                setScheduleForm((currentForm) => ({
                  ...currentForm,
                  routineId: event.target.value,
                }))
              }}
              value={scheduleForm.routineId}
            >
              {rutinas.map((routine) => (
                <option key={routine.id} className={optionClassName} value={routine.id}>
                  {routine.nombre}
                </option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                required
                className={inputClassName}
                name="date"
                onChange={handleScheduleFormChange}
                type="date"
                value={scheduleForm.date}
              />
              <input
                required
                className={inputClassName}
                name="startTime"
                onChange={handleScheduleFormChange}
                type="time"
                value={scheduleForm.startTime}
              />
            </div>
            <textarea
              className={textareaClassName}
              name="notas"
              onChange={handleScheduleFormChange}
              placeholder="Notas para la agenda"
              value={scheduleForm.notas}
            />
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={schedulingRoutine}
              type="submit"
            >
              <CalendarPlus className="h-4 w-4" />
              {schedulingRoutine ? 'Agendando...' : 'Agendar rutina'}
            </button>
          </form>
        </ModalFrame>
      ) : null}
    </div>
  )
}

type EntrenamientoTabButtonProps = {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}

function EntrenamientoTabButton({
  active,
  icon,
  label,
  onClick,
}: EntrenamientoTabButtonProps) {
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition sm:w-auto ${
        active
          ? 'border-emerald-300/35 bg-emerald-300/12 text-emerald-100'
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

type MetricPillProps = {
  icon: ReactNode
  label: string
  value: string
}

function MetricPill({ icon, label, value }: MetricPillProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3">
      <div className="flex items-center gap-2 text-emerald-200">{icon}</div>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

type NumberFieldProps = {
  label: string
  min: number
  onChange: (value: string) => void
  value: number
}

function NumberField({ label, min, onChange, value }: NumberFieldProps) {
  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <input
        className={inputClassName}
        min={min}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        type="number"
        value={value}
      />
    </label>
  )
}

type StatCardProps = {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 sm:p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-3 break-words text-xl font-semibold text-white sm:text-2xl">{value}</p>
    </div>
  )
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-4 overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#22c55e,#38bdf8)]"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  )
}

type ChartPanelProps = {
  children: ReactNode
  icon: ReactNode
  title: string
}

function ChartPanel({ children, icon, title }: ChartPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
            Grafico
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">{title}</h3>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function WeeklyBarChart({
  data,
  metric,
}: {
  data: WeeklyTrainingPoint[]
  metric: EntrenamientoObjetivo['metrica']
}) {
  const maxValue = Math.max(
    1,
    ...data.map((point) => (metric === 'horas' ? point.hours : point.count)),
  )

  return (
    <div className="grid h-56 grid-cols-8 items-end gap-2 sm:h-72 sm:gap-3">
      {data.map((point) => {
        const value = metric === 'horas' ? point.hours : point.count
        const height = Math.max(8, (value / maxValue) * 100)

        return (
          <div key={point.label} className="flex h-full min-w-0 flex-col justify-end">
            <div
              className="rounded-t-2xl bg-[linear-gradient(180deg,#22c55e,#0f766e)]"
              style={{ height: `${height}%` }}
              title={`${point.label}: ${value.toFixed(metric === 'horas' ? 1 : 0)}`}
            />
            <p className="mt-3 truncate text-center text-xs text-slate-400">
              {point.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function MuscleDistributionChart({ data }: { data: MuscleDistributionPoint[] }) {
  const maxValue = Math.max(1, ...data.map((point) => point.value))

  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300">
        Agrega ejercicios a rutinas para ver el reparto por grupo muscular.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((point) => (
        <div key={point.label}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{point.label}</p>
            <p className="text-sm text-slate-300">{point.value}</p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#22c55e,#38bdf8)]"
              style={{ width: `${(point.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
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
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-[0_24px_100px_rgba(2,6,23,0.65)] sm:max-h-[calc(100vh-4rem)] sm:rounded-[2rem] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/75 sm:text-sm sm:tracking-[0.26em]">
              {title}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">{subtitle}</h3>
          </div>

          <button
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white transition hover:bg-white/10"
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

function createDefaultObjectiveForm(): ObjectiveFormState {
  const today = toDateInputValue(new Date())

  return {
    objectiveId: null,
    nombre: 'Objetivo mensual de entrenamiento',
    metrica: 'entrenamientos',
    objetivoHoras: '12',
    objetivoEntrenamientos: '12',
    fechaInicio: today,
    fechaFin: '',
  }
}

function createObjectiveFormFromRecord(
  objective: EntrenamientoObjetivo,
): ObjectiveFormState {
  return {
    objectiveId: objective.id,
    nombre: objective.nombre,
    metrica: objective.metrica,
    objetivoHoras: String(objective.objetivo_horas),
    objetivoEntrenamientos: String(objective.objetivo_entrenamientos),
    fechaInicio: toDateInputValue(parseStoredDateOnly(objective.fecha_inicio)),
    fechaFin: objective.fecha_fin ? toDateInputValue(parseStoredDateOnly(objective.fecha_fin)) : '',
  }
}

function createDefaultScheduleForm(routineId = ''): ScheduleFormState {
  const now = new Date()
  const nextHour = new Date(now)
  nextHour.setHours(now.getHours() + 1, 0, 0, 0)

  return {
    routineId,
    date: toDateInputValue(nextHour),
    startTime: toTimeInputValue(nextHour),
    notas: '',
  }
}

function calculateObjectiveStats(
  objective: EntrenamientoObjetivo | null,
  activities: Actividad[],
) {
  const now = new Date()
  const rangeStart = objective
    ? startOfDay(parseStoredDateOnly(objective.fecha_inicio))
    : startOfDay(addDays(now, -30))
  const rangeEnd = objective?.fecha_fin
    ? endOfDay(parseStoredDateOnly(objective.fecha_fin))
    : now

  const completedActivities = activities
    .filter((activity) => {
      const startAt = parseStoredDateTime(activity.fecha_inicio)
      return startAt >= rangeStart && startAt <= rangeEnd && startAt <= now
    })
    .sort(
      (first, second) =>
        parseStoredDateTime(second.fecha_inicio).getTime() -
        parseStoredDateTime(first.fecha_inicio).getTime(),
    )

  const completedMinutes = completedActivities.reduce((total, activity) => {
    const startAt = parseStoredDateTime(activity.fecha_inicio)
    const endAt = parseStoredDateTime(activity.fecha_fin ?? activity.fecha_inicio)
    return total + Math.max(0, endAt.getTime() - startAt.getTime()) / 60000
  }, 0)
  const completedHours = completedMinutes / 60
  const completedWorkouts = completedActivities.length
  const target =
    objective?.metrica === 'horas'
      ? objective.objetivo_horas
      : objective?.objetivo_entrenamientos
  const currentValue =
    objective?.metrica === 'horas' ? completedHours : completedWorkouts
  const progress = target && target > 0 ? Math.min(100, (currentValue / target) * 100) : 0

  return {
    completedActivities,
    completedHours,
    completedMinutes,
    completedWorkouts,
    progress,
  }
}

function createWeeklyTrainingData(activities: Actividad[]): WeeklyTrainingPoint[] {
  const currentWeekStart = startOfWeek(new Date())
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const weekStart = addDays(currentWeekStart, (index - 7) * 7)
    const weekEnd = endOfDay(addDays(weekStart, 6))
    const weekActivities = activities.filter((activity) => {
      const startAt = parseStoredDateTime(activity.fecha_inicio)
      return startAt >= weekStart && startAt <= weekEnd
    })
    const minutes = weekActivities.reduce((total, activity) => {
      const startAt = parseStoredDateTime(activity.fecha_inicio)
      const endAt = parseStoredDateTime(activity.fecha_fin ?? activity.fecha_inicio)
      return total + Math.max(0, endAt.getTime() - startAt.getTime()) / 60000
    }, 0)

    return {
      label: formatDateLabel(weekStart, { day: '2-digit', month: 'short' }),
      count: weekActivities.length,
      hours: minutes / 60,
    }
  })

  return weeks
}

function createMuscleDistribution(
  routineItems: EntrenamientoRutinaEjercicio[],
  exerciseById: Record<string, EntrenamientoEjercicio>,
): MuscleDistributionPoint[] {
  const grouped = routineItems.reduce<Record<string, number>>((current, item) => {
    const group = exerciseById[item.ejercicio_id]?.grupo_muscular ?? 'Sin grupo'
    current[group] = (current[group] ?? 0) + Math.max(1, item.series)
    return current
  }, {})

  return Object.entries(grouped)
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 6)
}

function buildPhysicalActivityDescription(description: string) {
  const metadata = '[[subtipo:actividad_fisica]]'
  return description.trim() ? `${metadata}\n${description.trim()}` : metadata
}

function formatDurationMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTimeInputValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function parseStoredDateOnly(value: string) {
  const [yearValue, monthValue, dayValue] = value.slice(0, 10).split('-')
  const year = Number.parseInt(yearValue ?? '', 10)
  const month = Number.parseInt(monthValue ?? '', 10)
  const day = Number.parseInt(dayValue ?? '', 10)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return parseStoredDateTime(value)
  }

  return new Date(year, month - 1, day)
}

export default ModuloEntrenamiento
