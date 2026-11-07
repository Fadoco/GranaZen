import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Debt } from './financeTypes.ts'

const REMINDER_ID_START = 1_000_000_000
const REMINDER_ID_RANGE = 1_000_000_000

const notificationIdFor = (id: string) => {
  let hash = 0
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0
  return REMINDER_ID_START + (hash >>> 0) % REMINDER_ID_RANGE
}

const localDateAtNine = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 9)
}

const localDateAtMidnight = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const supportsNativeReminders = () => Capacitor.getPlatform() === 'android'

export const getNativeReminderPermission = async () => {
  if (!supportsNativeReminders()) return 'unsupported'
  const status = await LocalNotifications.checkPermissions()
  return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default'
}

export const requestNativeReminderPermission = async () => {
  if (!supportsNativeReminders()) return 'unsupported'
  const status = await LocalNotifications.requestPermissions()
  return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default'
}

const scheduleDebtRemindersNow = async (debts: Debt[]) => {
  if (!supportsNativeReminders()) return
  const permission = await getNativeReminderPermission()
  if (permission !== 'granted') return

  const pending = await LocalNotifications.getPending()
  const existing = pending.notifications.filter((notification) =>
    notification.id >= REMINDER_ID_START && notification.id < REMINDER_ID_START + REMINDER_ID_RANGE,
  )
  if (existing.length) {
    await LocalNotifications.cancel({ notifications: existing.map(({ id }) => ({ id })) })
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const notifications = debts
    .filter((debt) => !debt.isPaid)
    .filter((debt) => {
      const dueDay = localDateAtMidnight(debt.dueDate)
      return dueDay.getTime() >= today.getTime() && dueDay.getTime() <= today.getTime() + 31 * 24 * 60 * 60 * 1000
    })
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
    .slice(0, 60)
    .map((debt) => {
      const dueDate = localDateAtNine(debt.dueDate)
      const scheduledDate = new Date(dueDate)
      scheduledDate.setDate(scheduledDate.getDate() - 1)
      if (scheduledDate.getTime() <= now.getTime()) scheduledDate.setTime(now.getTime() + 60_000)
      return {
        id: notificationIdFor(debt.id),
        title: 'Conta próxima do vencimento',
        body: `${debt.name} vence em ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(dueDate)}.`,
        schedule: { at: scheduledDate },
        extra: { debtId: debt.id },
      }
    })

  if (notifications.length) await LocalNotifications.schedule({ notifications })
}

let scheduling: Promise<void> = Promise.resolve()

export const scheduleDebtReminders = (debts: Debt[]) => {
  const operation = scheduling.then(() => scheduleDebtRemindersNow(debts))
  scheduling = operation.catch(() => undefined)
  return operation
}
