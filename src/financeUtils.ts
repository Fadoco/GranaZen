const localDateValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const isValidDateValue = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export const normalizeSearchText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

export const matchesSearch = (query: string, ...values: string[]) => {
  const normalizedQuery = normalizeSearchText(query.trim())
  return !normalizedQuery || values.some((value) => normalizeSearchText(value).includes(normalizedQuery))
}

export const nextRecurringDueDate = (dueDate: string, today = localDateValue(new Date())) => {
  const [dueYear, dueMonth, day] = dueDate.split('-').map(Number)
  const [todayYear, todayMonth] = today.split('-').map(Number)
  let year = dueYear
  let month = dueMonth
  if (dueYear < todayYear || (dueYear === todayYear && dueMonth < todayMonth)) {
    year = todayYear
    month = todayMonth
  }
  month += 1
  if (month > 12) {
    year += 1
    month = 1
  }
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}
