import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Gift,
  History,
  KanbanSquare,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  normalizeActividad,
  normalizeSubtarea,
  normalizeTareaKanban,
  type Actividad,
  type ActividadCategoria,
  type Subtarea,
  type TareaKanban,
} from '../lib/dashboardModels'
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  formatDateLabel,
  formatTimeLabel,
  isSameDay,
  parseStoredDateTime,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../lib/dateUtils'
import { supabase } from '../lib/supabaseClient'

type ModuloTiempoProps = {
  onDataChanged: () => void
  userId: string
}

type TiempoTab = 'kanban' | 'calendario' | 'agenda'
type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6
type ActivitySubtype =
  | 'general'
  | 'examen'
  | 'entrega'
  | 'cumpleanos'
  | 'viaje'
  | 'actividad_fisica'
type AgendaZoomMinutes = 30 | 60 | 120

type GiftIdea = {
  descripcion: string
  id: string
}

type EventFormState = {
  birthdayContact: string
  birthdayDate: string
  birthdayMessage: string
  category: ActividadCategoria
  color: string
  descripcion: string
  endDate: string
  endTime: string
  gifts: GiftIdea[]
  hasEndDateTime: boolean
  repeatDays: WeekdayIndex[]
  repeatStartDate: string
  startDate: string
  startTime: string
  titulo: string
  visibleMonthly: boolean
}

type ActivityPayload = {
  categoria: ActividadCategoria
  color: string
  datos_extra: Record<string, unknown>
  descripcion: string
  fecha_fin: string | null
  fecha_inicio: string
  ocurrencia_fecha: string | null
  oculta_calendarios: boolean
  serie_id: string | null
  tipo: Actividad['tipo']
  titulo: string
  user_id: string
  visible_calendario_mensual: boolean
}

type EditableSubtask = {
  completada: boolean
  descripcion: string
  id: string | null
}

type TaskModalState = {
  actividadId: string
  descripcion: string
  pomodoroDurationMinutes: string
  pomodorosEstimados: string
  subtareas: EditableSubtask[]
  taskId: string | null
  titulo: string
  usePomodoros: boolean
}

type TaskPomodoroConfig = {
  durationMinutes: number
  enabled: boolean
}

type PomodoroSession = {
  durationSeconds: number
  phase: 'countdown' | 'running'
  secondsRemaining: number
  taskId: string
  warningAnnounced: boolean
}

type ActivityBadge = {
  color: string
  dayKey: string
  id: string
  isBirthdayHighlight: boolean
  subtitle: string
  timeLabel: string
  titulo: string
}

type AgendaTimeSlot = {
  endMinutes: number
  id: string
  label: string
  startMinutes: number
}

type AgendaDayColumn = {
  day: Date
  timedActivities: Actividad[]
}

type AgendaInteractionMode = 'move' | 'resize-start' | 'resize-end'

type AgendaInteraction = {
  activityId: string
  dayIndex: number
  mode: AgendaInteractionMode
  originalEndIso: string
  originalStartIso: string
  pointerId: number
  pointerOffsetMinutes: number
  previewEndIso: string
  previewStartIso: string
}

const kanbanColumns = ['pendientes', 'in_progress', 'done'] satisfies Array<
  TareaKanban['columna']
>

const columnLabels: Record<(typeof kanbanColumns)[number], string> = {
  pendientes: 'Pendientes',
  in_progress: 'En progreso',
  done: 'Completadas',
}

const activityCategoryLabels: Record<ActividadCategoria, string> = {
  evento_unico: 'Evento unico',
  actividad_fisica: 'Actividad fisica',
  cumpleanos: 'Cumpleanos',
  juntada: 'Juntada',
  actividad_rutinaria: 'Actividad rutinaria',
  tiempo_dedicado: 'Tiempo dedicado',
}

const weekdayOptions: Array<{ label: string; value: WeekdayIndex }> = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mie', value: 3 },
  { label: 'Jue', value: 4 },
  { label: 'Vie', value: 5 },
  { label: 'Sab', value: 6 },
  { label: 'Dom', value: 0 },
]

const selectClassName =
  'w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/65 focus:ring-4 focus:ring-sky-300/15'

const optionClassName = 'bg-slate-900 text-white'

const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300/65 focus:ring-4 focus:ring-sky-300/15'

const textareaClassName =
  'min-h-28 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300/65 focus:ring-4 focus:ring-sky-300/15'

const hiddenTaskNotePrefix = '[[descripcion]]'
const hiddenTaskPomodoroPrefix = '[[pomodoro:'
const agendaZoomLevels: AgendaZoomMinutes[] = [120, 60, 30]
const agendaZoomLabels: Record<AgendaZoomMinutes, string> = {
  120: '2 horas',
  60: '1 hora',
  30: '30 minutos',
}
const agendaRowHeights: Record<AgendaZoomMinutes, number> = {
  120: 56,
  60: 64,
  30: 72,
}
const defaultAgendaStartMinutes = 8 * 60
const defaultAgendaEndMinutes = 22 * 60

function ModuloTiempo({ onDataChanged, userId }: ModuloTiempoProps) {
  const [activeTab, setActiveTab] = useState<TiempoTab>('kanban')
  const [agendaZoomMinutes, setAgendaZoomMinutes] = useState<AgendaZoomMinutes>(120)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date()),
  )
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [tareas, setTareas] = useState<TareaKanban[]>([])
  const [subtareas, setSubtareas] = useState<Subtarea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showTaskHistoryModal, setShowTaskHistoryModal] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [archivingTaskId, setArchivingTaskId] = useState<string | null>(null)
  const [restoringTaskId, setRestoringTaskId] = useState<string | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TareaKanban['columna'] | null>(
    null,
  )
  const [pomodoroSession, setPomodoroSession] = useState<PomodoroSession | null>(null)
  const [eventForm, setEventForm] = useState<EventFormState>(() =>
    createDefaultEventForm(new Date()),
  )
  const [taskModalState, setTaskModalState] = useState<TaskModalState>(
    createDefaultTaskModalState(),
  )
  const [previewActivity, setPreviewActivity] = useState<Actividad | null>(null)
  const [activeAgendaInteraction, setActiveAgendaInteraction] = useState<{
    activityId: string
    mode: AgendaInteractionMode
  } | null>(null)
  const agendaDayRefs = useRef<Array<HTMLDivElement | null>>([])
  const agendaInteractionRef = useRef<AgendaInteraction | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const activePomodoroTaskId = pomodoroSession?.taskId ?? null

  const fetchModuleData = useCallback(async () => {
    const weekStart = currentWeekStart
    const weekEnd = endOfWeek(currentWeekStart)
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const rangeStart = new Date(Math.min(monthStart.getTime(), weekStart.getTime()))
    const rangeEnd = new Date(Math.max(monthEnd.getTime(), weekEnd.getTime()))

    const [actividadesResponse, tareasResponse, subtareasResponse] =
      await Promise.all([
        supabase
          .from('actividades')
          .select('*')
          .eq('user_id', userId)
          .eq('oculta_calendarios', false)
          .gte('fecha_inicio', rangeStart.toISOString())
          .lte('fecha_inicio', endOfDay(rangeEnd).toISOString())
          .order('fecha_inicio', { ascending: true }),
        supabase
          .from('tareas_kanban')
          .select('*')
          .eq('user_id', userId)
          .order('columna', { ascending: true })
          .order('posicion', { ascending: true }),
        supabase.from('subtareas').select('*').order('id', { ascending: true }),
      ])

    if (actividadesResponse.error) {
      throw new Error(actividadesResponse.error.message)
    }

    if (tareasResponse.error) {
      throw new Error(tareasResponse.error.message)
    }

    if (subtareasResponse.error) {
      throw new Error(subtareasResponse.error.message)
    }

    setActividades(
      (actividadesResponse.data ?? []).map((row, index) =>
        normalizeActividad(row, index),
      ),
    )
    setTareas(
      (tareasResponse.data ?? []).map((row, index) =>
        normalizeTareaKanban(row, index),
      ),
    )
    setSubtareas(
      (subtareasResponse.data ?? []).map((row, index) =>
        normalizeSubtarea(row, index),
      ),
    )
  }, [currentMonth, currentWeekStart, userId])

  useEffect(() => {
    let isMounted = true

    const loadModuleData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        await fetchModuleData()
      } catch (issue) {
        if (!isMounted) {
          return
        }

        setError(
          issue instanceof Error
            ? issue.message
            : 'No pudimos cargar la informacion del modulo.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadModuleData()

    return () => {
      isMounted = false
    }
  }, [fetchModuleData])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const monthCalendarCells = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const totalDays = monthEnd.getDate()
    const leadingEmptyCells = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1
    const monthDays = Array.from({ length: totalDays }, (_, index) =>
      addDays(monthStart, index),
    )
    const trailingEmptyCells =
      (7 - ((leadingEmptyCells + monthDays.length) % 7)) % 7

    return [
      ...Array.from({ length: leadingEmptyCells }, () => null),
      ...monthDays,
      ...Array.from({ length: trailingEmptyCells }, () => null),
    ]
  }, [currentMonth])

  const weeklyDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index))
  }, [currentWeekStart])

  const weeklyAgendaColumns = useMemo<AgendaDayColumn[]>(() => {
    return weeklyDays.map((day) => {
      const dayActivities = actividades
        .filter((actividad) => isSameDay(parseStoredActivityStart(actividad), day))
        .sort(
          (first, second) =>
            parseStoredActivityStart(first).getTime() -
            parseStoredActivityStart(second).getTime(),
        )

      return {
        day,
        timedActivities: dayActivities.filter((actividad) => !isAllDayActivity(actividad)),
      }
    })
  }, [actividades, weeklyDays])

  const weeklyScheduleRange = useMemo(
    () => createAgendaVisibleRange(weeklyAgendaColumns, agendaZoomMinutes),
    [agendaZoomMinutes, weeklyAgendaColumns],
  )

  const weeklyScheduleSlots = useMemo(
    () =>
      createAgendaTimeSlots(
        agendaZoomMinutes,
        weeklyScheduleRange.startMinutes,
        weeklyScheduleRange.endMinutes,
      ),
    [agendaZoomMinutes, weeklyScheduleRange],
  )

  const subtasksByTask = useMemo(() => {
    return subtareas.reduce<Record<string, Subtarea[]>>((grouped, subtask) => {
      if (!grouped[subtask.tarea_id]) {
        grouped[subtask.tarea_id] = []
      }

      grouped[subtask.tarea_id]?.push(subtask)
      return grouped
    }, {})
  }, [subtareas])

  const pomodoroConfigByTask = useMemo(() => {
    return tareas.reduce<Record<string, TaskPomodoroConfig>>((grouped, task) => {
      grouped[task.id] = getTaskPomodoroConfig(task, subtasksByTask[task.id] ?? [])
      return grouped
    }, {})
  }, [subtasksByTask, tareas])

  const activeTasks = useMemo(
    () => tareas.filter((task) => task.columna !== 'archived'),
    [tareas],
  )

  const completedTasks = useMemo(
    () => tareas.filter((task) => task.columna === 'done'),
    [tareas],
  )

  const archivedTasks = useMemo(
    () => tareas.filter((task) => task.columna === 'archived'),
    [tareas],
  )

  const calendarActivities = useMemo(() => {
    return actividades.reduce<Record<string, ActivityBadge[]>>((grouped, actividad) => {
      if (!actividad.visible_calendario_mensual) {
        return grouped
      }

      const dayKey = startOfDay(parseStoredActivityStart(actividad)).toISOString()
      const birthdayHighlight = isBirthdayHighlightWindow(actividad)
      const badge: ActivityBadge = {
        id: actividad.id,
        dayKey,
        titulo: actividad.titulo,
        timeLabel:
          getActivityCategory(actividad) === 'cumpleanos'
            ? 'Todo el dia'
            : getActivityTimeRange(actividad),
        subtitle: activityCategoryLabels[getActivityCategory(actividad)],
        color: resolveActivityColor(actividad),
        isBirthdayHighlight: birthdayHighlight,
      }

      if (!grouped[dayKey]) {
        grouped[dayKey] = []
      }

      grouped[dayKey]?.push(badge)
      return grouped
    }, {})
  }, [actividades])

  const refreshAll = useCallback(async () => {
    await fetchModuleData()
  }, [fetchModuleData])

  const handleMoreDetailedAgenda = () => {
    setAgendaZoomMinutes((currentValue) => {
      const currentIndex = agendaZoomLevels.indexOf(currentValue)
      return agendaZoomLevels[Math.min(currentIndex + 1, agendaZoomLevels.length - 1)]
    })
  }

  const handleLessDetailedAgenda = () => {
    setAgendaZoomMinutes((currentValue) => {
      const currentIndex = agendaZoomLevels.indexOf(currentValue)
      return agendaZoomLevels[Math.max(currentIndex - 1, 0)]
    })
  }

  const handlePreviousAgendaWeek = () => {
    setCurrentWeekStart((currentValue) => startOfWeek(addDays(currentValue, -7)))
  }

  const handleNextAgendaWeek = () => {
    setCurrentWeekStart((currentValue) => startOfWeek(addDays(currentValue, 7)))
  }

  const applyActivityScheduleLocally = useCallback((
    activityId: string,
    nextStartAt: Date,
    nextEndAt: Date,
  ) => {
    setActividades((currentActivities) =>
      currentActivities.map((actividad) =>
        actividad.id === activityId
          ? {
              ...actividad,
              fecha_inicio: nextStartAt.toISOString(),
              fecha_fin: nextEndAt.toISOString(),
              ocurrencia_fecha: toDateInputValue(nextStartAt),
            }
          : actividad,
      ),
    )
  }, [])

  const persistActivitySchedule = useCallback(async (
    activityId: string,
    nextStartAt: Date,
    nextEndAt: Date,
  ) => {
    const { error: updateError } = await supabase
      .from('actividades')
      .update({
        fecha_inicio: nextStartAt.toISOString(),
        fecha_fin: nextEndAt.toISOString(),
        ocurrencia_fecha: toDateInputValue(nextStartAt),
      })
      .eq('id', activityId)
      .eq('user_id', userId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }, [userId])

  const finishAgendaInteraction = useCallback(async (shouldCancel = false) => {
    const interaction = agendaInteractionRef.current
    if (!interaction) {
      return
    }

    agendaInteractionRef.current = null
    setActiveAgendaInteraction(null)

    const originalStartAt = parseStoredDateTime(interaction.originalStartIso)
    const originalEndAt = parseStoredDateTime(interaction.originalEndIso)
    const previewStartAt = parseStoredDateTime(interaction.previewStartIso)
    const previewEndAt = parseStoredDateTime(interaction.previewEndIso)

    if (shouldCancel) {
      applyActivityScheduleLocally(
        interaction.activityId,
        originalStartAt,
        originalEndAt,
      )
      return
    }

    if (
      previewStartAt.getTime() === originalStartAt.getTime() &&
      previewEndAt.getTime() === originalEndAt.getTime()
    ) {
      return
    }

    if (
      hasActivityOverlap({
        activities: actividades,
        excludeActivityId: interaction.activityId,
        nextStartAt: previewStartAt,
        nextEndAt: previewEndAt,
      })
    ) {
      applyActivityScheduleLocally(
        interaction.activityId,
        originalStartAt,
        originalEndAt,
      )
      setMutationError(
        'No puedes superponer dos actividades en el mismo horario. El cambio fue cancelado.',
      )
      return
    }

    setMutationError(null)

    try {
      await persistActivitySchedule(
        interaction.activityId,
        previewStartAt,
        previewEndAt,
      )
      onDataChanged()
    } catch (issue) {
      applyActivityScheduleLocally(
        interaction.activityId,
        originalStartAt,
        originalEndAt,
      )
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos actualizar el horario de la actividad.',
      )
    }
  }, [
    actividades,
    applyActivityScheduleLocally,
    onDataChanged,
    persistActivitySchedule,
  ])

  const startAgendaInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    actividad: Actividad,
    dayIndex: number,
    mode: AgendaInteractionMode,
  ) => {
    if (event.button !== 0) {
      return
    }

    const timelineElement = agendaDayRefs.current[dayIndex]
    if (!timelineElement) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const startAt = parseStoredActivityStart(actividad)
    const pixelsPerMinute = getAgendaPixelsPerMinute(
      agendaRowHeights[agendaZoomMinutes],
      agendaZoomMinutes,
    )
    const timelineRect = timelineElement.getBoundingClientRect()
    const pointerMinutes =
      weeklyScheduleRange.startMinutes +
      (event.clientY - timelineRect.top) / pixelsPerMinute
    const pointerOffsetMinutes =
      mode === 'move'
        ? pointerMinutes - getMinutesSinceStartOfDay(startAt)
        : 0

    agendaInteractionRef.current = {
      activityId: actividad.id,
      dayIndex,
      mode,
      pointerId: event.pointerId,
      pointerOffsetMinutes,
      originalStartIso: actividad.fecha_inicio,
      originalEndIso: actividad.fecha_fin ?? actividad.fecha_inicio,
      previewStartIso: actividad.fecha_inicio,
      previewEndIso: actividad.fecha_fin ?? actividad.fecha_inicio,
    }

    setActiveAgendaInteraction({
      activityId: actividad.id,
      mode,
    })
  }

  useEffect(() => {
    if (!activeAgendaInteraction) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const interaction = agendaInteractionRef.current
      if (!interaction || event.pointerId !== interaction.pointerId) {
        return
      }

      const rowHeight = agendaRowHeights[agendaZoomMinutes]
      const pixelsPerMinute = getAgendaPixelsPerMinute(rowHeight, agendaZoomMinutes)

      let nextDayIndex = interaction.dayIndex
      if (interaction.mode === 'move') {
        nextDayIndex = resolveAgendaDayIndexFromPointer(
          event.clientX,
          agendaDayRefs.current,
          interaction.dayIndex,
        )
      }

      const timelineElement = agendaDayRefs.current[nextDayIndex]
      if (!timelineElement) {
        return
      }

      const timelineRect = timelineElement.getBoundingClientRect()
      const pointerMinutes = clampMinutesToDay(
        weeklyScheduleRange.startMinutes +
          (event.clientY - timelineRect.top) / pixelsPerMinute,
      )
      const previewStartAt = parseStoredDateTime(interaction.previewStartIso)
      const previewEndAt = parseStoredDateTime(interaction.previewEndIso)
      const previewDurationMinutes = Math.max(
        5,
        getMinutesBetween(previewStartAt, previewEndAt),
      )

      let nextStartMinutes = getMinutesSinceStartOfDay(previewStartAt)
      let nextEndMinutes = getMinutesSinceStartOfDay(previewEndAt)

      if (interaction.mode === 'move') {
        const snappedStart = snapMinutesToStep(
          pointerMinutes - interaction.pointerOffsetMinutes,
          5,
        )
        nextStartMinutes = clampMinutesToDay(
          Math.min(snappedStart, 24 * 60 - previewDurationMinutes),
        )
        nextEndMinutes = nextStartMinutes + previewDurationMinutes
      }

      if (interaction.mode === 'resize-start') {
        const snappedStart = snapMinutesToStep(pointerMinutes, 5)
        nextStartMinutes = clampMinutesToDay(
          Math.min(snappedStart, nextEndMinutes - 5),
        )
      }

      if (interaction.mode === 'resize-end') {
        const snappedEnd = snapMinutesToStep(pointerMinutes, 5)
        nextEndMinutes = clampMinutesToDay(
          Math.max(snappedEnd, nextStartMinutes + 5),
        )
      }

      const targetDay = weeklyDays[nextDayIndex] ?? weeklyDays[interaction.dayIndex]
      const nextStartAt = createDateFromDayAndMinutes(targetDay, nextStartMinutes)
      const nextEndAt = createDateFromDayAndMinutes(targetDay, nextEndMinutes)

      agendaInteractionRef.current = {
        ...interaction,
        dayIndex: nextDayIndex,
        previewStartIso: nextStartAt.toISOString(),
        previewEndIso: nextEndAt.toISOString(),
      }

      applyActivityScheduleLocally(interaction.activityId, nextStartAt, nextEndAt)
    }

    const handlePointerEnd = (event: PointerEvent) => {
      const interaction = agendaInteractionRef.current
      if (!interaction || event.pointerId !== interaction.pointerId) {
        return
      }

      void finishAgendaInteraction()
    }

    const handlePointerCancel = (event: PointerEvent) => {
      const interaction = agendaInteractionRef.current
      if (!interaction || event.pointerId !== interaction.pointerId) {
        return
      }

      void finishAgendaInteraction(true)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [
    activeAgendaInteraction,
    agendaZoomMinutes,
    applyActivityScheduleLocally,
    finishAgendaInteraction,
    weeklyScheduleRange.startMinutes,
    weeklyDays,
  ])

  const openEventModal = (day?: Date, forcedCategory?: ActividadCategoria) => {
    setMutationError(null)
    setEditingActivityId(null)
    setEventForm(createDefaultEventForm(day ?? new Date(), forcedCategory))
    setShowEventModal(true)
  }

  const openEventModalForEdit = (actividad: Actividad) => {
    setMutationError(null)
    setPreviewActivity(null)
    setEditingActivityId(actividad.id)
    setEventForm(createEventFormFromActivity(actividad))
    setShowEventModal(true)
  }

  const openTaskModalForCreate = () => {
    setMutationError(null)
    setTaskModalState(createDefaultTaskModalState())
    setShowTaskModal(true)
  }

  const openTaskModalForEdit = (task: TareaKanban) => {
    const relatedSubtasks = subtasksByTask[task.id] ?? []
    const { description, visibleSubtasks } = splitTaskDescriptionSubtasks(
      relatedSubtasks,
    )
    const pomodoroConfig = getTaskPomodoroConfig(task, relatedSubtasks)

    setMutationError(null)
    setTaskModalState({
      taskId: task.id,
      titulo: task.titulo,
      descripcion: description,
      actividadId: task.actividad_id ?? '',
      usePomodoros: pomodoroConfig.enabled,
      pomodorosEstimados: String(Math.max(task.pomodoros_estimados, 1)),
      pomodoroDurationMinutes: String(pomodoroConfig.durationMinutes),
      subtareas:
        visibleSubtasks.length > 0
          ? visibleSubtasks.map((subtask) => ({
              id: subtask.id,
              descripcion: subtask.descripcion,
              completada: subtask.completada,
            }))
          : [{ id: null, descripcion: '', completada: false }],
    })
    setShowTaskModal(true)
  }

  const handleEventInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const target = event.target
    const { name } = target
    const value =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value

    setEventForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [name]: value,
      } as EventFormState

      if (name === 'category' && isActivityCategory(value)) {
        nextForm.color = getDefaultActivityCategoryColor(value)

        if (value === 'cumpleanos') {
          nextForm.birthdayDate = currentForm.startDate
        }

        if (value === 'juntada') {
          nextForm.hasEndDateTime = false
        }
      }

      if (nextForm.category === 'cumpleanos') {
        nextForm.startTime = '00:00'
        nextForm.endTime = '23:59'
      }

      return nextForm
    })
  }

  const handleToggleRepeatDay = (weekday: WeekdayIndex) => {
    setEventForm((currentForm) => {
      const hasDay = currentForm.repeatDays.includes(weekday)
      const nextDays = hasDay
        ? currentForm.repeatDays.filter((day) => day !== weekday)
        : [...currentForm.repeatDays, weekday]

      return {
        ...currentForm,
        repeatDays: sortWeekdays(nextDays),
      }
    })
  }

  const handleAddGiftField = () => {
    setEventForm((currentForm) => ({
      ...currentForm,
      gifts: [...currentForm.gifts, createEmptyGiftIdea()],
    }))
  }

  const handleGiftChange = (giftId: string, value: string) => {
    setEventForm((currentForm) => ({
      ...currentForm,
      gifts: currentForm.gifts.map((gift) =>
        gift.id === giftId ? { ...gift, descripcion: value } : gift,
      ),
    }))
  }

  const handleRemoveGiftField = (giftId: string) => {
    setEventForm((currentForm) => ({
      ...currentForm,
      gifts:
        currentForm.gifts.length === 1
          ? [createEmptyGiftIdea()]
          : currentForm.gifts.filter((gift) => gift.id !== giftId),
    }))
  }

  const handleTaskFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const target = event.target
    const { name } = target
    const value =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value

    setTaskModalState((currentForm) => {
      const nextForm = {
        ...currentForm,
        [name]: value,
      }

      if (name === 'usePomodoros' && value === false) {
        nextForm.pomodorosEstimados = '1'
        nextForm.pomodoroDurationMinutes = '25'
      }

      return nextForm
    })
  }

  const handleSubtaskChange = (
    index: number,
    field: keyof EditableSubtask,
    value: string | boolean,
  ) => {
    setTaskModalState((currentForm) => ({
      ...currentForm,
      subtareas: currentForm.subtareas.map((subtask, subtaskIndex) =>
        subtaskIndex === index
          ? {
              ...subtask,
              [field]: value,
            }
          : subtask,
      ),
    }))
  }

  const handleAddSubtaskField = () => {
    setTaskModalState((currentForm) => ({
      ...currentForm,
      subtareas: [
        ...currentForm.subtareas,
        { id: null, descripcion: '', completada: false },
      ],
    }))
  }

  const handleRemoveSubtaskField = (index: number) => {
    setTaskModalState((currentForm) => {
      if (currentForm.subtareas.length === 1) {
        return {
          ...currentForm,
          subtareas: [{ id: null, descripcion: '', completada: false }],
        }
      }

      return {
        ...currentForm,
        subtareas: currentForm.subtareas.filter(
          (_, subtaskIndex) => subtaskIndex !== index,
        ),
      }
    })
  }

  const handleCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingEvent(true)

    try {
      const editingActivity = editingActivityId
        ? actividades.find((actividad) => actividad.id === editingActivityId) ?? null
        : null
      const payloads =
        editingActivityId && editingActivity
          ? [buildSingleActivityPayloadFromForm(eventForm, userId, editingActivity)]
          : buildActivityPayloadsFromForm(eventForm, userId)

      const hasOverlap = payloads.some((payload) => {
        if (!payload.fecha_fin) {
          return false
        }

        const startAt = parseStoredDateTime(payload.fecha_inicio)
        const endAt = parseStoredDateTime(payload.fecha_fin)

        return hasActivityOverlap({
          activities: actividades,
          excludeActivityId: editingActivityId ?? undefined,
          nextStartAt: startAt,
          nextEndAt: endAt,
        })
      })

      if (hasOverlap) {
        throw new Error(
          'No puedes superponer dos actividades en el mismo horario. Ajusta el inicio o el fin antes de guardar.',
        )
      }

      if (editingActivityId) {
        const { error: updateError } = await supabase
          .from('actividades')
          .update(payloads[0])
          .eq('id', editingActivityId)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: insertError } = await supabase
          .from('actividades')
          .insert(payloads)

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      await refreshAll()
      onDataChanged()
      setShowEventModal(false)
      setEditingActivityId(null)
      setEventForm(createDefaultEventForm(new Date()))
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos guardar la actividad.',
      )
    } finally {
      setSavingEvent(false)
    }
  }

  const handleHidePreviewActivity = async (scope: 'single' | 'series') => {
    if (!previewActivity) {
      return
    }

    setMutationError(null)
    setDeletingActivityId(previewActivity.id)

    try {
      const query = supabase
        .from('actividades')
        .update({
          oculta_calendarios: true,
          eliminada_calendario_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      const { error: hideActivityError } =
        scope === 'series' && previewActivity.serie_id
          ? await query.eq('serie_id', previewActivity.serie_id)
          : await query.eq('id', previewActivity.id)

      if (hideActivityError) {
        throw new Error(hideActivityError.message)
      }

      await refreshAll()
      onDataChanged()
      setPreviewActivity(null)
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos ocultar la actividad del calendario.',
      )
    } finally {
      setDeletingActivityId(null)
    }
  }

  const handleSaveTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingTask(true)

    try {
      const title = taskModalState.titulo.trim()
      if (!title) {
        throw new Error('Ingresa un titulo para la tarea.')
      }

      const usePomodoros = taskModalState.usePomodoros
      const pomodorosEstimados = usePomodoros
        ? Math.max(1, Number.parseInt(taskModalState.pomodorosEstimados, 10) || 1)
        : 0
      const pomodoroDurationMinutes = usePomodoros
        ? Math.max(1, Number.parseInt(taskModalState.pomodoroDurationMinutes, 10) || 25)
        : 25
      const cleanedVisibleSubtasks = taskModalState.subtareas
        .map((subtask) => ({
          ...subtask,
          descripcion: subtask.descripcion.trim(),
        }))
        .filter((subtask) => subtask.descripcion.length > 0)

      const existingTask =
        taskModalState.taskId !== null
          ? tareas.find((task) => task.id === taskModalState.taskId) ?? null
          : null

      let taskId = taskModalState.taskId

      if (taskId) {
        const nextCompletedPomodoros = usePomodoros
          ? Math.min(existingTask?.pomodoros_completados ?? 0, pomodorosEstimados)
          : 0
        const { error: updateError } = await supabase
          .from('tareas_kanban')
          .update({
            titulo: title,
            actividad_id: taskModalState.actividadId || null,
            pomodoros_estimados: pomodorosEstimados,
            pomodoros_completados: nextCompletedPomodoros,
          })
          .eq('id', taskId)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const nextPosition = tareas.filter((task) => task.columna === 'pendientes').length
        const { data, error: insertError } = await supabase
          .from('tareas_kanban')
          .insert({
            user_id: userId,
            titulo: title,
            actividad_id: taskModalState.actividadId || null,
            columna: serializeTaskColumn('pendientes'),
            posicion: nextPosition,
            pomodoros_estimados: pomodorosEstimados,
            pomodoros_completados: 0,
          })
          .select('id')
          .single()

        if (insertError) {
          throw new Error(insertError.message)
        }

        taskId = String(data.id)
      }

      if (!taskId) {
        throw new Error('No pudimos identificar la tarea para guardar sus subtareas.')
      }

      const currentSubtasks = subtasksByTask[taskId] ?? []
      const { descriptionSubtask, pomodoroConfigSubtask, visibleSubtasks } =
        splitTaskDescriptionSubtasks(currentSubtasks)
      const visibleIdsInForm = new Set(
        cleanedVisibleSubtasks
          .map((subtask) => subtask.id)
          .filter((subtaskId): subtaskId is string => typeof subtaskId === 'string'),
      )

      const subtasksToDelete = visibleSubtasks.filter(
        (subtask) => !visibleIdsInForm.has(subtask.id),
      )

      if (subtasksToDelete.length > 0) {
        const { error: deleteSubtasksError } = await supabase
          .from('subtareas')
          .delete()
          .in(
            'id',
            subtasksToDelete.map((subtask) => subtask.id),
          )

        if (deleteSubtasksError) {
          throw new Error(deleteSubtasksError.message)
        }
      }

      for (const subtask of cleanedVisibleSubtasks) {
        if (subtask.id) {
          const { error: updateSubtaskError } = await supabase
            .from('subtareas')
            .update({
              descripcion: subtask.descripcion,
              completada: subtask.completada,
            })
            .eq('id', subtask.id)

          if (updateSubtaskError) {
            throw new Error(updateSubtaskError.message)
          }
        } else {
          const { error: insertSubtaskError } = await supabase.from('subtareas').insert({
            tarea_id: taskId,
            descripcion: subtask.descripcion,
            completada: subtask.completada,
          })

          if (insertSubtaskError) {
            throw new Error(insertSubtaskError.message)
          }
        }
      }

      const nextDescription = taskModalState.descripcion.trim()
      if (descriptionSubtask && !nextDescription) {
        const { error: deleteDescriptionError } = await supabase
          .from('subtareas')
          .delete()
          .eq('id', descriptionSubtask.id)

        if (deleteDescriptionError) {
          throw new Error(deleteDescriptionError.message)
        }
      }

      if (descriptionSubtask && nextDescription) {
        const { error: updateDescriptionError } = await supabase
          .from('subtareas')
          .update({
            descripcion: buildTaskDescriptionValue(nextDescription),
            completada: false,
          })
          .eq('id', descriptionSubtask.id)

        if (updateDescriptionError) {
          throw new Error(updateDescriptionError.message)
        }
      }

      if (!descriptionSubtask && nextDescription) {
        const { error: insertDescriptionError } = await supabase
          .from('subtareas')
          .insert({
            tarea_id: taskId,
            descripcion: buildTaskDescriptionValue(nextDescription),
            completada: false,
          })

        if (insertDescriptionError) {
          throw new Error(insertDescriptionError.message)
        }
      }

      if (pomodoroConfigSubtask && !usePomodoros) {
        const { error: deletePomodoroConfigError } = await supabase
          .from('subtareas')
          .delete()
          .eq('id', pomodoroConfigSubtask.id)

        if (deletePomodoroConfigError) {
          throw new Error(deletePomodoroConfigError.message)
        }
      }

      if (pomodoroConfigSubtask && usePomodoros) {
        const { error: updatePomodoroConfigError } = await supabase
          .from('subtareas')
          .update({
            descripcion: buildPomodoroConfigValue(pomodoroDurationMinutes),
            completada: false,
          })
          .eq('id', pomodoroConfigSubtask.id)

        if (updatePomodoroConfigError) {
          throw new Error(updatePomodoroConfigError.message)
        }
      }

      if (!pomodoroConfigSubtask && usePomodoros) {
        const { error: insertPomodoroConfigError } = await supabase
          .from('subtareas')
          .insert({
            tarea_id: taskId,
            descripcion: buildPomodoroConfigValue(pomodoroDurationMinutes),
            completada: false,
          })

        if (insertPomodoroConfigError) {
          throw new Error(insertPomodoroConfigError.message)
        }
      }

      await refreshAll()
      onDataChanged()
      setShowTaskModal(false)
      setTaskModalState(createDefaultTaskModalState())

      if (
        activePomodoroTaskId &&
        (!existingTask || existingTask.id === activePomodoroTaskId)
      ) {
        cancelPomodoroSession()
      }
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos guardar la tarea.',
      )
    } finally {
      setSavingTask(false)
    }
  }

  const handleDeleteTask = async () => {
    const taskId = taskModalState.taskId
    if (!taskId) {
      return
    }

    setMutationError(null)
    setDeletingTaskId(taskId)

    try {
      const { error: deleteSubtasksError } = await supabase
        .from('subtareas')
        .delete()
        .eq('tarea_id', taskId)

      if (deleteSubtasksError) {
        throw new Error(deleteSubtasksError.message)
      }

      const { error: deleteTaskError } = await supabase
        .from('tareas_kanban')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId)

      if (deleteTaskError) {
        throw new Error(deleteTaskError.message)
      }

      await refreshAll()
      onDataChanged()
      if (activePomodoroTaskId === taskId) {
        cancelPomodoroSession()
      }
      setShowTaskModal(false)
      setTaskModalState(createDefaultTaskModalState())
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos eliminar la tarea.',
      )
    } finally {
      setDeletingTaskId(null)
    }
  }

  const handleToggleSubtask = async (subtask: Subtarea) => {
    setMutationError(null)

    try {
      const { error: updateError } = await supabase
        .from('subtareas')
        .update({
          completada: !subtask.completada,
        })
        .eq('id', subtask.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      await refreshAll()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos actualizar la subtarea.',
      )
    }
  }

  const handleTaskColumnChange = async (
    task: TareaKanban,
    nextColumn: TareaKanban['columna'],
  ) => {
    if (task.columna === nextColumn) {
      return
    }

    setMutationError(null)

    try {
      const nextPosition = tareas.filter((item) => item.columna === nextColumn).length
      const { error: updateError } = await supabase
        .from('tareas_kanban')
        .update({
          columna: serializeTaskColumn(nextColumn),
          posicion: nextPosition,
        })
        .eq('id', task.id)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      await refreshAll()
      onDataChanged()
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos mover la tarea.',
      )
    }
  }

  const handleArchiveTask = async (task: TareaKanban) => {
    if (task.columna !== 'done') {
      setMutationError('Solo puedes enviar al historial tareas finalizadas.')
      return
    }

    setMutationError(null)
    setArchivingTaskId(task.id)

    try {
      const nextPosition = archivedTasks.length
      const { error: updateError } = await supabase
        .from('tareas_kanban')
        .update({
          columna: serializeTaskColumn('archived'),
          posicion: nextPosition,
          archivada_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      await refreshAll()
      onDataChanged()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos enviar la tarea al historial.',
      )
    } finally {
      setArchivingTaskId(null)
    }
  }

  const handleRestoreTaskFromHistory = async (task: TareaKanban) => {
    setMutationError(null)
    setRestoringTaskId(task.id)

    try {
      const nextPosition = tareas.filter((item) => item.columna === 'done').length
      const { error: updateError } = await supabase
        .from('tareas_kanban')
        .update({
          columna: serializeTaskColumn('done'),
          posicion: nextPosition,
          archivada_at: null,
        })
        .eq('id', task.id)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      await refreshAll()
      onDataChanged()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos traer la tarea al kanban.',
      )
    } finally {
      setRestoringTaskId(null)
    }
  }

  const handleDeleteTaskPermanently = async (task: TareaKanban) => {
    setMutationError(null)
    setDeletingTaskId(task.id)

    try {
      const { error: deleteSubtasksError } = await supabase
        .from('subtareas')
        .delete()
        .eq('tarea_id', task.id)

      if (deleteSubtasksError) {
        throw new Error(deleteSubtasksError.message)
      }

      const { error: deleteTaskError } = await supabase
        .from('tareas_kanban')
        .delete()
        .eq('id', task.id)
        .eq('user_id', userId)

      if (deleteTaskError) {
        throw new Error(deleteTaskError.message)
      }

      await refreshAll()
      onDataChanged()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos eliminar definitivamente la tarea.',
      )
    } finally {
      setDeletingTaskId(null)
    }
  }

  const handleTaskDragStart = (
    event: DragEvent<HTMLElement>,
    task: TareaKanban,
  ) => {
    setDraggedTaskId(task.id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }

  const handleTaskDrop = async (
    event: DragEvent<HTMLDivElement>,
    nextColumn: TareaKanban['columna'],
  ) => {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/plain') || draggedTaskId
    const task = tareas.find((candidateTask) => candidateTask.id === taskId)

    setDraggedTaskId(null)
    setDragOverColumn(null)

    if (!task) {
      return
    }

    await handleTaskColumnChange(task, nextColumn)
  }

  const cancelPomodoroSession = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    setPomodoroSession(null)
  }, [])

  const completePomodoroCycle = useCallback(async (taskId: string) => {
    const task = tareas.find((candidateTask) => candidateTask.id === taskId)
    if (!task) {
      cancelPomodoroSession()
      return
    }

    const pomodoroConfig = pomodoroConfigByTask[task.id] ?? getDefaultPomodoroConfig()
    if (!pomodoroConfig.enabled) {
      cancelPomodoroSession()
      return
    }

    setMutationError(null)
    cancelPomodoroSession()

    try {
      const nextCompletedPomodoros = task.pomodoros_completados + 1
      const nextColumn =
        nextCompletedPomodoros >= task.pomodoros_estimados ? 'done' : 'in_progress'
      const { error: updateError } = await supabase
        .from('tareas_kanban')
        .update({
          pomodoros_completados: nextCompletedPomodoros,
          columna: serializeTaskColumn(nextColumn),
        })
        .eq('id', task.id)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      await refreshAll()
      onDataChanged()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos actualizar los pomodoros.',
      )
    }
  }, [
    cancelPomodoroSession,
    onDataChanged,
    pomodoroConfigByTask,
    refreshAll,
    tareas,
    userId,
  ])

  useEffect(() => {
    if (!pomodoroSession) {
      return
    }

    if (pomodoroSession.phase === 'countdown' && pomodoroSession.secondsRemaining <= 0) {
      playShortAlarm(audioContextRef)
      const transitionTimer = window.setTimeout(() => {
        setPomodoroSession((currentSession) =>
          currentSession && currentSession.taskId === pomodoroSession.taskId
            ? {
                ...currentSession,
                phase: 'running',
                secondsRemaining: currentSession.durationSeconds,
                warningAnnounced: false,
              }
            : currentSession,
        )
      }, 0)

      return () => {
        window.clearTimeout(transitionTimer)
      }
    }

    if (pomodoroSession.phase === 'running') {
      if (pomodoroSession.secondsRemaining === 4 && !pomodoroSession.warningAnnounced) {
        speakInSpanish('termina en 3... 2... 1...')
        playShortAlarm(audioContextRef)
        const warningTimer = window.setTimeout(() => {
          setPomodoroSession((currentSession) =>
            currentSession && currentSession.taskId === pomodoroSession.taskId
              ? { ...currentSession, warningAnnounced: true }
              : currentSession,
          )
        }, 0)

        return () => {
          window.clearTimeout(warningTimer)
        }
      }

      if (pomodoroSession.secondsRemaining <= 0) {
        const completionTimer = window.setTimeout(() => {
          void completePomodoroCycle(pomodoroSession.taskId)
        }, 0)

        return () => {
          window.clearTimeout(completionTimer)
        }
      }
    }

    const timer = window.setTimeout(() => {
      setPomodoroSession((currentSession) =>
        currentSession && currentSession.taskId === pomodoroSession.taskId
          ? {
              ...currentSession,
              secondsRemaining: currentSession.secondsRemaining - 1,
            }
          : currentSession,
      )
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [completePomodoroCycle, pomodoroSession])

  const togglePomodoroTimer = async (task: TareaKanban) => {
    const pomodoroConfig = pomodoroConfigByTask[task.id] ?? getDefaultPomodoroConfig()
    if (!pomodoroConfig.enabled) {
      return
    }

    if (activePomodoroTaskId === task.id) {
      cancelPomodoroSession()
      return
    }

    setMutationError(null)

    try {
      if (task.columna === 'pendientes') {
        const nextPosition = tareas.filter((item) => item.columna === 'in_progress').length
        const { error: updateError } = await supabase
          .from('tareas_kanban')
          .update({
            columna: serializeTaskColumn('in_progress'),
            posicion: nextPosition,
          })
          .eq('id', task.id)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }

        await refreshAll()
        onDataChanged()
      }

      speakInSpanish('empieza en 3... 2... 1...')
      setPomodoroSession({
        taskId: task.id,
        phase: 'countdown',
        secondsRemaining: 4,
        durationSeconds: pomodoroConfig.durationMinutes * 60,
        warningAnnounced: false,
      })
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos iniciar el pomodoro.',
      )
    }
  }

  return (
    <div className="space-y-6">
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

      <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-6 shadow-[0_16px_48px_rgba(15,23,42,0.25)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="mt-2 text-2xl font-semibold text-white">
             Gestor de actividades, calendario y tareas
            </h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <TiempoTabButton
              active={activeTab === 'kanban'}
              icon={<KanbanSquare className="h-4 w-4" />}
              label="Gestor de tareas"
              onClick={() => {
                setActiveTab('kanban')
              }}
            />
            <TiempoTabButton
              active={activeTab === 'calendario'}
              icon={<CalendarDays className="h-4 w-4" />}
              label="Calendario Mensual"
              onClick={() => {
                setActiveTab('calendario')
              }}
            />
            <TiempoTabButton
              active={activeTab === 'agenda'}
              icon={<Clock3 className="h-4 w-4" />}
              label="Agenda Semanal"
              onClick={() => {
                setActiveTab('agenda')
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/45 p-6 text-sm text-slate-300">
            Cargando calendario, agenda y tablero...
          </div>
        ) : null}
      </section>

      {!isLoading && activeTab === 'calendario' ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-6 shadow-[0_16px_48px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-sky-200/75">
                Calendario mensual
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {formatDateLabel(currentMonth, { month: 'long', year: 'numeric' })}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                onClick={() => {
                  setCurrentMonth((currentValue) => {
                    const previousMonth = new Date(currentValue)
                    previousMonth.setMonth(previousMonth.getMonth() - 1)
                    return startOfMonth(previousMonth)
                  })
                }}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
                Mes anterior
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                onClick={() => {
                  setCurrentMonth((currentValue) => {
                    const nextMonth = new Date(currentValue)
                    nextMonth.setMonth(nextMonth.getMonth() + 1)
                    return startOfMonth(nextMonth)
                  })
                }}
                type="button"
              >
                Mes siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
                onClick={() => {
                  openEventModal()
                }}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Anadir actividad
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-3 text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((dayLabel) => (
              <div key={dayLabel}>{dayLabel}</div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-7 gap-3">
            {monthCalendarCells.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={`empty-day-${index}`}
                    className="min-h-36 rounded-3xl border border-transparent bg-transparent"
                  />
                )
              }

              const dayKey = startOfDay(day).toISOString()
              const dayActivities = calendarActivities[dayKey] ?? []
              const isToday = isSameDay(day, new Date())

              return (
                <div
                  key={dayKey}
                  className="min-h-36 rounded-3xl border border-white/10 bg-slate-900/45 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        isToday
                          ? 'rounded-full bg-sky-300 px-2 py-1 text-slate-950'
                          : 'text-white'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {dayActivities.slice(0, 4).map((actividad) => (
                      <button
                        key={actividad.id}
                        className={`w-full rounded-xl px-3 py-2 text-left shadow-sm transition hover:brightness-110 ${
                          actividad.isBirthdayHighlight
                            ? 'ring-1 ring-amber-300/60 ring-offset-0'
                            : ''
                        }`}
                        onClick={() => {
                          const selectedActivity = actividades.find(
                            (candidate) => candidate.id === actividad.id,
                          )
                          if (selectedActivity) {
                            setPreviewActivity(selectedActivity)
                          }
                        }}
                        style={{ backgroundColor: actividad.color }}
                        type="button"
                      >
                        <p className="truncate text-xs font-semibold text-white">
                          {actividad.titulo}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-white/85">
                          {actividad.timeLabel} | {actividad.subtitle}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === 'agenda' ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-6 shadow-[0_16px_48px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-sky-200" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-sky-200/75">
                  Agenda semanal
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Vista completa con horarios vacios y actividades posicionadas
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45">
                <button
                  aria-label="Semana anterior"
                  className="inline-flex h-11 w-11 items-center justify-center text-slate-100 transition hover:bg-white/10"
                  onClick={handlePreviousAgendaWeek}
                  type="button"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="border-x border-white/10 px-4 py-3 text-sm font-semibold text-slate-200">
                  {formatDateLabel(weeklyDays[0], { day: '2-digit', month: 'short' })}
                  {' - '}
                  {formatDateLabel(weeklyDays[6], { day: '2-digit', month: 'short' })}
                </div>
                <button
                  aria-label="Semana siguiente"
                  className="inline-flex h-11 w-11 items-center justify-center text-slate-100 transition hover:bg-white/10"
                  onClick={handleNextAgendaWeek}
                  type="button"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3 text-sm text-slate-300">
                Escala actual: {agendaZoomLabels[agendaZoomMinutes]}
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
                onClick={() => {
                  openEventModal(new Date())
                }}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Anadir actividad
              </button>
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-slate-100 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={agendaZoomMinutes === 120}
                onClick={handleLessDetailedAgenda}
                type="button"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-sky-300/12 text-sky-100 transition hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={agendaZoomMinutes === 30}
                onClick={handleMoreDetailedAgenda}
                type="button"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
            Usa <span className="font-semibold text-white">+</span> para ver mas detalle
            y <span className="font-semibold text-white">-</span> para agrupar la agenda
            por bloques mas amplios.
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[1240px]">
              <div className="grid grid-cols-[repeat(7,minmax(150px,1fr))_120px] gap-4">
                {weeklyAgendaColumns.map(({ day }) => (
                  <div
                    key={day.toISOString()}
                    className="rounded-3xl border border-white/10 bg-slate-900/45 px-4 py-5"
                  >
                    <p className="text-base font-semibold text-white">
                      {formatDateLabel(day, { weekday: 'long' })} {day.getDate()}
                    </p>
                  </div>
                ))}

                <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
                  <p className="text-sm font-semibold text-white">Horarios</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                    Intervalos
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[repeat(7,minmax(150px,1fr))_120px] gap-4 items-start">
                {weeklyAgendaColumns.map(({ day, timedActivities }) => {
                  const rowHeight = agendaRowHeights[agendaZoomMinutes]
                  const timelineHeight = weeklyScheduleSlots.length * rowHeight

                  return (
                    <div
                      key={`${day.toISOString()}-timeline`}
                      className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45"
                    >
                      <div
                        className="relative"
                        ref={(node) => {
                          agendaDayRefs.current[weeklyDays.findIndex((entry) => entry === day)] =
                            node
                        }}
                        style={{ height: `${timelineHeight}px` }}
                      >
                        {weeklyScheduleSlots.map((slot, slotIndex) => (
                          <div
                            key={slot.id}
                            className={`border-white/8 ${
                              slotIndex === 0 ? '' : 'border-t'
                            } ${slotIndex % 2 === 0 ? 'bg-white/[0.03]' : 'bg-transparent'}`}
                            style={{ height: `${rowHeight}px` }}
                          />
                        ))}

                        {timedActivities.map((actividad) => {
                          const layout = getWeeklyAgendaActivityLayout(
                            actividad,
                            day,
                            rowHeight,
                            agendaZoomMinutes,
                            weeklyScheduleRange.startMinutes,
                          )

                          if (!layout) {
                            return null
                          }

                          const isInteracting =
                            activeAgendaInteraction?.activityId === actividad.id

                          return (
                            <article
                              key={actividad.id}
                              className={`absolute left-2 right-2 overflow-hidden rounded-2xl border border-white/12 text-white shadow-[0_14px_28px_rgba(2,6,23,0.28)] ${
                                isInteracting ? 'z-20 ring-2 ring-sky-200/50' : 'z-10'
                              }`}
                              onDoubleClick={() => {
                                if (!agendaInteractionRef.current) {
                                  setPreviewActivity(actividad)
                                }
                              }}
                              onPointerDown={(event) => {
                                startAgendaInteraction(
                                  event,
                                  actividad,
                                  weeklyDays.findIndex((entry) => entry === day),
                                  'move',
                                )
                              }}
                              style={{
                                top: `${layout.top}px`,
                                height: `${layout.height}px`,
                                backgroundColor: resolveActivityColor(actividad),
                                touchAction: 'none',
                              }}
                            >
                              <button
                                aria-label="Ajustar inicio"
                                className="absolute inset-x-0 top-0 z-20 h-2 cursor-ns-resize bg-transparent transition hover:bg-white/12"
                                onPointerDown={(event) => {
                                  event.stopPropagation()
                                  startAgendaInteraction(
                                    event,
                                    actividad,
                                    weeklyDays.findIndex((entry) => entry === day),
                                    'resize-start',
                                  )
                                }}
                                type="button"
                              />

                              <div className="h-full cursor-grab px-3 py-1.5 active:cursor-grabbing select-none">
                                <p className="break-words text-sm font-semibold leading-5 text-white">
                                  {actividad.titulo}
                                </p>
                                <p className="mt-0.5 break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85">
                                  {getActivityTimeRange(actividad)}
                                </p>
                              </div>

                              <button
                                aria-label="Ajustar fin"
                                className="absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize bg-transparent transition hover:bg-white/12"
                                onPointerDown={(event) => {
                                  event.stopPropagation()
                                  startAgendaInteraction(
                                    event,
                                    actividad,
                                    weeklyDays.findIndex((entry) => entry === day),
                                    'resize-end',
                                  )
                                }}
                                type="button"
                              />
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/45">
                  {weeklyScheduleSlots.map((slot, slotIndex) => (
                    <div
                      key={`hours-${slot.id}`}
                      className={`flex items-center border-white/8 px-3 text-right text-sm text-slate-300 ${
                        slotIndex === 0 ? '' : 'border-t'
                      } ${slotIndex % 2 === 0 ? 'bg-white/[0.03]' : 'bg-transparent'}`}
                      style={{ height: `${agendaRowHeights[agendaZoomMinutes]}px` }}
                    >
                      <span className="ml-auto">{slot.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === 'kanban' ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-6 shadow-[0_16px_48px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-sky-200/75">
                Administra tus tareas
              </p>
              
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3 text-sm text-slate-300">
                {activeTasks.length} tarjetas sincronizadas
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                onClick={() => {
                  setShowTaskHistoryModal(true)
                }}
                type="button"
              >
                <History className="h-4 w-4" />
                Historial
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
                onClick={openTaskModalForCreate}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Añadir tarea
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {kanbanColumns.map((column) => {
              const columnTasks = activeTasks.filter((task) => task.columna === column)

              return (
                <div
                  key={column}
                  className={`rounded-3xl border p-4 transition ${
                    dragOverColumn === column
                      ? 'border-sky-300/45 bg-sky-300/10'
                      : 'border-white/10 bg-slate-900/45'
                  }`}
                  onDragLeave={() => {
                    setDragOverColumn((currentColumn) =>
                      currentColumn === column ? null : currentColumn,
                    )
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDragOverColumn(column)
                  }}
                  onDrop={(event) => {
                    void handleTaskDrop(event, column)
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {columnLabels[column]}
                      </p>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        {columnTasks.length} items
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {columnTasks.length > 0 ? (
                      columnTasks.map((task) => {
                        const { description, visibleSubtasks } =
                          splitTaskDescriptionSubtasks(subtasksByTask[task.id] ?? [])
                        const pomodoroConfig = getTaskPomodoroConfig(
                          task,
                          subtasksByTask[task.id] ?? [],
                        )
                        const linkedActivity = actividades.find(
                          (actividad) => actividad.id === task.actividad_id,
                        )
                        const isTimerRunning = activePomodoroTaskId === task.id
                        const taskHasPomodoros = pomodoroConfig.enabled
                        const isTaskPomodoroComplete =
                          taskHasPomodoros &&
                          task.pomodoros_completados >= task.pomodoros_estimados
                        const timerLabel = isTimerRunning
                          ? pomodoroSession?.phase === 'countdown'
                            ? `Empieza en ${pomodoroSession.secondsRemaining}`
                            : formatTimer(pomodoroSession?.secondsRemaining ?? 0)
                          : formatDurationMinutes(pomodoroConfig.durationMinutes)

                        return (
                          <article
                            key={task.id}
                            className={`cursor-grab rounded-3xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-sky-300/20 hover:bg-slate-950/70 active:cursor-grabbing ${
                              draggedTaskId === task.id ? 'opacity-60 ring-2 ring-sky-200/40' : ''
                            }`}
                            draggable
                            onClick={() => {
                              openTaskModalForEdit(task)
                            }}
                            onDragEnd={() => {
                              setDraggedTaskId(null)
                              setDragOverColumn(null)
                            }}
                            onDragStart={(event) => {
                              handleTaskDragStart(event, task)
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="truncate text-base font-semibold text-white">
                                  {task.titulo}
                                </h4>
                                {linkedActivity ? (
                                  <p className="mt-2 truncate text-xs uppercase tracking-[0.2em] text-slate-400">
                                    Vinculada a {linkedActivity.titulo}
                                  </p>
                                ) : null}
                              </div>

                              {taskHasPomodoros ? (
                                <button
                                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                                    isTimerRunning
                                      ? 'border-emerald-300/25 bg-emerald-300/15 text-emerald-100'
                                      : 'border-white/10 bg-white/6 text-slate-200 hover:bg-white/10'
                                  } disabled:cursor-not-allowed disabled:opacity-50`}
                                  disabled={isTaskPomodoroComplete}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void togglePomodoroTimer(task)
                                  }}
                                  type="button"
                                >
                                  {isTimerRunning ? (
                                    <Pause className="h-4 w-4" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </button>
                              ) : null}
                            </div>

                            {description ? (
                              <p className="mt-4 text-sm leading-6 text-slate-300">
                                {description}
                              </p>
                            ) : null}

                            {taskHasPomodoros ? (
                              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200">
                                <span>
                                  {task.pomodoros_completados}/{task.pomodoros_estimados}{' '}
                                  pomodoros
                                </span>
                                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                                  {timerLabel}
                                </span>
                              </div>
                            ) : null}

                            {taskHasPomodoros ? (
                              <div className="mt-3 rounded-2xl border border-sky-300/15 bg-sky-300/8 px-4 py-3 text-sm text-sky-100">
                                {pomodoroConfig.durationMinutes} minutos por pomodoro
                              </div>
                            ) : null}

                            {task.columna === 'done' ? (
                              <button
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={archivingTaskId === task.id}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleArchiveTask(task)
                                }}
                                type="button"
                              >
                                <Archive className="h-4 w-4" />
                                {archivingTaskId === task.id
                                  ? 'Enviando...'
                                  : 'Enviar al historial'}
                              </button>
                            ) : null}

                            <div className="mt-4 space-y-2">
                              {visibleSubtasks.length > 0 ? (
                                visibleSubtasks.map((subtask) => (
                                  <label
                                    key={subtask.id}
                                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-200"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                    }}
                                  >
                                    <input
                                      checked={subtask.completada}
                                      className="h-4 w-4 rounded border-white/20 bg-slate-950/60 accent-sky-300"
                                      onChange={() => {
                                        void handleToggleSubtask(subtask)
                                      }}
                                      type="checkbox"
                                    />
                                    <span
                                      className={
                                        subtask.completada ? 'line-through opacity-60' : ''
                                      }
                                    >
                                      {subtask.descripcion}
                                    </span>
                                  </label>
                                ))
                              ) : null }
                            </div>
                          </article>
                        )
                      })
                    ) : (null)}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {showTaskHistoryModal ? (
        <ModalFrame
          onClose={() => {
            setShowTaskHistoryModal(false)
          }}
          title="Historial de tareas"
          subtitle="Archiva finalizadas, recuperalas o borralas definitivamente"
        >
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
              <p className="text-sm font-semibold text-white">Finalizadas</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                Listas para historial
              </p>

              <div className="mt-4 space-y-3">
                {completedTasks.length > 0 ? (
                  completedTasks.map((task) => (
                    <div
                      key={`completed-${task.id}`}
                      className="rounded-2xl border border-white/10 bg-white/6 p-4"
                    >
                      <p className="text-sm font-semibold text-white">{task.titulo}</p>
                      <button
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={archivingTaskId === task.id}
                        onClick={() => {
                          void handleArchiveTask(task)
                        }}
                        type="button"
                      >
                        <Archive className="h-4 w-4" />
                        {archivingTaskId === task.id ? 'Enviando...' : 'Enviar al historial'}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                    No hay tareas finalizadas pendientes de archivar.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
              <p className="text-sm font-semibold text-white">Archivadas</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                Fuera del kanban
              </p>

              <div className="mt-4 space-y-3">
                {archivedTasks.length > 0 ? (
                  archivedTasks.map((task) => (
                    <div
                      key={`archived-${task.id}`}
                      className="rounded-2xl border border-white/10 bg-white/6 p-4"
                    >
                      <p className="text-sm font-semibold text-white">{task.titulo}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                          disabled={restoringTaskId === task.id}
                          onClick={() => {
                            void handleRestoreTaskFromHistory(task)
                          }}
                          type="button"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {restoringTaskId === task.id ? 'Trayendo...' : 'Traer'}
                        </button>
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                          disabled={deletingTaskId === task.id}
                          onClick={() => {
                            void handleDeleteTaskPermanently(task)
                          }}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingTaskId === task.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                    Todavia no enviaste tareas al historial.
                  </div>
                )}
              </div>
            </section>
          </div>
        </ModalFrame>
      ) : null}

      {showEventModal ? (
        <ModalFrame
          onClose={() => {
            setShowEventModal(false)
            setEditingActivityId(null)
          }}
          title={editingActivityId ? 'Editar actividad' : 'Nueva actividad'}
          subtitle={
            editingActivityId
              ? 'Modifica los datos de la actividad guardada'
              : 'Crea eventos, recordatorios o bloques de tiempo'
          }
        >
          <form className="mt-6 space-y-4" onSubmit={handleCreateEvent}>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Titulo">
                <input
                  required
                  className={inputClassName}
                  name="titulo"
                  onChange={handleEventInputChange}
                  placeholder="Titulo de la actividad"
                  value={eventForm.titulo}
                />
              </FieldLabel>

              <FieldLabel label="Tipo de actividad">
                <select
                  className={selectClassName}
                  name="category"
                  onChange={handleEventInputChange}
                  value={eventForm.category}
                >
                  {Object.entries(activityCategoryLabels).map(([value, label]) => (
                    <option key={value} className={optionClassName} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>

            <FieldLabel label="Descripcion">
              <textarea
                className={textareaClassName}
                name="descripcion"
                onChange={handleEventInputChange}
                placeholder="Descripcion de la actividad"
                value={eventForm.descripcion}
              />
            </FieldLabel>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px]">
              <label
                className={`flex min-h-[76px] items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm transition ${
                  eventForm.visibleMonthly
                    ? 'border-sky-300/35 bg-sky-300/12 text-sky-100'
                    : 'border-white/10 bg-white/6 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-3 font-medium">
                  <Eye className="h-4 w-4" />
                  Ver en calendario mensual
                </span>
                <input
                  checked={eventForm.visibleMonthly}
                  className="h-4 w-4 rounded border-white/20 bg-slate-950/60 accent-sky-300"
                  name="visibleMonthly"
                  onChange={handleEventInputChange}
                  type="checkbox"
                />
              </label>

              <FieldLabel label="Color">
                <input
                  className="h-[52px] w-full rounded-2xl border border-white/10 bg-slate-800 px-2 py-2"
                  name="color"
                  onChange={handleEventInputChange}
                  type="color"
                  value={eventForm.color}
                />
              </FieldLabel>
            </div>

            {isDateTimeRangeCategory(eventForm.category) ? (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/45 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldLabel label="Fecha de inicio">
                    <input
                      required
                      className={inputClassName}
                      name="startDate"
                      onChange={handleEventInputChange}
                      type="date"
                      value={eventForm.startDate}
                    />
                  </FieldLabel>
                  <FieldLabel label="Hora de inicio">
                    <input
                      required
                      className={inputClassName}
                      name="startTime"
                      onChange={handleEventInputChange}
                      type="time"
                      value={eventForm.startTime}
                    />
                  </FieldLabel>
                </div>

                {eventForm.category === 'juntada' ? (
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-sm text-white">
                    <input
                      checked={eventForm.hasEndDateTime}
                      className="h-4 w-4 rounded border-white/20 bg-slate-950/60 accent-sky-300"
                      name="hasEndDateTime"
                      onChange={handleEventInputChange}
                      type="checkbox"
                    />
                    <span className="font-medium">Tiene fecha y hora de finalizacion</span>
                  </label>
                ) : null}

                {eventForm.category !== 'juntada' || eventForm.hasEndDateTime ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldLabel label="Fecha de finalizacion">
                      <input
                        required={eventForm.category !== 'juntada'}
                        className={inputClassName}
                        name="endDate"
                        onChange={handleEventInputChange}
                        type="date"
                        value={eventForm.endDate}
                      />
                    </FieldLabel>
                    <FieldLabel label="Hora de finalizacion">
                      <input
                        required={eventForm.category !== 'juntada'}
                        className={inputClassName}
                        name="endTime"
                        onChange={handleEventInputChange}
                        type="time"
                        value={eventForm.endTime}
                      />
                    </FieldLabel>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isRecurringActivityCategory(eventForm.category) ? (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/45 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <FieldLabel label="Repetir desde">
                    <input
                      required
                      className={inputClassName}
                      name="repeatStartDate"
                      onChange={handleEventInputChange}
                      type="date"
                      value={eventForm.repeatStartDate}
                    />
                  </FieldLabel>
                  <FieldLabel label="Hora de inicio">
                    <input
                      required
                      className={inputClassName}
                      name="startTime"
                      onChange={handleEventInputChange}
                      type="time"
                      value={eventForm.startTime}
                    />
                  </FieldLabel>
                  <FieldLabel label="Hora de finalizacion">
                    <input
                      required
                      className={inputClassName}
                      name="endTime"
                      onChange={handleEventInputChange}
                      type="time"
                      value={eventForm.endTime}
                    />
                  </FieldLabel>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Dias de repeticion
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {weekdayOptions.map((day) => {
                      const active = eventForm.repeatDays.includes(day.value)

                      return (
                        <button
                          key={day.value}
                          className={`rounded-2xl border px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                            active
                              ? 'border-sky-300/35 bg-sky-300/12 text-sky-100'
                              : 'border-white/10 bg-white/6 text-slate-300 hover:bg-white/10'
                          }`}
                          onClick={() => {
                            handleToggleRepeatDay(day.value)
                          }}
                          type="button"
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {eventForm.category === 'cumpleanos' ? (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/45 p-4">
                <FieldLabel label="Fecha del cumpleanos">
                  <input
                    required
                    className={inputClassName}
                    name="birthdayDate"
                    onChange={handleEventInputChange}
                    type="date"
                    value={eventForm.birthdayDate}
                  />
                </FieldLabel>

                <FieldLabel label="Mensaje preparado">
                  <textarea
                    className={textareaClassName}
                    name="birthdayMessage"
                    onChange={handleEventInputChange}
                    placeholder="Mensaje opcional"
                    value={eventForm.birthdayMessage}
                  />
                </FieldLabel>

                <FieldLabel label="Numero de contacto">
                  <input
                    className={inputClassName}
                    name="birthdayContact"
                    onChange={handleEventInputChange}
                    placeholder="Contacto opcional"
                    value={eventForm.birthdayContact}
                  />
                </FieldLabel>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Posibles regalos
                    </p>
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100 transition hover:bg-sky-300/18"
                      onClick={handleAddGiftField}
                      type="button"
                    >
                      <Gift className="h-4 w-4" />
                      Regalo
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {eventForm.gifts.map((gift, index) => (
                      <div
                        key={gift.id}
                        className="grid gap-3 rounded-2xl border border-white/10 bg-white/6 p-3 md:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <FieldLabel label={`Regalo ${index + 1}`}>
                          <input
                            className={inputClassName}
                            onChange={(event) => {
                              handleGiftChange(gift.id, event.target.value)
                            }}
                            placeholder="Idea de regalo"
                            value={gift.descripcion}
                          />
                        </FieldLabel>
                        <button
                          className="inline-flex h-[52px] w-[52px] self-end items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/18"
                          onClick={() => {
                            handleRemoveGiftField(gift.id)
                          }}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={savingEvent}
              type="submit"
            >
              <CalendarDays className="h-4 w-4" />
              {savingEvent
                ? 'Guardando...'
                : editingActivityId
                  ? 'Guardar cambios'
                  : 'Guardar actividad'}
            </button>
          </form>
        </ModalFrame>
      ) : null}

      {previewActivity ? (
        <ModalFrame
          onClose={() => {
            setPreviewActivity(null)
          }}
          title="Actividad"
          subtitle="Detalle completo de solo lectura"
        >
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/75">
                    Titulo
                  </p>
                  <h4 className="mt-2 break-words text-2xl font-semibold text-white">
                    {previewActivity.titulo}
                  </h4>
                </div>

                <div
                  className="h-12 w-12 shrink-0 rounded-2xl border border-white/10"
                  style={{ backgroundColor: resolveActivityColor(previewActivity) }}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField
                label="Tipo"
                value={activityCategoryLabels[getActivityCategory(previewActivity)]}
              />
              <ReadOnlyField
                label="Calendario mensual"
                value={
                  previewActivity.visible_calendario_mensual
                    ? 'Visible'
                    : 'Oculto'
                }
              />
              <ReadOnlyField
                label="Fecha de inicio"
                value={formatDateLabel(parseStoredActivityStart(previewActivity), {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  weekday: 'long',
                })}
              />
              <ReadOnlyField
                label="Fecha de fin"
                value={formatDateLabel(parseStoredActivityEnd(previewActivity), {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  weekday: 'long',
                })}
              />
              <ReadOnlyField
                label="Horario"
                value={
                  isAllDayActivity(previewActivity)
                    ? 'Todo el dia'
                    : getActivityTimeRange(previewActivity)
                }
              />
              <ReadOnlyField
                label="Color"
                value={resolveActivityColor(previewActivity)}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/75">
                Descripcion
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">
                {getActivityDisplayDescription(previewActivity) || 'Sin descripcion.'}
              </p>
            </div>

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/18"
              onClick={() => {
                openEventModalForEdit(previewActivity)
              }}
              type="button"
            >
              Editar actividad
            </button>

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
              onClick={() => {
                setPreviewActivity(null)
              }}
              type="button"
            >
              Cerrar
            </button>

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/18 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={deletingActivityId === previewActivity.id}
              onClick={() => {
                void handleHidePreviewActivity('single')
              }}
              type="button"
            >
              {deletingActivityId === previewActivity.id
                ? 'Ocultando actividad...'
                : previewActivity.serie_id
                  ? 'Ocultar esta ocurrencia'
                  : 'Ocultar del calendario'}
            </button>

            {previewActivity.serie_id ? (
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/18 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={deletingActivityId === previewActivity.id}
                onClick={() => {
                  void handleHidePreviewActivity('series')
                }}
                type="button"
              >
                Ocultar serie completa
              </button>
            ) : null}
          </div>
        </ModalFrame>
      ) : null}

      {showTaskModal ? (
        <ModalFrame
          onClose={() => {
            setShowTaskModal(false)
          }}
          title={""}
          subtitle={taskModalState.taskId ? 'Editar Tarea' : 'Nueva Tarea'}
        >
          <form className="mt-6 space-y-4" onSubmit={handleSaveTask}>
            <FieldLabel label="Título">
              <input
                required
                className={inputClassName}
                name="titulo"
                onChange={handleTaskFormChange}
                placeholder="Titulo"
                value={taskModalState.titulo}
              />
            </FieldLabel>

            <FieldLabel label="Descripción">
              <textarea
                className={textareaClassName}
                name="descripcion"
                onChange={handleTaskFormChange}
                placeholder="Descripcion"
                value={taskModalState.descripcion}
              />
            </FieldLabel>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel label="Actividad vinculada">
                <select
                  className={selectClassName}
                  name="actividadId"
                  onChange={handleTaskFormChange}
                  value={taskModalState.actividadId}
                >
                  <option className={optionClassName} value="">
                    Vincular a una actividad (opcional)
                  </option>
                  {actividades.map((actividad) => (
                    <option
                      key={actividad.id}
                      className={optionClassName}
                      value={actividad.id}
                    >
                      {actividad.titulo} -{' '}
                    {formatDateLabel(parseStoredActivityStart(actividad), {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>

            <label className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-900/45 px-4 py-4 text-sm text-white">
              <input
                checked={taskModalState.usePomodoros}
                className="h-4 w-4 rounded border-white/20 bg-slate-950/60 accent-sky-300"
                name="usePomodoros"
                onChange={handleTaskFormChange}
                type="checkbox"
              />
              <span className="font-medium">Usar pomodoros en esta tarea?</span>
            </label>

            {taskModalState.usePomodoros ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="Cantidad de pomodoros">
                  <input
                    required
                    className={inputClassName}
                    min="1"
                    name="pomodorosEstimados"
                    onChange={handleTaskFormChange}
                    placeholder="Cantidad de pomodoros"
                    step="1"
                    type="number"
                    value={taskModalState.pomodorosEstimados}
                  />
                </FieldLabel>

                <FieldLabel label="Minutos por pomodoro">
                  <input
                    required
                    className={inputClassName}
                    min="1"
                    name="pomodoroDurationMinutes"
                    onChange={handleTaskFormChange}
                    placeholder="Minutos por pomodoro"
                    step="1"
                    type="number"
                    value={taskModalState.pomodoroDurationMinutes}
                  />
                </FieldLabel>
              </div>
            ) : null}

            <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
              <div className="flex items-center justify-between gap-3">

                <button
                  className="rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-300/18"
                  onClick={handleAddSubtaskField}
                  type="button"
                >
                  + subtarea
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {taskModalState.subtareas.map((subtask, index) => (
                  <div
                    key={`${subtask.id ?? 'new'}-${index}`}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-white/6 p-3 md:grid-cols-[auto_minmax(0,1fr)_auto]"
                  >
                    <label className="space-y-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-center">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Lista
                      </span>
                      <input
                        checked={subtask.completada}
                        className="h-4 w-4 rounded border-white/20 bg-slate-950/60 accent-sky-300"
                        onChange={(event) => {
                          handleSubtaskChange(index, 'completada', event.target.checked)
                        }}
                        type="checkbox"
                      />
                    </label>
                    <FieldLabel label={`subtarea ${index + 1}`}>
                      <input
                        className={inputClassName}
                        onChange={(event) => {
                          handleSubtaskChange(index, 'descripcion', event.target.value)
                        }}
                        placeholder="Descripcion de subtarea"
                        value={subtask.descripcion}
                      />
                    </FieldLabel>
                    <button
                      className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/18"
                      onClick={() => {
                        handleRemoveSubtaskField(index)
                      }}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={savingTask}
                type="submit"
              >
                <KanbanSquare className="h-4 w-4" />
                {savingTask ? 'Guardando...' : taskModalState.taskId ? 'Guardar cambios' : 'Crear tarea'}
              </button>

              {taskModalState.taskId ? (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={deletingTaskId === taskModalState.taskId}
                  onClick={() => {
                    void handleDeleteTask()
                  }}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingTaskId === taskModalState.taskId ? 'Eliminando...' : 'Eliminar tarea'}
                </button>
              ) : null}
            </div>
          </form>
        </ModalFrame>
      ) : null}
    </div>
  )
}

type TiempoTabButtonProps = {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}

function TiempoTabButton({
  active,
  icon,
  label,
  onClick,
}: TiempoTabButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
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

type FieldLabelProps = {
  children: ReactNode
  className?: string
  label: string
}

function FieldLabel({ children, className = '', label }: FieldLabelProps) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  )
}

type ReadOnlyFieldProps = {
  label: string
  value: string
}

function ReadOnlyField({ label, value }: ReadOnlyFieldProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/75">
        {label}
      </p>
      <p className="mt-3 break-words text-sm leading-7 text-white">{value}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-4rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-[0_24px_100px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-sky-200/75">
              {title}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{subtitle}</h3>
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

function createDefaultEventForm(
  day: Date,
  forcedCategory: ActividadCategoria = 'evento_unico',
): EventFormState {
  const startDate = toDateInputValue(day)
  const defaultRepeatDay = day.getDay() as WeekdayIndex

  return {
    titulo: '',
    descripcion: '',
    category: forcedCategory,
    startDate,
    endDate: startDate,
    startTime: forcedCategory === 'cumpleanos' ? '00:00' : '10:00',
    endTime: forcedCategory === 'cumpleanos' ? '23:59' : '11:00',
    repeatStartDate: startDate,
    repeatDays: [defaultRepeatDay],
    birthdayDate: startDate,
    birthdayMessage: '',
    birthdayContact: '',
    gifts: [createEmptyGiftIdea()],
    hasEndDateTime: forcedCategory !== 'juntada',
    visibleMonthly: false,
    color: getDefaultActivityCategoryColor(forcedCategory),
  }
}

function createEventFormFromActivity(actividad: Actividad): EventFormState {
  const startAt = parseStoredActivityStart(actividad)
  const endAt = parseStoredActivityEnd(actividad)
  const category = getActivityCategory(actividad)
  const extra = actividad.datos_extra

  return {
    titulo: actividad.titulo,
    descripcion: getActivityDisplayDescription(actividad),
    category,
    startDate: toDateInputValue(startAt),
    endDate: toDateInputValue(endAt),
    startTime: category === 'cumpleanos' ? '00:00' : toTimeInputValue(startAt),
    endTime: category === 'cumpleanos' ? '23:59' : toTimeInputValue(endAt),
    repeatStartDate:
      readExtraString(extra.repetir_desde) ??
      readExtraString(extra.repeatStartDate) ??
      toDateInputValue(startAt),
    repeatDays: readExtraWeekdays(extra.dias_semana).length > 0
      ? readExtraWeekdays(extra.dias_semana)
      : [startAt.getDay() as WeekdayIndex],
    birthdayDate:
      readExtraString(extra.fecha_cumpleanos) ??
      readExtraString(extra.birthdayDate) ??
      toDateInputValue(startAt),
    birthdayMessage:
      readExtraString(extra.mensaje_cumpleanos) ??
      readExtraString(extra.birthdayMessage) ??
      '',
    birthdayContact:
      readExtraString(extra.contacto_cumpleanos) ??
      readExtraString(extra.birthdayContact) ??
      '',
    gifts: createGiftIdeasFromExtra(extra.regalos),
    hasEndDateTime: Boolean(actividad.fecha_fin),
    visibleMonthly: actividad.visible_calendario_mensual,
    color: resolveActivityColor(actividad),
  }
}

function createDefaultTaskModalState(): TaskModalState {
  return {
    taskId: null,
    titulo: '',
    descripcion: '',
    actividadId: '',
    usePomodoros: false,
    pomodorosEstimados: '1',
    pomodoroDurationMinutes: '25',
    subtareas: [{ id: null, descripcion: '', completada: false }],
  }
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

function buildActivityPayloadsFromForm(
  form: EventFormState,
  userId: string,
): ActivityPayload[] {
  const basePayload = buildBaseActivityPayload(form, userId)
  const category = form.category

  if (category === 'cumpleanos') {
    const birthdayDate = form.birthdayDate || form.startDate
    const startAt = createLocalDateTime(birthdayDate, '00:00')
    const endAt = createLocalDateTime(birthdayDate, '23:59')

    return [
      {
        ...basePayload,
        fecha_inicio: startAt.toISOString(),
        fecha_fin: endAt.toISOString(),
        serie_id: null,
        ocurrencia_fecha: birthdayDate,
      },
    ]
  }

  if (isRecurringActivityCategory(category)) {
    if (form.repeatDays.length === 0) {
      throw new Error('Selecciona al menos un dia de repeticion.')
    }

    const repeatStart = parseDateInputValue(form.repeatStartDate || form.startDate)
    const repeatEnd = new Date(repeatStart.getFullYear(), 11, 31)
    const seriesId = createUuid()
    const rows: ActivityPayload[] = []

    for (
      let currentDay = startOfDay(repeatStart);
      currentDay <= repeatEnd;
      currentDay = addDays(currentDay, 1)
    ) {
      if (!form.repeatDays.includes(currentDay.getDay() as WeekdayIndex)) {
        continue
      }

      const dayValue = toDateInputValue(currentDay)
      const startAt = createLocalDateTime(dayValue, form.startTime || '09:00')
      const endAt = createLocalDateTime(dayValue, form.endTime || '10:00')

      if (endAt <= startAt) {
        throw new Error('La hora de finalizacion debe ser posterior al inicio.')
      }

      rows.push({
        ...basePayload,
        fecha_inicio: startAt.toISOString(),
        fecha_fin: endAt.toISOString(),
        serie_id: seriesId,
        ocurrencia_fecha: dayValue,
      })
    }

    if (rows.length === 0) {
      throw new Error('No hay ocurrencias para los dias seleccionados.')
    }

    return rows
  }

  return [buildSingleDateTimePayload(form, basePayload)]
}

function buildSingleActivityPayloadFromForm(
  form: EventFormState,
  userId: string,
  currentActivity: Actividad,
): ActivityPayload {
  const basePayload = buildBaseActivityPayload(form, userId)

  if (form.category === 'cumpleanos') {
    const birthdayDate = form.birthdayDate || form.startDate
    const startAt = createLocalDateTime(birthdayDate, '00:00')
    const endAt = createLocalDateTime(birthdayDate, '23:59')

    return {
      ...basePayload,
      fecha_inicio: startAt.toISOString(),
      fecha_fin: endAt.toISOString(),
      serie_id: null,
      ocurrencia_fecha: birthdayDate,
    }
  }

  if (isRecurringActivityCategory(form.category)) {
    const dayValue = form.startDate
    const startAt = createLocalDateTime(dayValue, form.startTime || '09:00')
    const endAt = createLocalDateTime(dayValue, form.endTime || '10:00')

    if (endAt <= startAt) {
      throw new Error('La hora de finalizacion debe ser posterior al inicio.')
    }

    return {
      ...basePayload,
      fecha_inicio: startAt.toISOString(),
      fecha_fin: endAt.toISOString(),
      serie_id: currentActivity.serie_id,
      ocurrencia_fecha: currentActivity.ocurrencia_fecha ?? dayValue,
    }
  }

  return buildSingleDateTimePayload(form, basePayload)
}

function buildBaseActivityPayload(
  form: EventFormState,
  userId: string,
): Omit<ActivityPayload, 'fecha_fin' | 'fecha_inicio' | 'ocurrencia_fecha' | 'serie_id'> {
  const titulo = form.titulo.trim()
  if (!titulo) {
    throw new Error('Ingresa un titulo para la actividad.')
  }

  const category = form.category
  const color = form.color || getDefaultActivityCategoryColor(category)

  return {
    user_id: userId,
    titulo,
    descripcion: buildActivityDescription(category, form.descripcion.trim()),
    tipo: getActivityTypeForCategory(category),
    categoria: category,
    color,
    visible_calendario_mensual: form.visibleMonthly,
    datos_extra: buildActivityExtra(form),
    oculta_calendarios: false,
  }
}

function buildSingleDateTimePayload(
  form: EventFormState,
  basePayload: Omit<
    ActivityPayload,
    'fecha_fin' | 'fecha_inicio' | 'ocurrencia_fecha' | 'serie_id'
  >,
): ActivityPayload {
  const startAt = createLocalDateTime(form.startDate, form.startTime || '09:00')
  const shouldUseEnd =
    form.category !== 'juntada' ||
    (form.category === 'juntada' && form.hasEndDateTime)
  const endAt = shouldUseEnd
    ? createLocalDateTime(form.endDate || form.startDate, form.endTime || form.startTime)
    : null

  if (endAt && endAt <= startAt) {
    throw new Error('La fecha y hora de finalizacion debe ser posterior al inicio.')
  }

  return {
    ...basePayload,
    fecha_inicio: startAt.toISOString(),
    fecha_fin: endAt ? endAt.toISOString() : null,
    serie_id: null,
    ocurrencia_fecha: form.startDate,
  }
}

function buildActivityExtra(form: EventFormState): Record<string, unknown> {
  const regalos = form.gifts
    .map((gift) => gift.descripcion.trim())
    .filter((gift) => gift.length > 0)

  return {
    categoria: form.category,
    dias_semana: form.repeatDays,
    repetir_desde: form.repeatStartDate,
    repetir_hasta: `${parseDateInputValue(form.repeatStartDate).getFullYear()}-12-31`,
    fecha_cumpleanos: form.birthdayDate,
    mensaje_cumpleanos: form.birthdayMessage.trim(),
    contacto_cumpleanos: form.birthdayContact.trim(),
    regalos,
    juntada_tiene_fin: form.hasEndDateTime,
  }
}

function createLocalDateTime(dateValue: string, timeValue: string) {
  const date = new Date(`${dateValue}T${timeValue || '00:00'}`)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Revisa las fechas y horarios de la actividad.')
  }

  return date
}

function parseDateInputValue(value: string) {
  const [yearValue, monthValue, dayValue] = value.split('-')
  const year = Number.parseInt(yearValue ?? '', 10)
  const month = Number.parseInt(monthValue ?? '', 10)
  const day = Number.parseInt(dayValue ?? '', 10)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error('Revisa la fecha seleccionada.')
  }

  return new Date(year, month - 1, day)
}

function createEmptyGiftIdea(): GiftIdea {
  return {
    id: createLocalId('gift'),
    descripcion: '',
  }
}

function createGiftIdeasFromExtra(value: unknown): GiftIdea[] {
  if (!Array.isArray(value)) {
    return [createEmptyGiftIdea()]
  }

  const gifts = value
    .map((gift) => (typeof gift === 'string' ? gift : null))
    .filter((gift): gift is string => Boolean(gift && gift.trim()))
    .map((gift) => ({
      id: createLocalId('gift'),
      descripcion: gift,
    }))

  return gifts.length > 0 ? gifts : [createEmptyGiftIdea()]
}

function readExtraString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readExtraWeekdays(value: unknown): WeekdayIndex[] {
  if (!Array.isArray(value)) {
    return []
  }

  return sortWeekdays(
    value.filter((day): day is WeekdayIndex =>
      day === 0 ||
      day === 1 ||
      day === 2 ||
      day === 3 ||
      day === 4 ||
      day === 5 ||
      day === 6,
    ),
  )
}

function sortWeekdays(days: WeekdayIndex[]) {
  const order = new Map(weekdayOptions.map((day, index) => [day.value, index]))
  return [...new Set(days)].sort(
    (first, second) => (order.get(first) ?? 0) - (order.get(second) ?? 0),
  )
}

function createLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function createUuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function getDefaultActivityCategoryColor(category: ActividadCategoria) {
  if (category === 'actividad_fisica') {
    return '#22c55e'
  }

  if (category === 'cumpleanos') {
    return '#fb7185'
  }

  if (category === 'juntada') {
    return '#06b6d4'
  }

  if (category === 'actividad_rutinaria') {
    return '#14b8a6'
  }

  if (category === 'tiempo_dedicado') {
    return '#8b5cf6'
  }

  return '#38bdf8'
}

function resolveActivityColor(actividad: Actividad) {
  if (actividad.color.startsWith('#')) {
    return actividad.color
  }

  if (actividad.color === 'violet') {
    return '#8b5cf6'
  }

  if (actividad.color === 'amber') {
    return '#f59e0b'
  }

  if (actividad.color === 'rose' || actividad.color === 'red') {
    return '#fb7185'
  }

  if (actividad.color === 'sky') {
    return '#38bdf8'
  }

  return getDefaultActivityCategoryColor(getActivityCategory(actividad))
}

function buildActivityDescription(category: ActividadCategoria, description: string) {
  const subtype = getLegacySubtypeForCategory(category)
  const metadata = `[[subtipo:${subtype}]]`
  return description ? `${metadata}\n${description}` : metadata
}

function getActivityCategory(actividad: Actividad): ActividadCategoria {
  return actividad.categoria
}

function getActivityDisplayDescription(actividad: Actividad) {
  return (actividad.descripcion ?? '').replace(/^\[\[subtipo:.+?\]\]\n?/, '').trim()
}

function isActivityCategory(value: unknown): value is ActividadCategoria {
  return (
    value === 'evento_unico' ||
    value === 'actividad_fisica' ||
    value === 'cumpleanos' ||
    value === 'juntada' ||
    value === 'actividad_rutinaria' ||
    value === 'tiempo_dedicado'
  )
}

function isDateTimeRangeCategory(category: ActividadCategoria) {
  return (
    category === 'evento_unico' ||
    category === 'juntada' ||
    category === 'tiempo_dedicado'
  )
}

function isRecurringActivityCategory(category: ActividadCategoria) {
  return category === 'actividad_fisica' || category === 'actividad_rutinaria'
}

function getActivityTypeForCategory(category: ActividadCategoria): Actividad['tipo'] {
  if (category === 'cumpleanos') {
    return 'recordatorio'
  }

  if (category === 'actividad_rutinaria' || category === 'tiempo_dedicado') {
    return 'bloque_tiempo'
  }

  return 'evento'
}

function getLegacySubtypeForCategory(category: ActividadCategoria): ActivitySubtype {
  if (category === 'actividad_fisica') {
    return 'actividad_fisica'
  }

  if (category === 'cumpleanos') {
    return 'cumpleanos'
  }

  return 'general'
}

function getActivityTimeRange(actividad: Actividad) {
  const start = parseStoredActivityStart(actividad)
  const end = actividad.fecha_fin ? parseStoredActivityEnd(actividad) : null
  if (!end) {
    return formatTimeLabel(start)
  }

  return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`
}

function hasActivityOverlap({
  activities,
  excludeActivityId,
  nextStartAt,
  nextEndAt,
}: {
  activities: Actividad[]
  excludeActivityId?: string
  nextEndAt: Date
  nextStartAt: Date
}) {
  const candidateDuration = nextEndAt.getTime() - nextStartAt.getTime()
  if (candidateDuration <= 0) {
    return true
  }

  return activities.some((actividad) => {
    if (actividad.id === excludeActivityId) {
      return false
    }

    if (isAllDayActivity(actividad)) {
      return false
    }

    const currentStartAt = parseStoredActivityStart(actividad)
    const currentEndAt = actividad.fecha_fin
      ? parseStoredActivityEnd(actividad)
      : new Date(currentStartAt)

    return (
      nextStartAt.getTime() < currentEndAt.getTime() &&
      nextEndAt.getTime() > currentStartAt.getTime()
    )
  })
}

function createAgendaTimeSlots(
  slotMinutes: AgendaZoomMinutes,
  rangeStartMinutes = 0,
  rangeEndMinutes = 24 * 60,
): AgendaTimeSlot[] {
  const slots: AgendaTimeSlot[] = []

  for (
    let startMinutes = rangeStartMinutes;
    startMinutes < rangeEndMinutes;
    startMinutes += slotMinutes
  ) {
    const endMinutes = Math.min(startMinutes + slotMinutes, rangeEndMinutes)
    slots.push({
      id: `${slotMinutes}-${startMinutes}`,
      startMinutes,
      endMinutes,
      label: `${formatClockMinutes(startMinutes)} - ${formatClockMinutes(endMinutes)}`,
    })
  }

  return slots
}

function createAgendaVisibleRange(
  columns: AgendaDayColumn[],
  slotMinutes: AgendaZoomMinutes,
) {
  let startMinutes = defaultAgendaStartMinutes
  let endMinutes = defaultAgendaEndMinutes

  columns.forEach(({ day, timedActivities }) => {
    timedActivities.forEach((actividad) => {
      const start = parseStoredActivityStart(actividad)
      const end = actividad.fecha_fin ? parseStoredActivityEnd(actividad) : new Date(start)
      const dayStart = startOfDay(day)
      const dayEnd = endOfDay(day)

      const startsInDay = start > dayStart ? start : dayStart
      const endsInDay = end < dayEnd ? end : dayEnd
      const activityStartMinutes = clampMinutesToDay(
        getMinutesSinceStartOfDay(startsInDay),
      )
      const activityEndMinutes = clampMinutesToDay(
        getMinutesSinceStartOfDay(endsInDay),
      )
      const safeEndMinutes = Math.max(
        activityEndMinutes,
        Math.min(activityStartMinutes + 5, 24 * 60),
      )

      if (activityStartMinutes < startMinutes) {
        startMinutes = Math.floor(activityStartMinutes / slotMinutes) * slotMinutes
      }

      if (safeEndMinutes > endMinutes) {
        endMinutes = Math.ceil(safeEndMinutes / slotMinutes) * slotMinutes
      }
    })
  })

  return {
    startMinutes: clampMinutesToDay(startMinutes),
    endMinutes: clampMinutesToDay(Math.max(endMinutes, startMinutes + slotMinutes)),
  }
}

function getWeeklyAgendaActivityLayout(
  actividad: Actividad,
  day: Date,
  rowHeight: number,
  slotMinutes: AgendaZoomMinutes,
  rangeStartMinutes = 0,
) {
  const start = parseStoredActivityStart(actividad)
  const end = actividad.fecha_fin ? parseStoredActivityEnd(actividad) : new Date(start)

  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)

  const startsInDay = start > dayStart ? start : dayStart
  const endsInDay = end < dayEnd ? end : dayEnd

  const startMinutes = clampMinutesToDay(getMinutesSinceStartOfDay(startsInDay))
  const endMinutes = clampMinutesToDay(getMinutesSinceStartOfDay(endsInDay))
  const safeEndMinutes = Math.max(endMinutes, Math.min(startMinutes + 5, 24 * 60))

  const pixelsPerMinute = getAgendaPixelsPerMinute(rowHeight, slotMinutes)
  const top = (startMinutes - rangeStartMinutes) * pixelsPerMinute
  const height = Math.max((safeEndMinutes - startMinutes) * pixelsPerMinute, 18)

  return {
    top,
    height,
  }
}

function getAgendaPixelsPerMinute(
  rowHeight: number,
  slotMinutes: AgendaZoomMinutes,
) {
  return rowHeight / slotMinutes
}

function getMinutesSinceStartOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function getMinutesBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
}

function clampMinutesToDay(value: number) {
  return Math.min(Math.max(value, 0), 24 * 60)
}

function snapMinutesToStep(value: number, stepMinutes: number) {
  return Math.round(value / stepMinutes) * stepMinutes
}

function createDateFromDayAndMinutes(day: Date, totalMinutes: number) {
  const nextDate = startOfDay(day)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  nextDate.setHours(hours, minutes, 0, 0)
  return nextDate
}

function resolveAgendaDayIndexFromPointer(
  clientX: number,
  dayRefs: Array<HTMLDivElement | null>,
  fallbackIndex: number,
) {
  let closestIndex = fallbackIndex
  let closestDistance = Number.POSITIVE_INFINITY

  dayRefs.forEach((element, index) => {
    if (!element) {
      return
    }

    const rect = element.getBoundingClientRect()
    const isInside = clientX >= rect.left && clientX <= rect.right

    if (isInside) {
      closestIndex = index
      closestDistance = 0
      return
    }

    const centerX = rect.left + rect.width / 2
    const distance = Math.abs(clientX - centerX)

    if (distance < closestDistance) {
      closestIndex = index
      closestDistance = distance
    }
  })

  return closestIndex
}

function formatClockMinutes(totalMinutes: number) {
  if (totalMinutes >= 24 * 60) {
    return '24:00'
  }

  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const minutes = String(totalMinutes % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

function isAllDayActivity(actividad: Actividad) {
  if (getActivityCategory(actividad) === 'cumpleanos') {
    return true
  }

  const start = parseStoredActivityStart(actividad)
  const end = actividad.fecha_fin ? parseStoredActivityEnd(actividad) : null
  if (!end) {
    return false
  }

  return (
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 23 &&
    end.getMinutes() >= 59
  )
}

function isBirthdayHighlightWindow(actividad: Actividad) {
  if (getActivityCategory(actividad) !== 'cumpleanos') {
    return false
  }

  const birthdayDate = startOfDay(parseStoredActivityStart(actividad))
  const reminderStart = addDays(birthdayDate, -1)
  const today = startOfDay(new Date())

  // Cumpleanos se considera recordatorio especial: dashboard y resumen pueden
  // resaltarlo tanto el dia anterior como el mismo dia.
  return isSameDay(today, reminderStart) || isSameDay(today, birthdayDate)
}

function parseStoredActivityStart(actividad: Actividad) {
  return parseStoredDateTime(actividad.fecha_inicio)
}

function parseStoredActivityEnd(actividad: Actividad) {
  return parseStoredDateTime(actividad.fecha_fin ?? actividad.fecha_inicio)
}

function splitTaskDescriptionSubtasks(subtasks: Subtarea[]) {
  const descriptionSubtask =
    subtasks.find((subtask) => subtask.descripcion.startsWith(hiddenTaskNotePrefix)) ??
    null
  const pomodoroConfigSubtask =
    subtasks.find((subtask) => subtask.descripcion.startsWith(hiddenTaskPomodoroPrefix)) ??
    null
  const visibleSubtasks = subtasks.filter(
    (subtask) =>
      !subtask.descripcion.startsWith(hiddenTaskNotePrefix) &&
      !subtask.descripcion.startsWith(hiddenTaskPomodoroPrefix),
  )

  return {
    descriptionSubtask,
    pomodoroConfigSubtask,
    pomodoroConfig: parsePomodoroConfig(
      pomodoroConfigSubtask?.descripcion ?? null,
    ),
    description: descriptionSubtask
      ? descriptionSubtask.descripcion.replace(hiddenTaskNotePrefix, '').trim()
      : '',
    visibleSubtasks,
  }
}

function buildTaskDescriptionValue(description: string) {
  return `${hiddenTaskNotePrefix} ${description.trim()}`
}

function buildPomodoroConfigValue(durationMinutes: number) {
  return `${hiddenTaskPomodoroPrefix}${durationMinutes}]]`
}

function parsePomodoroConfig(value: string | null): TaskPomodoroConfig {
  if (!value) {
    return getDefaultPomodoroConfig()
  }

  const match = value.match(/^\[\[pomodoro:(\d+)\]\]/)
  const parsedDuration = match ? Number.parseInt(match[1] ?? '25', 10) : Number.NaN

  return {
    enabled: Boolean(match),
    durationMinutes:
      Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 25,
  }
}

function getDefaultPomodoroConfig(): TaskPomodoroConfig {
  return {
    enabled: false,
    durationMinutes: 25,
  }
}

function getTaskPomodoroConfig(task: TareaKanban, subtasks: Subtarea[]) {
  const parsedConfigSubtask = subtasks.find((subtask) =>
    subtask.descripcion.startsWith(hiddenTaskPomodoroPrefix),
  )
  const parsedConfig = parsePomodoroConfig(parsedConfigSubtask?.descripcion ?? null)

  if (parsedConfig.enabled) {
    return parsedConfig
  }

  if (task.pomodoros_estimados > 0) {
    return {
      enabled: true,
      durationMinutes: 25,
    }
  }

  return parsedConfig
}

function serializeTaskColumn(column: TareaKanban['columna']) {
  if (column === 'pendientes') {
    return 'todo'
  }

  return column
}

function formatTimer(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function formatDurationMinutes(totalMinutes: number) {
  return formatTimer(totalMinutes * 60)
}

function speakInSpanish(message: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(message)
  utterance.lang = 'es-AR'
  utterance.rate = 0.95
  window.speechSynthesis.speak(utterance)
}

function playShortAlarm(audioContextRef: React.RefObject<AudioContext | null>) {
  if (typeof window === 'undefined') {
    return
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  if (!AudioContextConstructor) {
    return
  }

  const context = audioContextRef.current ?? new AudioContextConstructor()
  audioContextRef.current = context

  if (context.state === 'suspended') {
    void context.resume()
  }

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'triangle'
  oscillator.frequency.value = 880
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.24)
}

export default ModuloTiempo
