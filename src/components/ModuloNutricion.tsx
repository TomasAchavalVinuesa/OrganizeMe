import {
  Apple,
  Beef,
  CalendarCheck,
  ChartNoAxesColumn,
  CheckCircle2,
  Clock3,
  Droplets,
  Flame,
  GlassWater,
  Plus,
  Salad,
  Save,
  Scale,
  Search,
  Target,
  Trash2,
  Utensils,
  Wheat,
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
  normalizeNutricionAlimento,
  normalizeNutricionComida,
  normalizeNutricionComidaAlimento,
  normalizeNutricionHidratacion,
  normalizeNutricionPerfil,
  normalizeNutricionPeso,
  type Actividad,
  type NutricionAlimento,
  type NutricionComida,
  type NutricionComidaAlimento,
  type NutricionGenero,
  type NutricionHidratacion,
  type NutricionObjetivo,
  type NutricionPerfil,
  type NutricionPeso,
  type NutricionTipoComida,
} from '../lib/dashboardModels'
import {
  addDays,
  formatDateLabel,
  formatTimeLabel,
  parseStoredDateTime,
  startOfDay,
  startOfWeek,
} from '../lib/dateUtils'
import { supabase } from '../lib/supabaseClient'

type ModuloNutricionProps = {
  onDataChanged: () => void
  userId: string
}

type NutricionTab = 'registro' | 'historial' | 'progreso' | 'alimentos'

type ProfileFormState = {
  alturaCm: string
  edad: string
  genero: NutricionGenero
  objetivoComposicion: NutricionObjetivo
  pesoKg: string
}

type FoodFormState = {
  calorias: string
  carbohidratosG: string
  fibraG: string
  grasasG: string
  gramosPorPorcion: string
  nombre: string
  proteinasG: string
  sodioMg: string
}

type MealFormState = {
  date: string
  nombrePlato: string
  time: string
  tipoComida: NutricionTipoComida
}

type HydrationManualFormState = {
  ajusteMl: string
  objetivoMl: string
}

type WeightFormState = {
  fecha: string
  pesoKg: string
}

type MealTotals = {
  calorias: number
  carbohidratosG: number
  fibraG: number
  grasasG: number
  proteinasG: number
  sodioMg: number
}

type MealWithTotals = {
  foods: Array<{
    alimento: NutricionAlimento | null
    item: NutricionComidaAlimento
  }>
  meal: NutricionComida
  totals: MealTotals
}

type NutritionTargets = {
  activityFactor: number
  activityLabel: string
  bmr: number
  calories: number
  carbsG: number
  fatG: number
  proteinG: number
}

type DailyNutritionPoint = {
  calories: number
  date: string
  hydrationMl: number
  label: string
  proteinG: number
}

type CalendarContributionDay = {
  date: string
  label: string
  score: number
}

type HistorySortField = 'calorias' | 'proteinas' | 'carbohidratos' | 'grasas'
type SortDirection = 'desc' | 'asc'

const selectClassName =
  'min-h-12 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-base text-white outline-none transition focus:border-lime-300/65 focus:ring-4 focus:ring-lime-300/15 sm:text-sm'

const optionClassName = 'bg-slate-900 text-white'

const inputClassName =
  'min-h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-lime-300/65 focus:ring-4 focus:ring-lime-300/15 sm:text-sm'

const smallInputClassName =
  'min-h-10 w-full rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-lime-300/65 focus:ring-4 focus:ring-lime-300/15'

const mealTypeLabels: Record<NutricionTipoComida, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
  snack: 'Snack',
}

const goalLabels: Record<NutricionObjetivo, string> = {
  perdida_grasa: 'Perdida de grasa',
  ganancia_muscular: 'Ganancia muscular',
  mantenimiento: 'Mantenimiento',
}

const genderLabels: Record<NutricionGenero, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  otro: 'Otro',
}

const emptyTotals: MealTotals = {
  calorias: 0,
  proteinasG: 0,
  carbohidratosG: 0,
  grasasG: 0,
  fibraG: 0,
  sodioMg: 0,
}

const mealTypes: NutricionTipoComida[] = [
  'desayuno',
  'almuerzo',
  'merienda',
  'cena',
  'snack',
]

const initialFoodForm: FoodFormState = {
  nombre: '',
  gramosPorPorcion: '100',
  calorias: '',
  proteinasG: '',
  carbohidratosG: '',
  grasasG: '',
  fibraG: '',
  sodioMg: '',
}

function ModuloNutricion({ onDataChanged, userId }: ModuloNutricionProps) {
  const [activeTab, setActiveTab] = useState<NutricionTab>('registro')
  const [profile, setProfile] = useState<NutricionPerfil | null>(null)
  const [alimentos, setAlimentos] = useState<NutricionAlimento[]>([])
  const [comidas, setComidas] = useState<NutricionComida[]>([])
  const [comidaItems, setComidaItems] = useState<NutricionComidaAlimento[]>([])
  const [hidratacion, setHidratacion] = useState<NutricionHidratacion[]>([])
  const [pesos, setPesos] = useState<NutricionPeso[]>([])
  const [physicalActivities, setPhysicalActivities] = useState<Actividad[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() =>
    createDefaultProfileForm(),
  )
  const [foodForm, setFoodForm] = useState<FoodFormState>(initialFoodForm)
  const [mealForm, setMealForm] = useState<MealFormState>(() => createDefaultMealForm())
  const [hydrationManualForm, setHydrationManualForm] =
    useState<HydrationManualFormState>({
      ajusteMl: '0',
      objetivoMl: '3000',
    })
  const [weightForm, setWeightForm] = useState<WeightFormState>(() =>
    createDefaultWeightForm(),
  )
  const [foodSearch, setFoodSearch] = useState('')
  const [foodLibrarySearch, setFoodLibrarySearch] = useState('')
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([])
  const [selectedFoodPortions, setSelectedFoodPortions] = useState<Record<string, string>>(
    {},
  )
  const [historyDate, setHistoryDate] = useState('')
  const [historyType, setHistoryType] = useState<NutricionTipoComida | 'todas'>(
    'todas',
  )
  const [historySortField, setHistorySortField] =
    useState<HistorySortField>('calorias')
  const [historySortDirection, setHistorySortDirection] =
    useState<SortDirection>('desc')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingFood, setSavingFood] = useState(false)
  const [savingMeal, setSavingMeal] = useState(false)
  const [savingHydration, setSavingHydration] = useState(false)
  const [savingWeight, setSavingWeight] = useState(false)
  const [deletingFoodId, setDeletingFoodId] = useState<string | null>(null)
  const [showHydrationModal, setShowHydrationModal] = useState(false)

  const fetchNutritionData = useCallback(async () => {
    const today = new Date()
    const ninetyDaysAgo = addDays(startOfDay(today), -90)

    const [
      profileResponse,
      alimentosResponse,
      comidasResponse,
      hidratacionResponse,
      pesosResponse,
      activitiesResponse,
    ] = await Promise.all([
      supabase
        .from('nutricion_perfiles')
        .select('*')
        .eq('user_id', userId)
        .limit(1),
      supabase
        .from('nutricion_alimentos')
        .select('*')
        .order('nombre', { ascending: true }),
      supabase
        .from('nutricion_comidas')
        .select('*')
        .eq('user_id', userId)
        .order('consumida_at', { ascending: false })
        .limit(300),
      supabase
        .from('nutricion_hidratacion')
        .select('*')
        .eq('user_id', userId)
        .gte('fecha', toDateInputValue(ninetyDaysAgo))
        .order('fecha', { ascending: true }),
      supabase
        .from('nutricion_pesos')
        .select('*')
        .eq('user_id', userId)
        .order('fecha', { ascending: true })
        .limit(80),
      supabase
        .from('actividades')
        .select('*')
        .eq('user_id', userId)
        .gte('fecha_inicio', ninetyDaysAgo.toISOString())
        .order('fecha_inicio', { ascending: false }),
    ])

    if (profileResponse.error) {
      throw new Error(profileResponse.error.message)
    }

    if (alimentosResponse.error) {
      throw new Error(alimentosResponse.error.message)
    }

    if (comidasResponse.error) {
      throw new Error(comidasResponse.error.message)
    }

    if (hidratacionResponse.error) {
      throw new Error(hidratacionResponse.error.message)
    }

    if (pesosResponse.error) {
      throw new Error(pesosResponse.error.message)
    }

    if (activitiesResponse.error) {
      throw new Error(activitiesResponse.error.message)
    }

    const nextProfile =
      (profileResponse.data ?? []).map((row, index) =>
        normalizeNutricionPerfil(row, index),
      )[0] ?? null
    const nextFoods = (alimentosResponse.data ?? []).map((row, index) =>
      normalizeNutricionAlimento(row, index),
    )
    const nextMeals = (comidasResponse.data ?? []).map((row, index) =>
      normalizeNutricionComida(row, index),
    )
    const mealIds = nextMeals.map((meal) => meal.id)
    let nextMealItems: NutricionComidaAlimento[] = []

    if (mealIds.length > 0) {
      const mealItemsResponse = await supabase
        .from('nutricion_comida_alimentos')
        .select('*')
        .in('comida_id', mealIds)

      if (mealItemsResponse.error) {
        throw new Error(mealItemsResponse.error.message)
      }

      nextMealItems = (mealItemsResponse.data ?? []).map((row, index) =>
        normalizeNutricionComidaAlimento(row, index),
      )
    }

    const nextWeights = (pesosResponse.data ?? []).map((row, index) =>
      normalizeNutricionPeso(row, index),
    )
    const nextHydration = (hidratacionResponse.data ?? []).map((row, index) =>
      normalizeNutricionHidratacion(row, index),
    )
    const nextActivities = (activitiesResponse.data ?? [])
      .map((row, index) => normalizeActividad(row, index))
      .filter(
        (activity) =>
          activity.categoria === 'actividad_fisica' ||
          (activity.descripcion ?? '').startsWith('[[subtipo:actividad_fisica]]'),
      )

    setProfile(nextProfile)
    setAlimentos(nextFoods)
    setComidas(nextMeals)
    setComidaItems(nextMealItems)
    setHidratacion(nextHydration)
    setPesos(nextWeights)
    setPhysicalActivities(nextActivities)
    setProfileForm(nextProfile ? createProfileFormFromRecord(nextProfile) : createDefaultProfileForm())
    setWeightForm(
      createDefaultWeightForm(nextProfile?.peso_kg ?? nextWeights.at(-1)?.peso_kg),
    )
  }, [userId])

  useEffect(() => {
    let isMounted = true

    const loadNutritionData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        await fetchNutritionData()
      } catch (issue) {
        if (!isMounted) {
          return
        }

        setError(
          issue instanceof Error
            ? issue.message
            : 'No pudimos cargar el modulo de nutricion.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadNutritionData()

    return () => {
      isMounted = false
    }
  }, [fetchNutritionData])

  const todayKey = toDateInputValue(new Date())

  const foodById = useMemo(() => {
    return alimentos.reduce<Record<string, NutricionAlimento>>((grouped, alimento) => {
      grouped[alimento.id] = alimento
      return grouped
    }, {})
  }, [alimentos])

  const mealItemsByMeal = useMemo(() => {
    return comidaItems.reduce<Record<string, NutricionComidaAlimento[]>>(
      (grouped, item) => {
        if (!grouped[item.comida_id]) {
          grouped[item.comida_id] = []
        }

        grouped[item.comida_id]?.push(item)
        return grouped
      },
      {},
    )
  }, [comidaItems])

  const mealsWithTotals = useMemo<MealWithTotals[]>(() => {
    return comidas.map((meal) => {
      const foods = (mealItemsByMeal[meal.id] ?? []).map((item) => ({
        item,
        alimento: foodById[item.alimento_id] ?? null,
      }))
      const totals = foods.reduce<MealTotals>((currentTotals, foodEntry) => {
        if (!foodEntry.alimento) {
          return currentTotals
        }

        return addFoodToTotals(currentTotals, foodEntry.alimento, foodEntry.item.porciones)
      }, emptyTotals)

      return {
        meal,
        foods,
        totals,
      }
    })
  }, [comidas, foodById, mealItemsByMeal])

  const targets = useMemo(
    () => calculateNutritionTargets(profile, physicalActivities),
    [physicalActivities, profile],
  )

  const todayMeals = useMemo(() => {
    return mealsWithTotals.filter(
      (meal) => toDateInputValue(parseStoredDateTime(meal.meal.consumida_at)) === todayKey,
    )
  }, [mealsWithTotals, todayKey])

  const todayTotals = useMemo(() => {
    return todayMeals.reduce<MealTotals>(
      (totals, meal) => sumTotals(totals, meal.totals),
      emptyTotals,
    )
  }, [todayMeals])

  const hydrationToday = useMemo<NutricionHidratacion>(() => {
    return (
      hidratacion.find((record) => record.fecha === todayKey) ?? {
        id: '',
        user_id: userId,
        fecha: todayKey,
        consumido_ml: 0,
        objetivo_ml: profile?.hidratacion_objetivo_ml ?? 3000,
        created_at: null,
        updated_at: null,
      }
    )
  }, [hidratacion, profile?.hidratacion_objetivo_ml, todayKey, userId])

  const filteredFoods = useMemo(() => {
    const searchValue = normalizeSearchValue(foodSearch)
    if (!searchValue) {
      return alimentos.slice(0, 20)
    }

    return alimentos
      .filter((alimento) => normalizeSearchValue(alimento.nombre).includes(searchValue))
      .slice(0, 20)
  }, [alimentos, foodSearch])

  const filteredLibraryFoods = useMemo(() => {
    const searchValue = normalizeSearchValue(foodLibrarySearch)
    if (!searchValue) {
      return alimentos
    }

    return alimentos.filter((alimento) =>
      normalizeSearchValue(alimento.nombre).includes(searchValue),
    )
  }, [alimentos, foodLibrarySearch])

  const selectedFoods = useMemo(() => {
    return selectedFoodIds
      .map((foodId) => foodById[foodId])
      .filter((food): food is NutricionAlimento => Boolean(food))
  }, [foodById, selectedFoodIds])

  const mealPreviewTotals = useMemo(() => {
    return selectedFoods.reduce<MealTotals>((totals, food) => {
      return addFoodToTotals(totals, food, readPortions(selectedFoodPortions[food.id]))
    }, emptyTotals)
  }, [selectedFoodPortions, selectedFoods])

  const historyMeals = useMemo(() => {
    const filteredMeals = mealsWithTotals.filter((meal) => {
      const mealDate = toDateInputValue(parseStoredDateTime(meal.meal.consumida_at))
      const matchesDate = historyDate ? mealDate === historyDate : true
      const matchesType =
        historyType === 'todas' ? true : meal.meal.tipo_comida === historyType

      return matchesDate && matchesType
    })

    return filteredMeals.sort((first, second) => {
      const firstValue = getHistorySortValue(first.totals, historySortField)
      const secondValue = getHistorySortValue(second.totals, historySortField)

      return historySortDirection === 'desc'
        ? secondValue - firstValue
        : firstValue - secondValue
    })
  }, [historyDate, historySortDirection, historySortField, historyType, mealsWithTotals])

  const dailyNutritionSeries = useMemo(
    () => createDailyNutritionSeries(mealsWithTotals, hidratacion, 14),
    [hidratacion, mealsWithTotals],
  )

  const weeklyWeightData = useMemo(() => createWeeklyWeightData(pesos), [pesos])

  const contributionDays = useMemo(
    () => createContributionCalendarData(mealsWithTotals, hidratacion, targets, 56),
    [hidratacion, mealsWithTotals, targets],
  )

  const weightPrompt = useMemo(() => createWeightPrompt(pesos), [pesos])

  const refreshAll = async () => {
    await fetchNutritionData()
  }

  const handleProfileChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleFoodFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setFoodForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleMealFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setMealForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleWeightFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target

    setWeightForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleHydrationManualChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target

    setHydrationManualForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingProfile(true)

    try {
      const payload = buildProfilePayload(profileForm, userId)

      if (profile) {
        const { error: updateError } = await supabase
          .from('nutricion_perfiles')
          .update(payload)
          .eq('id', profile.id)
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: insertError } = await supabase
          .from('nutricion_perfiles')
          .insert(payload)

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      await saveWeightForDay(userId, todayKey, payload.peso_kg)
      await refreshAll()
      onDataChanged()
    } catch (issue) {
      setMutationError(
        issue instanceof Error
          ? issue.message
          : 'No pudimos guardar el perfil nutricional.',
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveFood = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingFood(true)

    try {
      const payload = buildFoodPayload(foodForm, userId)
      const { error: insertError } = await supabase
        .from('nutricion_alimentos')
        .insert(payload)

      if (insertError) {
        throw new Error(insertError.message)
      }

      await refreshAll()
      setFoodForm(initialFoodForm)
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos guardar el alimento.',
      )
    } finally {
      setSavingFood(false)
    }
  }

  const handleDeleteFood = async (foodId: string) => {
    setMutationError(null)
    setDeletingFoodId(foodId)

    try {
      const { error: deleteError } = await supabase
        .from('nutricion_alimentos')
        .delete()
        .eq('id', foodId)
        .eq('created_by', userId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await refreshAll()
      setSelectedFoodIds((currentIds) => currentIds.filter((id) => id !== foodId))
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos eliminar el alimento.',
      )
    } finally {
      setDeletingFoodId(null)
    }
  }

  const handleToggleFood = (foodId: string) => {
    setSelectedFoodIds((currentIds) => {
      if (currentIds.includes(foodId)) {
        return currentIds.filter((id) => id !== foodId)
      }

      setSelectedFoodPortions((currentPortions) => ({
        ...currentPortions,
        [foodId]: currentPortions[foodId] ?? '1',
      }))
      return [...currentIds, foodId]
    })
  }

  const handlePortionChange = (foodId: string, value: string) => {
    setSelectedFoodPortions((currentPortions) => ({
      ...currentPortions,
      [foodId]: value,
    }))
  }

  const handleSaveMeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingMeal(true)

    try {
      if (selectedFoodIds.length === 0) {
        throw new Error('Selecciona al menos un alimento para el plato.')
      }

      const consumedAt = createLocalDateTime(mealForm.date, mealForm.time)
      const mealPayload = {
        user_id: userId,
        nombre_plato: mealForm.nombrePlato.trim(),
        tipo_comida: mealForm.tipoComida,
        consumida_at: consumedAt.toISOString(),
      }

      if (!mealPayload.nombre_plato) {
        throw new Error('Ingresa el nombre del plato.')
      }

      const { data: mealData, error: mealInsertError } = await supabase
        .from('nutricion_comidas')
        .insert(mealPayload)
        .select('id')
        .single()

      if (mealInsertError) {
        throw new Error(mealInsertError.message)
      }

      const mealId = typeof mealData?.id === 'string' ? mealData.id : null
      if (!mealId) {
        throw new Error('No pudimos confirmar la comida creada.')
      }

      const itemPayloads = selectedFoodIds.map((foodId) => ({
        comida_id: mealId,
        alimento_id: foodId,
        porciones: readPortions(selectedFoodPortions[foodId]),
      }))

      const { error: itemsInsertError } = await supabase
        .from('nutricion_comida_alimentos')
        .insert(itemPayloads)

      if (itemsInsertError) {
        await supabase.from('nutricion_comidas').delete().eq('id', mealId).eq('user_id', userId)
        throw new Error(itemsInsertError.message)
      }

      await refreshAll()
      onDataChanged()
      setMealForm(createDefaultMealForm())
      setSelectedFoodIds([])
      setSelectedFoodPortions({})
      setFoodSearch('')
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos registrar la comida.',
      )
    } finally {
      setSavingMeal(false)
    }
  }

  const handleAddWater = async (amount: number) => {
    setMutationError(null)
    setSavingHydration(true)

    try {
      await upsertHydrationDay({
        consumedMl: Math.max(0, hydrationToday.consumido_ml + amount),
        date: todayKey,
        targetMl: hydrationToday.objetivo_ml,
        userId,
      })

      await refreshAll()
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos actualizar la hidratacion.',
      )
    } finally {
      setSavingHydration(false)
    }
  }

  const openHydrationManualModal = () => {
    setHydrationManualForm({
      ajusteMl: '0',
      objetivoMl: String(hydrationToday.objetivo_ml),
    })
    setShowHydrationModal(true)
  }

  const handleManualHydration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingHydration(true)

    try {
      const adjustment = Number.parseInt(hydrationManualForm.ajusteMl, 10) || 0
      const nextTarget = Math.max(
        1,
        Number.parseInt(hydrationManualForm.objetivoMl, 10) || hydrationToday.objetivo_ml,
      )
      const nextConsumed = Math.max(0, hydrationToday.consumido_ml + adjustment)

      await upsertHydrationDay({
        consumedMl: nextConsumed,
        date: todayKey,
        targetMl: nextTarget,
        userId,
      })

      if (profile) {
        const { error: profileUpdateError } = await supabase
          .from('nutricion_perfiles')
          .update({ hidratacion_objetivo_ml: nextTarget })
          .eq('id', profile.id)
          .eq('user_id', userId)

        if (profileUpdateError) {
          throw new Error(profileUpdateError.message)
        }
      }

      await refreshAll()
      setShowHydrationModal(false)
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos ajustar la hidratacion.',
      )
    } finally {
      setSavingHydration(false)
    }
  }

  const handleSaveWeight = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setSavingWeight(true)

    try {
      const pesoKg = Number.parseFloat(weightForm.pesoKg)
      if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
        throw new Error('Ingresa un peso valido.')
      }

      await saveWeightForDay(userId, weightForm.fecha, pesoKg)

      if (profile) {
        const { error: profileUpdateError } = await supabase
          .from('nutricion_perfiles')
          .update({ peso_kg: pesoKg })
          .eq('id', profile.id)
          .eq('user_id', userId)

        if (profileUpdateError) {
          throw new Error(profileUpdateError.message)
        }
      }

      await refreshAll()
    } catch (issue) {
      setMutationError(
        issue instanceof Error ? issue.message : 'No pudimos registrar el peso.',
      )
    } finally {
      setSavingWeight(false)
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/75 sm:text-sm sm:tracking-[0.26em]">
              Nutricion
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Composicion corporal, comidas e hidratacion
            </h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <NutricionTabButton
              active={activeTab === 'registro'}
              icon={<Utensils className="h-4 w-4" />}
              label="Registro diario"
              onClick={() => {
                setActiveTab('registro')
              }}
            />
            <NutricionTabButton
              active={activeTab === 'historial'}
              icon={<Clock3 className="h-4 w-4" />}
              label="Historial"
              onClick={() => {
                setActiveTab('historial')
              }}
            />
            <NutricionTabButton
              active={activeTab === 'progreso'}
              icon={<ChartNoAxesColumn className="h-4 w-4" />}
              label="Progreso"
              onClick={() => {
                setActiveTab('progreso')
              }}
            />
            <NutricionTabButton
              active={activeTab === 'alimentos'}
              icon={<Salad className="h-4 w-4" />}
              label="Alimentos"
              onClick={() => {
                setActiveTab('alimentos')
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/45 p-4 text-sm text-slate-300 sm:p-6">
            Cargando perfil, comidas y progreso...
          </div>
        ) : null}
      </section>

      {!isLoading && activeTab === 'registro' ? (
        <section className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
            <ProfilePanel
              form={profileForm}
              onChange={handleProfileChange}
              onSubmit={handleSaveProfile}
              saving={savingProfile}
            />

            <DailyTargetsPanel
              physicalActivities={physicalActivities}
              targets={targets}
              todayTotals={todayTotals}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.25fr)]">
            <HydrationPanel
              hydrationToday={hydrationToday}
              onAddWater={(amount) => {
                void handleAddWater(amount)
              }}
              onManual={openHydrationManualModal}
              saving={savingHydration}
            />

            <MealRegisterPanel
              filteredFoods={filteredFoods}
              foodForm={foodForm}
              foodSearch={foodSearch}
              mealForm={mealForm}
              mealPreviewTotals={mealPreviewTotals}
              onFoodFormChange={handleFoodFormChange}
              onFoodSearchChange={setFoodSearch}
              onMealFormChange={handleMealFormChange}
              onPortionChange={handlePortionChange}
              onSaveFood={handleSaveFood}
              onSaveMeal={handleSaveMeal}
              onToggleFood={handleToggleFood}
              savingFood={savingFood}
              savingMeal={savingMeal}
              selectedFoodIds={selectedFoodIds}
              selectedFoodPortions={selectedFoodPortions}
              selectedFoods={selectedFoods}
            />
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === 'historial' ? (
        <HistoryPanel
          historyDate={historyDate}
          historyMeals={historyMeals}
          historySortDirection={historySortDirection}
          historySortField={historySortField}
          historyType={historyType}
          onDateChange={setHistoryDate}
          onSortDirectionChange={setHistorySortDirection}
          onSortFieldChange={setHistorySortField}
          onTypeChange={setHistoryType}
        />
      ) : null}

      {!isLoading && activeTab === 'progreso' ? (
        <ProgressPanel
          contributionDays={contributionDays}
          dailyNutritionSeries={dailyNutritionSeries}
          onWeightFormChange={handleWeightFormChange}
          onWeightSubmit={handleSaveWeight}
          savingWeight={savingWeight}
          targets={targets}
          weeklyWeightData={weeklyWeightData}
          weightForm={weightForm}
          weightPrompt={weightPrompt}
        />
      ) : null}

      {!isLoading && activeTab === 'alimentos' ? (
        <FoodLibraryPanel
          deletingFoodId={deletingFoodId}
          filteredLibraryFoods={filteredLibraryFoods}
          foodForm={foodForm}
          foodLibrarySearch={foodLibrarySearch}
          onDeleteFood={(foodId) => {
            void handleDeleteFood(foodId)
          }}
          onFoodFormChange={handleFoodFormChange}
          onFoodLibrarySearchChange={setFoodLibrarySearch}
          onSaveFood={handleSaveFood}
          savingFood={savingFood}
          userId={userId}
        />
      ) : null}

      {showHydrationModal ? (
        <ModalFrame
          onClose={() => {
            setShowHydrationModal(false)
          }}
          subtitle="Ajuste manual de hidratacion"
          title="Hidratacion diaria"
        >
          <form className="mt-6 space-y-4" onSubmit={handleManualHydration}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Ajuste en ml
                </span>
                <input
                  className={inputClassName}
                  name="ajusteMl"
                  onChange={handleHydrationManualChange}
                  placeholder="Ej: 250 o -250"
                  step="50"
                  type="number"
                  value={hydrationManualForm.ajusteMl}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Objetivo diario
                </span>
                <input
                  className={inputClassName}
                  min="1"
                  name="objetivoMl"
                  onChange={handleHydrationManualChange}
                  step="50"
                  type="number"
                  value={hydrationManualForm.objetivoMl}
                />
              </label>
            </div>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={savingHydration}
              type="submit"
            >
              <GlassWater className="h-4 w-4" />
              {savingHydration ? 'Guardando...' : 'Guardar ajuste'}
            </button>
          </form>
        </ModalFrame>
      ) : null}
    </div>
  )
}

type ProfilePanelProps = {
  form: ProfileFormState
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

function ProfilePanel({ form, onChange, onSubmit, saving }: ProfilePanelProps) {
  return (
    <form
      className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6"
      onSubmit={onSubmit}
    >
      <div className="flex items-center gap-3">
        <Scale className="h-5 w-5 text-lime-200" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/75 sm:text-sm sm:tracking-[0.26em]">
            Composicion corporal
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            Datos base
          </h3>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <input
          required
          className={inputClassName}
          min="1"
          name="pesoKg"
          onChange={onChange}
          placeholder="Peso kg"
          step="0.1"
          type="number"
          value={form.pesoKg}
        />
        <input
          required
          className={inputClassName}
          min="1"
          name="alturaCm"
          onChange={onChange}
          placeholder="Altura cm"
          step="0.1"
          type="number"
          value={form.alturaCm}
        />
        <input
          required
          className={inputClassName}
          min="1"
          name="edad"
          onChange={onChange}
          placeholder="Edad"
          type="number"
          value={form.edad}
        />
        <select
          className={selectClassName}
          name="genero"
          onChange={onChange}
          value={form.genero}
        >
          {Object.entries(genderLabels).map(([value, label]) => (
            <option key={value} className={optionClassName} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Composicion corporal
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {Object.entries(goalLabels).map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                form.objetivoComposicion === value
                  ? 'border-lime-300/40 bg-lime-300/12 text-lime-100'
                  : 'border-white/10 bg-slate-900/45 text-slate-300'
              }`}
            >
              <input
                className="h-4 w-4 accent-lime-300"
                checked={form.objetivoComposicion === value}
                name="objetivoComposicion"
                onChange={onChange}
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <button
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={saving}
        type="submit"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Guardando...' : 'Guardar perfil'}
      </button>
    </form>
  )
}

type DailyTargetsPanelProps = {
  physicalActivities: Actividad[]
  targets: NutritionTargets
  todayTotals: MealTotals
}

function DailyTargetsPanel({
  physicalActivities,
  targets,
  todayTotals,
}: DailyTargetsPanelProps) {
  const remainingCalories = Math.max(0, targets.calories - todayTotals.calorias)

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-lime-200" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/75 sm:text-sm sm:tracking-[0.26em]">
              Objetivos diarios
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              {formatNumber(targets.calories)} kcal
            </h3>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
          <MetricBox label="TMB" value={`${formatNumber(targets.bmr)} kcal`} />
          <MetricBox label="Actividad" value={targets.activityLabel} />
          <MetricBox
            label="Ultimos 7 dias"
            value={`${countCompletedActivities(physicalActivities)} sesiones`}
          />
        </div>
      </div>

      <div className="mt-7 rounded-3xl border border-white/10 bg-slate-900/45 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {formatNumber(todayTotals.calorias)} kcal consumidas
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {formatNumber(remainingCalories)} kcal restantes
            </p>
          </div>
          <Flame className="h-5 w-5 text-amber-200" />
        </div>
        <ProgressBar
          className="mt-4 h-5"
          colorClassName="bg-[linear-gradient(90deg,#84cc16,#f59e0b)]"
          progress={calculateProgress(todayTotals.calorias, targets.calories)}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <MacroProgress
          colorClassName="bg-[linear-gradient(90deg,#22c55e,#84cc16)]"
          current={todayTotals.proteinasG}
          icon={<Beef className="h-4 w-4" />}
          label="Proteinas"
          target={targets.proteinG}
        />
        <MacroProgress
          colorClassName="bg-[linear-gradient(90deg,#facc15,#fb923c)]"
          current={todayTotals.grasasG}
          icon={<Apple className="h-4 w-4" />}
          label="Grasas"
          target={targets.fatG}
        />
        <MacroProgress
          colorClassName="bg-[linear-gradient(90deg,#38bdf8,#a78bfa)]"
          current={todayTotals.carbohidratosG}
          icon={<Wheat className="h-4 w-4" />}
          label="Carbohidratos"
          target={targets.carbsG}
        />
      </div>
    </section>
  )
}

type HydrationPanelProps = {
  hydrationToday: NutricionHidratacion
  onAddWater: (amount: number) => void
  onManual: () => void
  saving: boolean
}

function HydrationPanel({
  hydrationToday,
  onAddWater,
  onManual,
  saving,
}: HydrationPanelProps) {
  const progress = calculateProgress(hydrationToday.consumido_ml, hydrationToday.objetivo_ml)

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
      <div className="flex items-center gap-3">
        <Droplets className="h-5 w-5 text-cyan-200" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/75 sm:text-sm sm:tracking-[0.26em]">
            Hidratacion
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            {hydrationToday.consumido_ml} / {hydrationToday.objetivo_ml} ml
          </h3>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-center">
        <div className="relative h-64 w-36 overflow-hidden rounded-b-[3rem] rounded-t-2xl border-4 border-cyan-100/35 bg-slate-950/45 shadow-[inset_0_0_30px_rgba(14,165,233,0.16)]">
          <div
            className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,#7dd3fc,#0284c7)] transition-all duration-500"
            style={{ height: `${Math.min(100, progress)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-2xl border border-white/15 bg-slate-950/45 px-3 py-2 text-sm font-semibold text-cyan-50">
              {progress.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:max-w-xs">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving}
            onClick={() => {
              onAddWater(250)
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            +250ml
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving}
            onClick={() => {
              onAddWater(500)
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            +500ml
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200/25 bg-cyan-200/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving}
            onClick={onManual}
            type="button"
          >
            <GlassWater className="h-4 w-4" />
            Ajuste manual
          </button>
        </div>
      </div>
    </section>
  )
}

type MealRegisterPanelProps = {
  filteredFoods: NutricionAlimento[]
  foodForm: FoodFormState
  foodSearch: string
  mealForm: MealFormState
  mealPreviewTotals: MealTotals
  onFoodFormChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onFoodSearchChange: (value: string) => void
  onMealFormChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onPortionChange: (foodId: string, value: string) => void
  onSaveFood: (event: FormEvent<HTMLFormElement>) => void
  onSaveMeal: (event: FormEvent<HTMLFormElement>) => void
  onToggleFood: (foodId: string) => void
  savingFood: boolean
  savingMeal: boolean
  selectedFoodIds: string[]
  selectedFoodPortions: Record<string, string>
  selectedFoods: NutricionAlimento[]
}

function MealRegisterPanel({
  filteredFoods,
  foodForm,
  foodSearch,
  mealForm,
  mealPreviewTotals,
  onFoodFormChange,
  onFoodSearchChange,
  onMealFormChange,
  onPortionChange,
  onSaveFood,
  onSaveMeal,
  onToggleFood,
  savingFood,
  savingMeal,
  selectedFoodIds,
  selectedFoodPortions,
  selectedFoods,
}: MealRegisterPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
      <div className="flex items-center gap-3">
        <Utensils className="h-5 w-5 text-lime-200" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/75 sm:text-sm sm:tracking-[0.26em]">
            Consumos
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            Registrar plato
          </h3>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
        <form className="space-y-5" onSubmit={onSaveMeal}>
          <input
            required
            className={inputClassName}
            name="nombrePlato"
            onChange={onMealFormChange}
            placeholder="Nombre del plato"
            value={mealForm.nombrePlato}
          />

          <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputClassName} pl-11`}
                onChange={(event) => {
                  onFoodSearchChange(event.target.value)
                }}
                placeholder="Buscar alimentos"
                value={foodSearch}
              />
            </label>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {filteredFoods.length > 0 ? (
                filteredFoods.map((food) => {
                  const isSelected = selectedFoodIds.includes(food.id)

                  return (
                    <label
                      key={food.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                        isSelected
                          ? 'border-lime-300/35 bg-lime-300/12'
                          : 'border-white/10 bg-white/6 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          className="h-4 w-4 shrink-0 accent-lime-300"
                          checked={isSelected}
                          onChange={() => {
                            onToggleFood(food.id)
                          }}
                          type="checkbox"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {food.nombre}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatNumber(food.calorias)} kcal por {food.gramos_por_porcion}g
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-200" />
                      ) : null}
                    </label>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/12 bg-slate-950/25 p-4 text-sm text-slate-300">
                  No hay alimentos para esa busqueda.
                </div>
              )}
            </div>
          </div>

          {selectedFoods.length > 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Alimentos seleccionados
              </p>
              <div className="mt-4 space-y-3">
                {selectedFoods.map((food) => (
                  <div
                    key={food.id}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-white/6 p-3 sm:grid-cols-[minmax(0,1fr)_120px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {food.nombre}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatMacro(food.proteinas_g)} P · {formatMacro(food.carbohidratos_g)} C · {formatMacro(food.grasas_g)} G
                      </p>
                    </div>
                    <input
                      className={smallInputClassName}
                      min="0.01"
                      onChange={(event) => {
                        onPortionChange(food.id, event.target.value)
                      }}
                      step="0.25"
                      type="number"
                      value={selectedFoodPortions[food.id] ?? '1'}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <select
              className={selectClassName}
              name="tipoComida"
              onChange={onMealFormChange}
              value={mealForm.tipoComida}
            >
              {mealTypes.map((mealType) => (
                <option key={mealType} className={optionClassName} value={mealType}>
                  {mealTypeLabels[mealType]}
                </option>
              ))}
            </select>
            <input
              required
              className={inputClassName}
              name="date"
              onChange={onMealFormChange}
              type="date"
              value={mealForm.date}
            />
            <input
              required
              className={inputClassName}
              name="time"
              onChange={onMealFormChange}
              type="time"
              value={mealForm.time}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <MetricBox label="Kcal" value={formatNumber(mealPreviewTotals.calorias)} />
            <MetricBox label="Proteinas" value={formatMacro(mealPreviewTotals.proteinasG)} />
            <MetricBox label="Carbs" value={formatMacro(mealPreviewTotals.carbohidratosG)} />
            <MetricBox label="Grasas" value={formatMacro(mealPreviewTotals.grasasG)} />
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={savingMeal}
            type="submit"
          >
            <Plus className="h-4 w-4" />
            {savingMeal ? 'Guardando...' : 'Registrar comida'}
          </button>
        </form>

        <FoodFormPanel
          compact
          foodForm={foodForm}
          onChange={onFoodFormChange}
          onSubmit={onSaveFood}
          saving={savingFood}
        />
      </div>
    </section>
  )
}

type HistoryPanelProps = {
  historyDate: string
  historyMeals: MealWithTotals[]
  historySortDirection: SortDirection
  historySortField: HistorySortField
  historyType: NutricionTipoComida | 'todas'
  onDateChange: (value: string) => void
  onSortDirectionChange: (value: SortDirection) => void
  onSortFieldChange: (value: HistorySortField) => void
  onTypeChange: (value: NutricionTipoComida | 'todas') => void
}

function HistoryPanel({
  historyDate,
  historyMeals,
  historySortDirection,
  historySortField,
  historyType,
  onDateChange,
  onSortDirectionChange,
  onSortFieldChange,
  onTypeChange,
}: HistoryPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
      <div className="flex items-center gap-3">
        <Clock3 className="h-5 w-5 text-lime-200" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/75 sm:text-sm sm:tracking-[0.26em]">
            Historial
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            Comidas registradas
          </h3>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <input
          className={inputClassName}
          onChange={(event) => {
            onDateChange(event.target.value)
          }}
          type="date"
          value={historyDate}
        />
        <select
          className={selectClassName}
          onChange={(event) => {
            onTypeChange(event.target.value as NutricionTipoComida | 'todas')
          }}
          value={historyType}
        >
          <option className={optionClassName} value="todas">
            Todas
          </option>
          {mealTypes.map((mealType) => (
            <option key={mealType} className={optionClassName} value={mealType}>
              {mealTypeLabels[mealType]}
            </option>
          ))}
        </select>
        <select
          className={selectClassName}
          onChange={(event) => {
            onSortFieldChange(event.target.value as HistorySortField)
          }}
          value={historySortField}
        >
          <option className={optionClassName} value="calorias">
            Calorias
          </option>
          <option className={optionClassName} value="proteinas">
            Proteinas
          </option>
          <option className={optionClassName} value="carbohidratos">
            Carbohidratos
          </option>
          <option className={optionClassName} value="grasas">
            Grasas
          </option>
        </select>
        <select
          className={selectClassName}
          onChange={(event) => {
            onSortDirectionChange(event.target.value as SortDirection)
          }}
          value={historySortDirection}
        >
          <option className={optionClassName} value="desc">
            Mayor a menor
          </option>
          <option className={optionClassName} value="asc">
            Menor a mayor
          </option>
        </select>
      </div>

      <div className="mt-6 space-y-4">
        {historyMeals.length > 0 ? (
          historyMeals.map((entry) => (
            <article
              key={entry.meal.id}
              className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-2xl border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-lime-100">
                      {mealTypeLabels[entry.meal.tipo_comida]}
                    </span>
                    <span className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-xs text-slate-300">
                      {formatDateTimeLabel(entry.meal.consumida_at)}
                    </span>
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-white">
                    {entry.meal.nombre_plato}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {entry.foods
                      .map((food) => food.alimento?.nombre)
                      .filter(Boolean)
                      .join(', ') || 'Sin alimentos vinculados'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                  <MetricBox label="Kcal" value={formatNumber(entry.totals.calorias)} />
                  <MetricBox label="Proteinas" value={formatMacro(entry.totals.proteinasG)} />
                  <MetricBox label="Carbs" value={formatMacro(entry.totals.carbohidratosG)} />
                  <MetricBox label="Grasas" value={formatMacro(entry.totals.grasasG)} />
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300">
            No hay comidas para esos filtros.
          </div>
        )}
      </div>
    </section>
  )
}

type ProgressPanelProps = {
  contributionDays: CalendarContributionDay[]
  dailyNutritionSeries: DailyNutritionPoint[]
  onWeightFormChange: (event: ChangeEvent<HTMLInputElement>) => void
  onWeightSubmit: (event: FormEvent<HTMLFormElement>) => void
  savingWeight: boolean
  targets: NutritionTargets
  weeklyWeightData: Array<{ label: string; value: number }>
  weightForm: WeightFormState
  weightPrompt: { due: boolean; label: string }
}

function ProgressPanel({
  contributionDays,
  dailyNutritionSeries,
  onWeightFormChange,
  onWeightSubmit,
  savingWeight,
  targets,
  weeklyWeightData,
  weightForm,
  weightPrompt,
}: ProgressPanelProps) {
  return (
    <section className="space-y-6">
      {weightPrompt.due ? (
        <form
          className="rounded-[1.75rem] border border-lime-300/25 bg-lime-300/10 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6"
          onSubmit={onWeightSubmit}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-lime-100" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-100/80 sm:text-sm sm:tracking-[0.26em]">
                  Control semanal
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  {weightPrompt.label}
                </h3>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-[minmax(130px,1fr)_minmax(130px,1fr)_auto] lg:max-w-xl">
              <input
                className={inputClassName}
                name="pesoKg"
                onChange={onWeightFormChange}
                placeholder="Peso kg"
                step="0.1"
                type="number"
                value={weightForm.pesoKg}
              />
              <input
                className={inputClassName}
                name="fecha"
                onChange={onWeightFormChange}
                type="date"
                value={weightForm.fecha}
              />
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={savingWeight}
                type="submit"
              >
                <Save className="h-4 w-4" />
                {savingWeight ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel icon={<Scale className="h-5 w-5 text-lime-200" />} title="Peso por semana">
          <WeightChart data={weeklyWeightData} />
        </ChartPanel>

        <ChartPanel
          icon={<Flame className="h-5 w-5 text-amber-200" />}
          title="Calorias por dia"
        >
          <DailyBarChart
            colorClassName="bg-[linear-gradient(180deg,#f59e0b,#ea580c)]"
            data={dailyNutritionSeries}
            target={targets.calories}
            valueKey="calories"
          />
        </ChartPanel>

        <ChartPanel
          icon={<Beef className="h-5 w-5 text-lime-200" />}
          title="Proteinas por dia"
        >
          <DailyBarChart
            colorClassName="bg-[linear-gradient(180deg,#84cc16,#16a34a)]"
            data={dailyNutritionSeries}
            target={targets.proteinG}
            valueKey="proteinG"
          />
        </ChartPanel>

        <ChartPanel
          icon={<CalendarCheck className="h-5 w-5 text-lime-200" />}
          title="Calendario de cumplimiento"
        >
          <ContributionCalendar days={contributionDays} />
        </ChartPanel>
      </div>
    </section>
  )
}

type FoodLibraryPanelProps = {
  deletingFoodId: string | null
  filteredLibraryFoods: NutricionAlimento[]
  foodForm: FoodFormState
  foodLibrarySearch: string
  onDeleteFood: (foodId: string) => void
  onFoodFormChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onFoodLibrarySearchChange: (value: string) => void
  onSaveFood: (event: FormEvent<HTMLFormElement>) => void
  savingFood: boolean
  userId: string
}

function FoodLibraryPanel({
  deletingFoodId,
  filteredLibraryFoods,
  foodForm,
  foodLibrarySearch,
  onDeleteFood,
  onFoodFormChange,
  onFoodLibrarySearchChange,
  onSaveFood,
  savingFood,
  userId,
}: FoodLibraryPanelProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)]">
      <FoodFormPanel
        foodForm={foodForm}
        onChange={onFoodFormChange}
        onSubmit={onSaveFood}
        saving={savingFood}
      />

      <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6">
        <div className="flex items-center gap-3">
          <Salad className="h-5 w-5 text-lime-200" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/75 sm:text-sm sm:tracking-[0.26em]">
              Biblioteca compartida
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Tipos de alimentos
            </h3>
          </div>
        </div>

        <label className="relative mt-6 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClassName} pl-11`}
            onChange={(event) => {
              onFoodLibrarySearchChange(event.target.value)
            }}
            placeholder="Buscar en alimentos"
            value={foodLibrarySearch}
          />
        </label>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filteredLibraryFoods.length > 0 ? (
            filteredLibraryFoods.map((food) => (
              <article
                key={food.id}
                className="rounded-3xl border border-white/10 bg-slate-900/45 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">
                      {food.nombre}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {formatNumber(food.calorias)} kcal · {food.gramos_por_porcion}g
                    </p>
                  </div>
                  {food.created_by === userId ? (
                    <button
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={deletingFoodId === food.id}
                      onClick={() => {
                        onDeleteFood(food.id)
                      }}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <FoodNutrient label="P" value={formatMacro(food.proteinas_g)} />
                  <FoodNutrient label="C" value={formatMacro(food.carbohidratos_g)} />
                  <FoodNutrient label="G" value={formatMacro(food.grasas_g)} />
                  <FoodNutrient label="Fibra" value={formatMacro(food.fibra_g)} />
                  <FoodNutrient label="Sodio" value={`${formatNumber(food.sodio_mg)}mg`} />
                  <FoodNutrient label="Porcion" value={`${food.gramos_por_porcion}g`} />
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300 lg:col-span-2">
              No hay alimentos cargados todavia.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

type FoodFormPanelProps = {
  compact?: boolean
  foodForm: FoodFormState
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}

function FoodFormPanel({
  compact = false,
  foodForm,
  onChange,
  onSubmit,
  saving,
}: FoodFormPanelProps) {
  return (
    <form
      className={`rounded-[1.75rem] border border-white/10 bg-slate-900/45 p-4 ${
        compact ? '' : 'shadow-[0_16px_48px_rgba(15,23,42,0.25)] sm:p-6'
      }`}
      onSubmit={onSubmit}
    >
      <div className="flex items-center gap-3">
        <Apple className="h-5 w-5 text-lime-200" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/75">
            Nuevo alimento
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Valores nutricionales
          </h3>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <input
          required
          className={inputClassName}
          name="nombre"
          onChange={onChange}
          placeholder="Nombre"
          value={foodForm.nombre}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            className={inputClassName}
            min="1"
            name="gramosPorPorcion"
            onChange={onChange}
            placeholder="Gramos por porcion"
            step="0.1"
            type="number"
            value={foodForm.gramosPorPorcion}
          />
          <input
            required
            className={inputClassName}
            min="0"
            name="calorias"
            onChange={onChange}
            placeholder="Calorias"
            step="0.1"
            type="number"
            value={foodForm.calorias}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            required
            className={inputClassName}
            min="0"
            name="proteinasG"
            onChange={onChange}
            placeholder="Proteinas"
            step="0.1"
            type="number"
            value={foodForm.proteinasG}
          />
          <input
            required
            className={inputClassName}
            min="0"
            name="carbohidratosG"
            onChange={onChange}
            placeholder="Carbohidratos"
            step="0.1"
            type="number"
            value={foodForm.carbohidratosG}
          />
          <input
            required
            className={inputClassName}
            min="0"
            name="grasasG"
            onChange={onChange}
            placeholder="Grasas"
            step="0.1"
            type="number"
            value={foodForm.grasasG}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inputClassName}
            min="0"
            name="fibraG"
            onChange={onChange}
            placeholder="Fibra"
            step="0.1"
            type="number"
            value={foodForm.fibraG}
          />
          <input
            className={inputClassName}
            min="0"
            name="sodioMg"
            onChange={onChange}
            placeholder="Sodio mg"
            step="0.1"
            type="number"
            value={foodForm.sodioMg}
          />
        </div>
      </div>

      <button
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={saving}
        type="submit"
      >
        <Plus className="h-4 w-4" />
        {saving ? 'Guardando...' : 'Agregar alimento'}
      </button>
    </form>
  )
}

type NutricionTabButtonProps = {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}

function NutricionTabButton({
  active,
  icon,
  label,
  onClick,
}: NutricionTabButtonProps) {
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition sm:w-auto ${
        active
          ? 'border-lime-300/35 bg-lime-300/12 text-lime-100'
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

type MetricBoxProps = {
  label: string
  value: string
}

function MetricBox({ label, value }: MetricBoxProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

type FoodNutrientProps = {
  label: string
  value: string
}

function FoodNutrient({ label, value }: FoodNutrientProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2">
      <p className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-white">{value}</p>
    </div>
  )
}

type MacroProgressProps = {
  colorClassName: string
  current: number
  icon: ReactNode
  label: string
  target: number
}

function MacroProgress({
  colorClassName,
  current,
  icon,
  label,
  target,
}: MacroProgressProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-lime-100">
          {icon}
          <p className="text-sm font-semibold text-white">{label}</p>
        </div>
        <p className="text-sm text-slate-300">
          {formatMacro(current)} / {formatMacro(target)}
        </p>
      </div>
      <ProgressBar
        className="mt-3 h-3"
        colorClassName={colorClassName}
        progress={calculateProgress(current, target)}
      />
    </div>
  )
}

type ProgressBarProps = {
  className?: string
  colorClassName: string
  progress: number
}

function ProgressBar({ className = 'h-3', colorClassName, progress }: ProgressBarProps) {
  return (
    <div className={`${className} overflow-hidden rounded-full bg-slate-800`}>
      <div
        className={`h-full rounded-full ${colorClassName}`}
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-200/75 sm:text-sm sm:tracking-[0.26em]">
            Grafico
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">{title}</h3>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function WeightChart({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 bg-slate-900/35 p-5 text-sm text-slate-300">
        Registra tu peso para ver la tendencia semanal.
      </div>
    )
  }

  const minValue = Math.min(...data.map((point) => point.value))
  const maxValue = Math.max(...data.map((point) => point.value))
  const range = Math.max(1, maxValue - minValue)

  return (
    <div className="grid h-64 grid-cols-8 items-end gap-2 sm:h-72 sm:gap-3">
      {data.map((point) => {
        const height = 18 + ((point.value - minValue) / range) * 82

        return (
          <div key={point.label} className="flex h-full min-w-0 flex-col justify-end">
            <div
              className="rounded-t-2xl bg-[linear-gradient(180deg,#84cc16,#15803d)]"
              style={{ height: `${height}%` }}
              title={`${point.label}: ${point.value.toFixed(1)}kg`}
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

function DailyBarChart({
  colorClassName,
  data,
  target,
  valueKey,
}: {
  colorClassName: string
  data: DailyNutritionPoint[]
  target: number
  valueKey: 'calories' | 'proteinG'
}) {
  const maxValue = Math.max(1, target, ...data.map((point) => point[valueKey]))

  return (
    <div className="grid h-64 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1.5 sm:h-72 sm:gap-2">
      {data.map((point) => {
        const value = point[valueKey]
        const height = Math.max(6, (value / maxValue) * 100)

        return (
          <div key={point.date} className="flex h-full min-w-0 flex-col justify-end">
            <div
              className={`rounded-t-xl ${colorClassName}`}
              style={{ height: `${height}%` }}
              title={`${point.label}: ${formatNumber(value)}`}
            />
            <p className="mt-3 truncate text-center text-[0.68rem] text-slate-400">
              {point.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function ContributionCalendar({ days }: { days: CalendarContributionDay[] }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => (
        <div
          key={day.date}
          className={`aspect-square rounded-lg border ${getContributionColor(day.score)}`}
          title={`${day.label}: ${(day.score * 100).toFixed(0)}%`}
        />
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
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-[0_24px_100px_rgba(2,6,23,0.65)] sm:max-h-[calc(100vh-4rem)] sm:rounded-[2rem] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/75 sm:text-sm sm:tracking-[0.26em]">
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

function createDefaultProfileForm(): ProfileFormState {
  return {
    pesoKg: '70',
    alturaCm: '170',
    edad: '30',
    genero: 'otro',
    objetivoComposicion: 'mantenimiento',
  }
}

function createProfileFormFromRecord(profile: NutricionPerfil): ProfileFormState {
  return {
    pesoKg: String(profile.peso_kg),
    alturaCm: String(profile.altura_cm),
    edad: String(profile.edad),
    genero: profile.genero,
    objetivoComposicion: profile.objetivo_composicion,
  }
}

function createDefaultMealForm(): MealFormState {
  const now = new Date()

  return {
    nombrePlato: '',
    tipoComida: 'almuerzo',
    date: toDateInputValue(now),
    time: toTimeInputValue(now),
  }
}

function createDefaultWeightForm(weight?: number): WeightFormState {
  return {
    fecha: toDateInputValue(new Date()),
    pesoKg: weight ? String(weight) : '',
  }
}

function buildProfilePayload(form: ProfileFormState, userId: string) {
  const pesoKg = Number.parseFloat(form.pesoKg)
  const alturaCm = Number.parseFloat(form.alturaCm)
  const edad = Number.parseInt(form.edad, 10)

  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    throw new Error('Ingresa un peso valido.')
  }

  if (!Number.isFinite(alturaCm) || alturaCm <= 0) {
    throw new Error('Ingresa una altura valida.')
  }

  if (!Number.isFinite(edad) || edad <= 0) {
    throw new Error('Ingresa una edad valida.')
  }

  return {
    user_id: userId,
    peso_kg: pesoKg,
    altura_cm: alturaCm,
    edad,
    genero: form.genero,
    objetivo_composicion: form.objetivoComposicion,
  }
}

function buildFoodPayload(form: FoodFormState, userId: string) {
  const payload = {
    created_by: userId,
    nombre: form.nombre.trim(),
    gramos_por_porcion: Number.parseFloat(form.gramosPorPorcion),
    calorias: Number.parseFloat(form.calorias),
    proteinas_g: Number.parseFloat(form.proteinasG),
    carbohidratos_g: Number.parseFloat(form.carbohidratosG),
    grasas_g: Number.parseFloat(form.grasasG),
    fibra_g: Number.parseFloat(form.fibraG) || 0,
    sodio_mg: Number.parseFloat(form.sodioMg) || 0,
  }

  if (!payload.nombre) {
    throw new Error('Ingresa el nombre del alimento.')
  }

  if (!Number.isFinite(payload.gramos_por_porcion) || payload.gramos_por_porcion <= 0) {
    throw new Error('Ingresa los gramos por porcion.')
  }

  if (
    !Number.isFinite(payload.calorias) ||
    !Number.isFinite(payload.proteinas_g) ||
    !Number.isFinite(payload.carbohidratos_g) ||
    !Number.isFinite(payload.grasas_g)
  ) {
    throw new Error('Revisa los valores nutricionales principales.')
  }

  return payload
}

function calculateNutritionTargets(
  profile: NutricionPerfil | null,
  physicalActivities: Actividad[],
): NutritionTargets {
  const pesoKg = profile?.peso_kg ?? 70
  const alturaCm = profile?.altura_cm ?? 170
  const edad = profile?.edad ?? 30
  const genero = profile?.genero ?? 'otro'
  const objective = profile?.objetivo_composicion ?? 'mantenimiento'
  const bmrBase = 10 * pesoKg + 6.25 * alturaCm - 5 * edad
  const genderModifier =
    genero === 'masculino' ? 5 : genero === 'femenino' ? -161 : -78
  const bmr = Math.max(1, bmrBase + genderModifier)
  const activity = calculateActivityFactor(physicalActivities)
  const maintenanceCalories = bmr * activity.factor
  const adjustedCalories =
    objective === 'perdida_grasa'
      ? maintenanceCalories * 0.85
      : objective === 'ganancia_muscular'
        ? maintenanceCalories * 1.1
        : maintenanceCalories
  const proteinPerKg =
    objective === 'perdida_grasa'
      ? 2
      : objective === 'ganancia_muscular'
        ? 1.8
        : 1.6
  const fatPerKg =
    objective === 'ganancia_muscular'
      ? 0.9
      : objective === 'perdida_grasa'
        ? 0.8
        : 0.85
  const proteinG = pesoKg * proteinPerKg
  const fatG = pesoKg * fatPerKg
  const proteinCalories = proteinG * 4
  const fatCalories = fatG * 9
  const carbsG = Math.max(0, (adjustedCalories - proteinCalories - fatCalories) / 4)

  return {
    bmr: Math.round(bmr),
    activityFactor: activity.factor,
    activityLabel: activity.label,
    calories: Math.round(adjustedCalories),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
  }
}

function calculateActivityFactor(physicalActivities: Actividad[]) {
  const sevenDaysAgo = addDays(startOfDay(new Date()), -7)
  const completedActivities = physicalActivities.filter((activity) => {
    const startAt = parseStoredDateTime(activity.fecha_inicio)
    return startAt >= sevenDaysAgo && startAt <= new Date()
  })
  const hours = completedActivities.reduce((total, activity) => {
    const startAt = parseStoredDateTime(activity.fecha_inicio)
    const endAt = parseStoredDateTime(activity.fecha_fin ?? activity.fecha_inicio)
    return total + Math.max(0, endAt.getTime() - startAt.getTime()) / 3600000
  }, 0)
  const sessions = completedActivities.length

  if (sessions >= 7 || hours >= 8) {
    return { factor: 1.9, label: 'Muy alta' }
  }

  if (sessions >= 5 || hours >= 5) {
    return { factor: 1.725, label: 'Alta' }
  }

  if (sessions >= 3 || hours >= 3) {
    return { factor: 1.55, label: 'Moderada' }
  }

  if (sessions >= 1 || hours >= 1) {
    return { factor: 1.375, label: 'Ligera' }
  }

  return { factor: 1.2, label: 'Baja' }
}

function countCompletedActivities(physicalActivities: Actividad[]) {
  const sevenDaysAgo = addDays(startOfDay(new Date()), -7)
  const now = new Date()

  return physicalActivities.filter((activity) => {
    const startAt = parseStoredDateTime(activity.fecha_inicio)
    return startAt >= sevenDaysAgo && startAt <= now
  }).length
}

function addFoodToTotals(
  currentTotals: MealTotals,
  food: NutricionAlimento,
  portions: number,
): MealTotals {
  return {
    calorias: currentTotals.calorias + food.calorias * portions,
    proteinasG: currentTotals.proteinasG + food.proteinas_g * portions,
    carbohidratosG: currentTotals.carbohidratosG + food.carbohidratos_g * portions,
    grasasG: currentTotals.grasasG + food.grasas_g * portions,
    fibraG: currentTotals.fibraG + food.fibra_g * portions,
    sodioMg: currentTotals.sodioMg + food.sodio_mg * portions,
  }
}

function sumTotals(first: MealTotals, second: MealTotals): MealTotals {
  return {
    calorias: first.calorias + second.calorias,
    proteinasG: first.proteinasG + second.proteinasG,
    carbohidratosG: first.carbohidratosG + second.carbohidratosG,
    grasasG: first.grasasG + second.grasasG,
    fibraG: first.fibraG + second.fibraG,
    sodioMg: first.sodioMg + second.sodioMg,
  }
}

function getHistorySortValue(totals: MealTotals, field: HistorySortField) {
  if (field === 'proteinas') {
    return totals.proteinasG
  }

  if (field === 'carbohidratos') {
    return totals.carbohidratosG
  }

  if (field === 'grasas') {
    return totals.grasasG
  }

  return totals.calorias
}

function createDailyNutritionSeries(
  meals: MealWithTotals[],
  hydration: NutricionHidratacion[],
  totalDays: number,
): DailyNutritionPoint[] {
  const today = startOfDay(new Date())

  return Array.from({ length: totalDays }, (_, index) => {
    const day = addDays(today, index - totalDays + 1)
    const dateKey = toDateInputValue(day)
    const mealsForDay = meals.filter(
      (meal) => toDateInputValue(parseStoredDateTime(meal.meal.consumida_at)) === dateKey,
    )
    const totals = mealsForDay.reduce<MealTotals>(
      (currentTotals, meal) => sumTotals(currentTotals, meal.totals),
      emptyTotals,
    )
    const hydrationForDay =
      hydration.find((record) => record.fecha === dateKey)?.consumido_ml ?? 0

    return {
      date: dateKey,
      label: formatDateLabel(day, { day: '2-digit', month: 'short' }),
      calories: totals.calorias,
      proteinG: totals.proteinasG,
      hydrationMl: hydrationForDay,
    }
  })
}

function createWeeklyWeightData(pesos: NutricionPeso[]) {
  const currentWeekStart = startOfWeek(new Date())

  return Array.from({ length: 8 }, (_, index) => {
    const weekStart = addDays(currentWeekStart, (index - 7) * 7)
    const weekEnd = addDays(weekStart, 6)
    const weightsForWeek = pesos.filter((peso) => {
      const date = parseDateOnly(peso.fecha)
      return date >= weekStart && date <= weekEnd
    })
    const lastWeight = weightsForWeek.at(-1)

    return {
      label: formatDateLabel(weekStart, { day: '2-digit', month: 'short' }),
      value: lastWeight?.peso_kg ?? 0,
    }
  }).filter((point) => point.value > 0)
}

function createContributionCalendarData(
  meals: MealWithTotals[],
  hydration: NutricionHidratacion[],
  targets: NutritionTargets,
  totalDays: number,
): CalendarContributionDay[] {
  const today = startOfDay(new Date())

  return Array.from({ length: totalDays }, (_, index) => {
    const day = addDays(today, index - totalDays + 1)
    const dateKey = toDateInputValue(day)
    const mealsForDay = meals.filter(
      (meal) => toDateInputValue(parseStoredDateTime(meal.meal.consumida_at)) === dateKey,
    )
    const totals = mealsForDay.reduce<MealTotals>(
      (currentTotals, meal) => sumTotals(currentTotals, meal.totals),
      emptyTotals,
    )
    const hydrationForDay = hydration.find((record) => record.fecha === dateKey)
    const calorieScore = scoreCloseness(totals.calorias, targets.calories)
    const hydrationScore = hydrationForDay
      ? scoreCloseness(hydrationForDay.consumido_ml, hydrationForDay.objetivo_ml)
      : 0

    return {
      date: dateKey,
      label: formatDateLabel(day, { day: '2-digit', month: 'short' }),
      score: (calorieScore + hydrationScore) / 2,
    }
  })
}

function createWeightPrompt(pesos: NutricionPeso[]) {
  const lastWeight = pesos.at(-1)

  if (!lastWeight) {
    return {
      due: true,
      label: 'Registra tu primer peso',
    }
  }

  const lastDate = parseDateOnly(lastWeight.fecha)
  const diffDays = Math.floor(
    (startOfDay(new Date()).getTime() - startOfDay(lastDate).getTime()) / 86400000,
  )

  return {
    due: diffDays >= 7,
    label:
      diffDays >= 7
        ? `Pasaron ${diffDays} dias desde el ultimo registro`
        : `Ultimo registro hace ${diffDays} dias`,
  }
}

async function saveWeightForDay(userId: string, date: string, pesoKg: number) {
  const { error } = await supabase.from('nutricion_pesos').upsert(
    {
      user_id: userId,
      fecha: date,
      peso_kg: pesoKg,
    },
    { onConflict: 'user_id,fecha' },
  )

  if (error) {
    throw new Error(error.message)
  }
}

async function upsertHydrationDay({
  consumedMl,
  date,
  targetMl,
  userId,
}: {
  consumedMl: number
  date: string
  targetMl: number
  userId: string
}) {
  const { error } = await supabase.from('nutricion_hidratacion').upsert(
    {
      user_id: userId,
      fecha: date,
      consumido_ml: consumedMl,
      objetivo_ml: targetMl,
    },
    { onConflict: 'user_id,fecha' },
  )

  if (error) {
    throw new Error(error.message)
  }
}

function calculateProgress(current: number, target: number) {
  if (target <= 0) {
    return 0
  }

  return (current / target) * 100
}

function scoreCloseness(current: number, target: number) {
  if (target <= 0 || current <= 0) {
    return 0
  }

  const distance = Math.abs(current - target) / target
  return Math.max(0, 1 - distance)
}

function getContributionColor(score: number) {
  if (score >= 0.9) {
    return 'border-emerald-300/35 bg-emerald-400'
  }

  if (score >= 0.7) {
    return 'border-lime-300/35 bg-lime-400'
  }

  if (score >= 0.45) {
    return 'border-amber-300/35 bg-amber-400'
  }

  if (score > 0) {
    return 'border-rose-300/35 bg-rose-500'
  }

  return 'border-white/10 bg-slate-800'
}

function createLocalDateTime(dateValue: string, timeValue: string) {
  const date = new Date(`${dateValue}T${timeValue || '00:00'}`)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Revisa la fecha y hora seleccionadas.')
  }

  return date
}

function parseDateOnly(value: string) {
  const [yearValue, monthValue, dayValue] = value.slice(0, 10).split('-')
  const year = Number.parseInt(yearValue ?? '', 10)
  const month = Number.parseInt(monthValue ?? '', 10)
  const day = Number.parseInt(dayValue ?? '', 10)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return parseStoredDateTime(value)
  }

  return new Date(year, month - 1, day)
}

function readPortions(value: string | undefined) {
  const parsed = Number.parseFloat(value ?? '1')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value))
}

function formatMacro(value: number) {
  return `${new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 1,
  }).format(Math.max(0, value))}g`
}

function formatDateTimeLabel(value: string) {
  const date = parseStoredDateTime(value)
  return `${formatDateLabel(date, { day: '2-digit', month: 'short' })} · ${formatTimeLabel(date)}`
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

export default ModuloNutricion
