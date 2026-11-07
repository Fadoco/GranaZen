export type Debt = {
  id: string
  category: string
  name: string
  amount: number
  dueDate: string
  notes: string
  isPaid: boolean
  paidAt: string | null
  isRecurring: boolean
  recurrenceGroupId: string | null
  installmentAmount?: number
  installmentsTotal?: number
  installmentsPaid?: number
  interestRateMonthly?: number
  priority?: 'low' | 'normal' | 'high'
  remainingBalance?: number
  createdAt: string
}
