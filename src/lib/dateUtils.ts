type DateFormatOptions = {
  day?: '2-digit' | 'numeric'
  month?: 'long' | 'numeric' | 'short'
  weekday?: 'long' | 'narrow' | 'short'
  year?: 'numeric'
}

export function addDays(date: Date, amount: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

export function startOfDay(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

export function endOfDay(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(23, 59, 59, 999)
  return nextDate
}

export function startOfWeek(date: Date) {
  const nextDate = startOfDay(date)
  const day = nextDate.getDay()
  const difference = day === 0 ? -6 : 1 - day
  nextDate.setDate(nextDate.getDate() + difference)
  return nextDate
}

export function endOfWeek(date: Date) {
  return endOfDay(addDays(startOfWeek(date), 6))
}

export function startOfMonth(date: Date) {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), 1)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

export function endOfMonth(date: Date) {
  const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  nextDate.setHours(23, 59, 59, 999)
  return nextDate
}

export function isSameDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  )
}

export function formatDateLabel(date: Date, options?: DateFormatOptions) {
  return new Intl.DateTimeFormat('es-AR', options).format(date)
}

export function formatTimeLabel(date: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function parseStoredDateTime(value: string) {
  const normalizedValue = value.includes(' ') ? value.replace(' ', 'T') : value
  const hasExplicitTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(normalizedValue)

  return new Date(hasExplicitTimezone ? normalizedValue : `${normalizedValue}Z`)
}

export function monthsBetween(startDate: Date, endDate: Date) {
  const years = endDate.getFullYear() - startDate.getFullYear()
  const months = endDate.getMonth() - startDate.getMonth()
  return years * 12 + months
}
