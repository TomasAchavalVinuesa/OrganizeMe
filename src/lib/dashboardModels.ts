export type RawRow = Record<string, unknown>

export type ActividadCategoria =
  | 'evento_unico'
  | 'actividad_fisica'
  | 'cumpleanos'
  | 'juntada'
  | 'actividad_rutinaria'
  | 'tiempo_dedicado'

export type Actividad = {
  color: string
  categoria: ActividadCategoria
  datos_extra: Record<string, unknown>
  descripcion: string | null
  eliminada_calendario_at: string | null
  fecha_fin: string | null
  fecha_inicio: string
  id: string
  ocurrencia_fecha: string | null
  oculta_calendarios: boolean
  serie_id: string | null
  tipo: 'evento' | 'recordatorio' | 'bloque_tiempo'
  titulo: string
  user_id: string
  visible_calendario_mensual: boolean
}

export type TareaKanban = {
  actividad_id: string | null
  columna: 'pendientes' | 'in_progress' | 'done' | 'archived'
  id: string
  pomodoros_completados: number
  pomodoros_estimados: number
  posicion: number
  titulo: string
  user_id: string
}

export type Subtarea = {
  completada: boolean
  descripcion: string
  id: string
  tarea_id: string
}

export type Cuenta = {
  id: string
  nombre: string
  saldo_actual: number
  tipo: 'billetera_virtual' | 'banco' | 'efectivo'
  user_id: string
}

export type Transaccion = {
  categoria: string
  cuenta_id: string
  es_recurrente: boolean
  fecha: string | null
  id: string
  monto: number
  tarea_id: string | null
  tipo: 'ingreso' | 'egreso' | 'transferencia'
  user_id: string
}

export type MetaAhorro = {
  fecha_limite: string | null
  id: string
  monto_actual: number
  monto_objetivo: number
  nombre: string
  plazo: 'corto' | 'mediano' | 'largo'
  user_id: string
}

export type EntrenamientoEjercicio = {
  created_at: string | null
  descripcion: string
  grupo_muscular: string
  id: string
  imagen_url: string
  instrucciones: string
  nombre: string
  updated_at: string | null
  user_id: string
}

export type EntrenamientoRutina = {
  created_at: string | null
  descripcion: string | null
  estado: 'borrador' | 'guardada'
  id: string
  nombre: string
  tiempo_estimado_minutos: number
  updated_at: string | null
  user_id: string
}

export type EntrenamientoRutinaEjercicio = {
  descanso_segundos: number
  ejercicio_id: string
  id: string
  modo: 'repeticiones' | 'temporizador'
  notas: string | null
  orden: number
  repeticiones: number | null
  rutina_id: string
  series: number
  temporizador_segundos: number | null
}

export type EntrenamientoObjetivo = {
  created_at: string | null
  fecha_fin: string | null
  fecha_inicio: string
  id: string
  metrica: 'horas' | 'entrenamientos'
  nombre: string
  objetivo_entrenamientos: number
  objetivo_horas: number
  updated_at: string | null
  user_id: string
}

export type NutricionGenero = 'masculino' | 'femenino' | 'otro'

export type NutricionObjetivo =
  | 'perdida_grasa'
  | 'ganancia_muscular'
  | 'mantenimiento'

export type NutricionTipoComida =
  | 'desayuno'
  | 'almuerzo'
  | 'merienda'
  | 'cena'
  | 'snack'

export type NutricionPerfil = {
  altura_cm: number
  created_at: string | null
  edad: number
  genero: NutricionGenero
  hidratacion_objetivo_ml: number
  id: string
  objetivo_composicion: NutricionObjetivo
  peso_kg: number
  updated_at: string | null
  user_id: string
}

export type NutricionAlimento = {
  calorias: number
  carbohidratos_g: number
  created_at: string | null
  created_by: string | null
  fibra_g: number
  grasas_g: number
  gramos_por_porcion: number
  id: string
  nombre: string
  proteinas_g: number
  sodio_mg: number
  updated_at: string | null
}

export type NutricionComida = {
  consumida_at: string
  created_at: string | null
  id: string
  nombre_plato: string
  tipo_comida: NutricionTipoComida
  updated_at: string | null
  user_id: string
}

export type NutricionComidaAlimento = {
  alimento_id: string
  comida_id: string
  id: string
  porciones: number
}

export type NutricionHidratacion = {
  consumido_ml: number
  created_at: string | null
  fecha: string
  id: string
  objetivo_ml: number
  updated_at: string | null
  user_id: string
}

export type NutricionPeso = {
  created_at: string | null
  fecha: string
  id: string
  peso_kg: number
  user_id: string
}

export function normalizeActividad(row: unknown, index: number): Actividad {
  const safeRow = asRow(row)
  const tipo = normalizeActividadTipo(readString(safeRow.tipo))

  return {
    id: readString(safeRow.id) ?? `actividad-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    titulo: readString(safeRow.titulo) ?? 'Actividad sin titulo',
    descripcion: readString(safeRow.descripcion),
    tipo,
    categoria: normalizeActividadCategoria(
      readString(safeRow.categoria),
      readString(safeRow.descripcion),
      tipo,
    ),
    fecha_inicio: readString(safeRow.fecha_inicio) ?? new Date().toISOString(),
    fecha_fin: readString(safeRow.fecha_fin),
    color: readString(safeRow.color) ?? defaultActivityColor(tipo),
    visible_calendario_mensual: readBoolean(safeRow.visible_calendario_mensual) ?? true,
    serie_id: readString(safeRow.serie_id),
    ocurrencia_fecha: readString(safeRow.ocurrencia_fecha),
    oculta_calendarios: readBoolean(safeRow.oculta_calendarios) ?? false,
    eliminada_calendario_at: readString(safeRow.eliminada_calendario_at),
    datos_extra: readRecord(safeRow.datos_extra),
  }
}

export function normalizeTareaKanban(row: unknown, index: number): TareaKanban {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `tarea-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    actividad_id: readString(safeRow.actividad_id),
    titulo: readString(safeRow.titulo) ?? 'Tarea sin titulo',
    columna: normalizeTaskColumn(readString(safeRow.columna)),
    posicion: readNumber(safeRow.posicion) ?? index,
    pomodoros_estimados: readNumber(safeRow.pomodoros_estimados) ?? 4,
    pomodoros_completados: readNumber(safeRow.pomodoros_completados) ?? 0,
  }
}

export function normalizeSubtarea(row: unknown, index: number): Subtarea {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `subtarea-${index}`,
    tarea_id: readString(safeRow.tarea_id) ?? '',
    descripcion: readString(safeRow.descripcion) ?? 'Subtarea',
    completada: readBoolean(safeRow.completada) ?? false,
  }
}

export function normalizeCuenta(row: unknown, index: number): Cuenta {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `cuenta-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    nombre: readString(safeRow.nombre) ?? 'Cuenta sin nombre',
    tipo: normalizeAccountType(readString(safeRow.tipo)),
    saldo_actual: readNumber(safeRow.saldo_actual) ?? 0,
  }
}

export function normalizeTransaccion(row: unknown, index: number): Transaccion {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `transaccion-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    cuenta_id: readString(safeRow.cuenta_id) ?? '',
    tarea_id: readString(safeRow.tarea_id),
    tipo: normalizeTransactionType(readString(safeRow.tipo)),
    monto: readNumber(safeRow.monto) ?? 0,
    categoria: readString(safeRow.categoria) ?? 'Sin categoria',
    fecha: readString(safeRow.fecha),
    es_recurrente: readBoolean(safeRow.es_recurrente) ?? false,
  }
}

export function normalizeMetaAhorro(row: unknown, index: number): MetaAhorro {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `meta-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    nombre: readString(safeRow.nombre) ?? 'Meta de ahorro',
    monto_objetivo: readNumber(safeRow.monto_objetivo) ?? 0,
    monto_actual: readNumber(safeRow.monto_actual) ?? 0,
    plazo: normalizeGoalPlazo(readString(safeRow.plazo)),
    fecha_limite: readString(safeRow.fecha_limite),
  }
}

export function normalizeEntrenamientoEjercicio(
  row: unknown,
  index: number,
): EntrenamientoEjercicio {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `ejercicio-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    nombre: readString(safeRow.nombre) ?? 'Ejercicio sin nombre',
    descripcion: readString(safeRow.descripcion) ?? '',
    instrucciones: readString(safeRow.instrucciones) ?? '',
    imagen_url: readString(safeRow.imagen_url) ?? '',
    grupo_muscular: readString(safeRow.grupo_muscular) ?? 'General',
    created_at: readString(safeRow.created_at),
    updated_at: readString(safeRow.updated_at),
  }
}

export function normalizeEntrenamientoRutina(
  row: unknown,
  index: number,
): EntrenamientoRutina {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `rutina-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    nombre: readString(safeRow.nombre) ?? 'Rutina sin nombre',
    descripcion: readString(safeRow.descripcion),
    tiempo_estimado_minutos: readNumber(safeRow.tiempo_estimado_minutos) ?? 45,
    estado: normalizeTrainingRoutineStatus(readString(safeRow.estado)),
    created_at: readString(safeRow.created_at),
    updated_at: readString(safeRow.updated_at),
  }
}

export function normalizeEntrenamientoRutinaEjercicio(
  row: unknown,
  index: number,
): EntrenamientoRutinaEjercicio {
  const safeRow = asRow(row)
  const modo = normalizeTrainingRoutineExerciseMode(readString(safeRow.modo))

  return {
    id: readString(safeRow.id) ?? `rutina-ejercicio-${index}`,
    rutina_id: readString(safeRow.rutina_id) ?? '',
    ejercicio_id: readString(safeRow.ejercicio_id) ?? '',
    orden: readNumber(safeRow.orden) ?? index,
    series: Math.max(1, readNumber(safeRow.series) ?? 3),
    repeticiones:
      modo === 'repeticiones'
        ? Math.max(1, readNumber(safeRow.repeticiones) ?? 10)
        : null,
    temporizador_segundos:
      modo === 'temporizador'
        ? Math.max(10, readNumber(safeRow.temporizador_segundos) ?? 60)
        : null,
    modo,
    descanso_segundos: Math.max(0, readNumber(safeRow.descanso_segundos) ?? 60),
    notas: readString(safeRow.notas),
  }
}

export function normalizeEntrenamientoObjetivo(
  row: unknown,
  index: number,
): EntrenamientoObjetivo {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `objetivo-entrenamiento-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    nombre: readString(safeRow.nombre) ?? 'Objetivo de entrenamiento',
    metrica: normalizeTrainingGoalMetric(readString(safeRow.metrica)),
    objetivo_horas: readNumber(safeRow.objetivo_horas) ?? 0,
    objetivo_entrenamientos: readNumber(safeRow.objetivo_entrenamientos) ?? 0,
    fecha_inicio: readString(safeRow.fecha_inicio) ?? new Date().toISOString(),
    fecha_fin: readString(safeRow.fecha_fin),
    created_at: readString(safeRow.created_at),
    updated_at: readString(safeRow.updated_at),
  }
}

export function normalizeNutricionPerfil(
  row: unknown,
  index: number,
): NutricionPerfil {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `nutricion-perfil-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    peso_kg: Math.max(1, readNumber(safeRow.peso_kg) ?? 70),
    altura_cm: Math.max(1, readNumber(safeRow.altura_cm) ?? 170),
    edad: Math.max(1, readNumber(safeRow.edad) ?? 30),
    genero: normalizeNutritionGender(readString(safeRow.genero)),
    objetivo_composicion: normalizeNutritionGoal(
      readString(safeRow.objetivo_composicion),
    ),
    hidratacion_objetivo_ml: Math.max(
      1,
      readNumber(safeRow.hidratacion_objetivo_ml) ?? 3000,
    ),
    created_at: readString(safeRow.created_at),
    updated_at: readString(safeRow.updated_at),
  }
}

export function normalizeNutricionAlimento(
  row: unknown,
  index: number,
): NutricionAlimento {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `nutricion-alimento-${index}`,
    created_by: readString(safeRow.created_by),
    nombre: readString(safeRow.nombre) ?? 'Alimento sin nombre',
    gramos_por_porcion: Math.max(1, readNumber(safeRow.gramos_por_porcion) ?? 100),
    calorias: Math.max(0, readNumber(safeRow.calorias) ?? 0),
    proteinas_g: Math.max(0, readNumber(safeRow.proteinas_g) ?? 0),
    carbohidratos_g: Math.max(0, readNumber(safeRow.carbohidratos_g) ?? 0),
    grasas_g: Math.max(0, readNumber(safeRow.grasas_g) ?? 0),
    fibra_g: Math.max(0, readNumber(safeRow.fibra_g) ?? 0),
    sodio_mg: Math.max(0, readNumber(safeRow.sodio_mg) ?? 0),
    created_at: readString(safeRow.created_at),
    updated_at: readString(safeRow.updated_at),
  }
}

export function normalizeNutricionComida(
  row: unknown,
  index: number,
): NutricionComida {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `nutricion-comida-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    nombre_plato: readString(safeRow.nombre_plato) ?? 'Comida sin nombre',
    tipo_comida: normalizeNutritionMealType(readString(safeRow.tipo_comida)),
    consumida_at: readString(safeRow.consumida_at) ?? new Date().toISOString(),
    created_at: readString(safeRow.created_at),
    updated_at: readString(safeRow.updated_at),
  }
}

export function normalizeNutricionComidaAlimento(
  row: unknown,
  index: number,
): NutricionComidaAlimento {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `nutricion-comida-alimento-${index}`,
    comida_id: readString(safeRow.comida_id) ?? '',
    alimento_id: readString(safeRow.alimento_id) ?? '',
    porciones: Math.max(0.01, readNumber(safeRow.porciones) ?? 1),
  }
}

export function normalizeNutricionHidratacion(
  row: unknown,
  index: number,
): NutricionHidratacion {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `nutricion-hidratacion-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    fecha: readString(safeRow.fecha) ?? new Date().toISOString().slice(0, 10),
    objetivo_ml: Math.max(1, readNumber(safeRow.objetivo_ml) ?? 3000),
    consumido_ml: Math.max(0, readNumber(safeRow.consumido_ml) ?? 0),
    created_at: readString(safeRow.created_at),
    updated_at: readString(safeRow.updated_at),
  }
}

export function normalizeNutricionPeso(
  row: unknown,
  index: number,
): NutricionPeso {
  const safeRow = asRow(row)

  return {
    id: readString(safeRow.id) ?? `nutricion-peso-${index}`,
    user_id: readString(safeRow.user_id) ?? '',
    fecha: readString(safeRow.fecha) ?? new Date().toISOString().slice(0, 10),
    peso_kg: Math.max(1, readNumber(safeRow.peso_kg) ?? 70),
    created_at: readString(safeRow.created_at),
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value)
}

function asRow(row: unknown): RawRow {
  if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
    return row as RawRow
  }

  return {}
}

function normalizeActividadTipo(value: string | null): Actividad['tipo'] {
  if (
    value === 'evento' ||
    value === 'recordatorio' ||
    value === 'bloque_tiempo'
  ) {
    return value
  }

  return 'evento'
}

function normalizeActividadCategoria(
  value: string | null,
  descripcion: string | null,
  tipo: Actividad['tipo'],
): ActividadCategoria {
  if (descripcion?.startsWith('[[subtipo:actividad_fisica]]')) {
    return 'actividad_fisica'
  }

  if (descripcion?.startsWith('[[subtipo:cumpleanos]]')) {
    return 'cumpleanos'
  }

  if (
    value === 'evento_unico' ||
    value === 'actividad_fisica' ||
    value === 'cumpleanos' ||
    value === 'juntada' ||
    value === 'actividad_rutinaria' ||
    value === 'tiempo_dedicado'
  ) {
    return value
  }

  if (tipo === 'bloque_tiempo') {
    return 'tiempo_dedicado'
  }

  return 'evento_unico'
}

function normalizeTaskColumn(value: string | null): TareaKanban['columna'] {
  if (
    value === 'pendientes' ||
    value === 'in_progress' ||
    value === 'done' ||
    value === 'archived'
  ) {
    return value
  }

  if (value === 'todo') {
    return 'pendientes'
  }

  return 'pendientes'
}

function normalizeAccountType(value: string | null): Cuenta['tipo'] {
  if (
    value === 'billetera_virtual' ||
    value === 'banco' ||
    value === 'efectivo'
  ) {
    return value
  }

  return 'efectivo'
}

function normalizeTransactionType(value: string | null): Transaccion['tipo'] {
  if (
    value === 'ingreso' ||
    value === 'egreso' ||
    value === 'transferencia'
  ) {
    return value
  }

  return 'egreso'
}

function normalizeGoalPlazo(value: string | null): MetaAhorro['plazo'] {
  if (value === 'corto' || value === 'mediano' || value === 'largo') {
    return value
  }

  return 'largo'
}

function normalizeTrainingRoutineStatus(
  value: string | null,
): EntrenamientoRutina['estado'] {
  if (value === 'borrador' || value === 'guardada') {
    return value
  }

  return 'borrador'
}

function normalizeTrainingRoutineExerciseMode(
  value: string | null,
): EntrenamientoRutinaEjercicio['modo'] {
  if (value === 'repeticiones' || value === 'temporizador') {
    return value
  }

  return 'repeticiones'
}

function normalizeTrainingGoalMetric(
  value: string | null,
): EntrenamientoObjetivo['metrica'] {
  if (value === 'horas' || value === 'entrenamientos') {
    return value
  }

  return 'entrenamientos'
}

function normalizeNutritionGender(value: string | null): NutricionGenero {
  if (value === 'masculino' || value === 'femenino' || value === 'otro') {
    return value
  }

  return 'otro'
}

function normalizeNutritionGoal(value: string | null): NutricionObjetivo {
  if (
    value === 'perdida_grasa' ||
    value === 'ganancia_muscular' ||
    value === 'mantenimiento'
  ) {
    return value
  }

  return 'mantenimiento'
}

function normalizeNutritionMealType(value: string | null): NutricionTipoComida {
  if (
    value === 'desayuno' ||
    value === 'almuerzo' ||
    value === 'merienda' ||
    value === 'cena' ||
    value === 'snack'
  ) {
    return value
  }

  return 'snack'
}

function defaultActivityColor(tipo: Actividad['tipo']) {
  if (tipo === 'recordatorio') {
    return 'amber'
  }

  if (tipo === 'bloque_tiempo') {
    return 'violet'
  }

  return 'sky'
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  return null
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}
