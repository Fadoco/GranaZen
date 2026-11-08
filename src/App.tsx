import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CarFront,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Check,
  CreditCard,
  Download,
  FileUp,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  Gift,
  HeartPulse,
  House,
  Landmark,
  Mail,
  CalendarRange,
  Moon,
  Plus,
  Phone,
  ReceiptText,
  History,
  Pencil,
  Search,
  UserRound,
  Upload,
  ShoppingBag,
  Settings,
  Settings2,
  ShieldCheck,
  Sun,
  ShoppingBasket,
  Tag,
  Trash2,
  Utensils,
  Wallet,
  X,
} from 'lucide-react'
import {
  checkForAndroidUpdate,
  downloadAndroidUpdate,
  getInstalledAndroidAppVersion,
  installDownloadedAndroidUpdate,
  isAndroidApp,
  type AndroidUpdate,
} from './androidUpdate'
import { pickBackupFile, saveBackupFile } from './backupFiles'
import { isValidDateValue, matchesSearch, nextRecurringDueDate } from './financeUtils'
import { parseStatementFile, selectNonDuplicateStatementEntries, type StatementEntry } from './statementImport'
import type { Debt } from './financeTypes'
import {
  getNativeReminderPermission,
  requestNativeReminderPermission,
  scheduleDebtReminders,
  supportsNativeReminders,
} from './localReminders'

type Section = 'inicio' | 'movimentos' | 'contas' | 'dividas' | 'calendario' | 'historico' | 'mais'
type Theme = 'system' | 'light' | 'dark'
type Accent = 'forest' | 'ocean' | 'plum'
type Preferences = { theme: Theme; textSize: 'normal' | 'large'; hideAmounts: boolean; accent: Accent }
type Profile = { name: string; email: string; phone: string; photo: string }
type DebtCategory = string
type DebtDraft = Omit<Debt, 'id' | 'isPaid' | 'paidAt' | 'recurrenceGroupId' | 'createdAt'>
type MovementKind = 'expense' | 'salary' | 'extra'
type MovementCategory = string
type Movement = {
  id: string
  kind: MovementKind
  category: MovementCategory
  name: string
  amount: number
  date: string
  notes: string
  walletId?: string | null
  createdAt: string
}
type MovementDraft = Omit<Movement, 'id' | 'createdAt'>
type WalletAccount = { id: string; name: string; kind: 'checking' | 'savings' | 'cash' | 'credit' | 'other'; openingBalance: number }
type SavingsGoal = { id: string; name: string; target: number; saved: number; deadline: string; createdAt: string }
type CategoryBudget = { id: string; category: string; limit: number; month: string }
type AppExtras = {
  customExpenseCategories: string[]
  wallets: WalletAccount[]
  goals: SavingsGoal[]
  budgets: CategoryBudget[]
  dashboardCards: string[]
}
type UndoableEntry =
  | { id: string; kind: 'debt'; item: Debt; label: string; expiresAt: number }
  | { id: string; kind: 'movement'; item: Movement; label: string; expiresAt: number }

const PREFERENCES_KEY = 'granazen-preferences'
const defaultPreferences: Preferences = { theme: 'system', textSize: 'normal', hideAmounts: false, accent: 'forest' }
const PROFILE_KEY = 'granazen-profile'
const defaultProfile: Profile = { name: '', email: '', phone: '', photo: '' }
const DEBTS_KEY = 'granazen-debts'
const MOVEMENTS_KEY = 'granazen-movements'
const EXTRAS_KEY = 'granazen-extras'
const BACKUP_SCHEMA_VERSION = 3
const defaultExtras: AppExtras = {
  customExpenseCategories: [],
  wallets: [{ id: 'default-wallet', name: 'Carteira principal', kind: 'checking', openingBalance: 0 }],
  goals: [],
  budgets: [],
  dashboardCards: ['balance', 'income', 'expenses', 'debts', 'reminders', 'chart', 'planning', 'activity', 'budgets', 'goals'],
}
const debtCategories: { label: DebtCategory; icon: typeof CreditCard }[] = [
  { label: 'Cartão de crédito', icon: CreditCard },
  { label: 'Boleto', icon: FileText },
  { label: 'Aluguel', icon: House },
  { label: 'Empréstimo', icon: Landmark },
  { label: 'Mercado', icon: ShoppingBasket },
  { label: 'Água', icon: Banknote },
  { label: 'Energia', icon: Banknote },
  { label: 'Internet', icon: Settings2 },
  { label: 'Telefone', icon: Settings2 },
  { label: 'Financiamento', icon: CarFront },
  { label: 'Imposto', icon: FileText },
  { label: 'Assinatura', icon: ReceiptText },
  { label: 'Outra', icon: Tag },
]
const expenseCategories: { label: Exclude<MovementCategory, 'Salário' | 'Renda extra'>; icon: typeof ShoppingBasket }[] = [
  { label: 'Mercado', icon: ShoppingBasket },
  { label: 'Comida', icon: Utensils },
  { label: 'Jogos', icon: Gamepad2 },
  { label: 'Compras online', icon: ShoppingBag },
  { label: 'Transporte', icon: CarFront },
  { label: 'Saúde', icon: HeartPulse },
  { label: 'Lazer', icon: Gift },
  { label: 'Casa', icon: House },
  { label: 'Educação', icon: Landmark },
  { label: 'Outros', icon: Tag },
]
const incomeCategories: { label: string; icon: typeof Banknote }[] = [
  { label: 'Salário', icon: BriefcaseBusiness },
  { label: 'Renda extra', icon: Gift },
]

const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const navigation: { id: Section; label: string; icon: typeof House }[] = [
  { id: 'inicio', label: 'Início', icon: House },
  { id: 'movimentos', label: 'Movimentos', icon: ArrowLeftRight },
  { id: 'contas', label: 'Contas', icon: ReceiptText },
  { id: 'dividas', label: 'Dívidas', icon: ArrowLeftRight },
  { id: 'calendario', label: 'Calendário', icon: CalendarRange },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'mais', label: 'Mais', icon: Settings },
]

const sectionTitles: Record<Section, string> = {
  inicio: 'Visão geral',
  movimentos: 'Movimentações',
  contas: 'Contas do mês',
  dividas: 'Dívidas e empréstimos',
  calendario: 'Calendário financeiro',
  historico: 'Histórico financeiro',
  mais: 'Personalização',
}

const themeOptions: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'Sistema', icon: Settings2 },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Escuro', icon: Moon },
]
const accentOptions: { id: Accent; label: string; color: string }[] = [
  { id: 'forest', label: 'Verde', color: '#287c58' },
  { id: 'ocean', label: 'Azul', color: '#3974bd' },
  { id: 'plum', label: 'Roxo', color: '#8055ac' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPreferences(value: unknown): value is Partial<Preferences> {
  return isRecord(value)
}

const parseBackupPreferences = (value: unknown): Preferences => {
  if (!isPreferences(value) ||
      (value.theme !== 'system' && value.theme !== 'light' && value.theme !== 'dark') ||
      (value.textSize !== 'normal' && value.textSize !== 'large') ||
      typeof value.hideAmounts !== 'boolean' ||
      (value.accent !== 'forest' && value.accent !== 'ocean' && value.accent !== 'plum')) {
    throw new Error('As configurações deste backup estão inválidas.')
  }
  return {
    theme: value.theme,
    textSize: value.textSize,
    hideAmounts: value.hideAmounts,
    accent: value.accent,
  }
}

const parseProfile = (value: unknown): Profile => {
  if (!isRecord(value) || typeof value.name !== 'string' ||
      typeof value.email !== 'string' || typeof value.phone !== 'string' ||
      typeof value.photo !== 'string' ||
      (value.photo !== '' && !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value.photo))) {
    throw new Error('Os dados do perfil neste backup estão inválidos.')
  }
  if (value.name.length > 50 || value.email.length > 100 || value.phone.length > 24 ||
      value.photo.length > 1024 * 1024) {
    throw new Error('Os dados do perfil excedem o limite permitido.')
  }
  return { name: value.name.trim(), email: value.email.trim(), phone: value.phone.trim(), photo: value.photo }
}

const parseExtras = (value: unknown): AppExtras => {
  if (!isRecord(value)) throw new Error('Os dados de planejamento deste backup estão inválidos.')
  const categories = value.customExpenseCategories
  const wallets = value.wallets
  const goals = value.goals
  const budgets = value.budgets
  const dashboardCards = value.dashboardCards
  if (!Array.isArray(categories) || categories.length > 50 ||
      !categories.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 40) ||
      !Array.isArray(wallets) || wallets.length > 30 ||
      !Array.isArray(goals) || goals.length > 100 ||
      !Array.isArray(budgets) || budgets.length > 500 ||
      !Array.isArray(dashboardCards) || !dashboardCards.every((item) =>
        ['balance', 'income', 'expenses', 'debts', 'reminders', 'chart', 'planning', 'activity', 'goals', 'budgets'].includes(String(item)),
      )) {
    throw new Error('Os dados de planejamento deste backup estão inválidos.')
  }
  const parsedWallets = wallets.map((wallet) => {
    if (!isRecord(wallet) || typeof wallet.id !== 'string' || typeof wallet.name !== 'string' ||
        !wallet.name.trim() || !['checking', 'savings', 'cash', 'credit', 'other'].includes(String(wallet.kind)) ||
        typeof wallet.openingBalance !== 'number' || !Number.isFinite(wallet.openingBalance)) {
      throw new Error('Há uma carteira com dados inválidos neste backup.')
    }
    return { id: wallet.id, name: wallet.name.trim(), kind: wallet.kind as WalletAccount['kind'], openingBalance: wallet.openingBalance }
  })
  const parsedGoals = goals.map((goal) => {
    if (!isRecord(goal) || typeof goal.id !== 'string' || typeof goal.name !== 'string' ||
        !goal.name.trim() || typeof goal.target !== 'number' || !Number.isFinite(goal.target) || goal.target <= 0 ||
        typeof goal.saved !== 'number' || !Number.isFinite(goal.saved) || goal.saved < 0 ||
        (goal.deadline !== '' && !isValidDateValue(goal.deadline)) || typeof goal.createdAt !== 'string') {
      throw new Error('Há uma meta com dados inválidos neste backup.')
    }
    return { id: goal.id, name: goal.name.trim(), target: goal.target, saved: goal.saved, deadline: goal.deadline, createdAt: goal.createdAt }
  })
  const parsedBudgets = budgets.map((budget) => {
    if (!isRecord(budget) || typeof budget.id !== 'string' || typeof budget.category !== 'string' ||
        !budget.category.trim() || typeof budget.limit !== 'number' || !Number.isFinite(budget.limit) || budget.limit <= 0 ||
        typeof budget.month !== 'string' || !/^\d{4}-\d{2}$/.test(budget.month)) {
      throw new Error('Há um orçamento com dados inválidos neste backup.')
    }
    return { id: budget.id, category: budget.category, limit: budget.limit, month: budget.month }
  })
  return {
    customExpenseCategories: [...new Set(categories.map((item) => (item as string).trim()))],
    wallets: parsedWallets.length ? parsedWallets : defaultExtras.wallets,
    goals: parsedGoals,
    budgets: parsedBudgets,
    dashboardCards: [...new Set(dashboardCards as string[])],
  }
}

const profileInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase() : (words[0]?.[0] ?? 'F').toUpperCase()
}

const decodeProfileImage = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível abrir a imagem selecionada.'))
    }
    image.src = url
  })
}

const resizeProfilePhoto = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem para a foto do perfil.')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('A foto deve ter no máximo 10 MB.')
  }

  const image = await decodeProfileImage(file)
  const imageWidth = 'naturalWidth' in image ? image.naturalWidth : image.width
  const imageHeight = 'naturalHeight' in image ? image.naturalHeight : image.height
  try {
    const scale = Math.min(1, 512 / Math.max(imageWidth, imageHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(imageWidth * scale))
    canvas.height = Math.max(1, Math.round(imageHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar a foto selecionada.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const photo = canvas.toDataURL('image/jpeg', 0.82)
    if (photo.length > 1024 * 1024) {
      throw new Error('Não foi possível reduzir a foto para o tamanho permitido. Escolha outra imagem.')
    }
    return photo
  } finally {
    if ('close' in image) image.close()
  }
}

const isDebtCategory = (value: unknown): value is DebtCategory =>
  typeof value === 'string' && Boolean(value.trim()) && value.length <= 40

const parseDebts = (value: unknown): Debt[] => {
  if (!Array.isArray(value)) throw new Error('Os dados das dívidas salvas não estão no formato esperado.')
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('Há uma dívida salva com dados inválidos.')
    const debt = item as Record<string, unknown>
    if (typeof debt.id !== 'string' || !isDebtCategory(debt.category) ||
        typeof debt.name !== 'string' || !debt.name.trim() ||
        typeof debt.amount !== 'number' || !Number.isFinite(debt.amount) || debt.amount <= 0 ||
        !isValidDateValue(debt.dueDate) ||
        typeof debt.notes !== 'string' || typeof debt.isPaid !== 'boolean' ||
        (debt.paidAt !== undefined && debt.paidAt !== null &&
          !isValidDateValue(debt.paidAt)) ||
        (debt.isRecurring !== undefined && typeof debt.isRecurring !== 'boolean') ||
        (debt.recurrenceGroupId !== undefined && debt.recurrenceGroupId !== null && typeof debt.recurrenceGroupId !== 'string') ||
        (debt.installmentAmount !== undefined && (typeof debt.installmentAmount !== 'number' || !Number.isFinite(debt.installmentAmount) || debt.installmentAmount <= 0)) ||
        (debt.installmentsTotal !== undefined && (typeof debt.installmentsTotal !== 'number' || !Number.isInteger(debt.installmentsTotal) || debt.installmentsTotal < 1)) ||
        (debt.installmentsPaid !== undefined && (typeof debt.installmentsPaid !== 'number' || !Number.isInteger(debt.installmentsPaid) || debt.installmentsPaid < 0 || (typeof debt.installmentsTotal === 'number' && debt.installmentsPaid > debt.installmentsTotal))) ||
        (debt.interestRateMonthly !== undefined && (typeof debt.interestRateMonthly !== 'number' || !Number.isFinite(debt.interestRateMonthly) || debt.interestRateMonthly < 0 || debt.interestRateMonthly > 100)) ||
        (debt.remainingBalance !== undefined && (typeof debt.remainingBalance !== 'number' || !Number.isFinite(debt.remainingBalance) || debt.remainingBalance < 0)) ||
        (debt.priority !== undefined && debt.priority !== 'low' && debt.priority !== 'normal' && debt.priority !== 'high') ||
        typeof debt.createdAt !== 'string') {
      throw new Error('Há uma dívida salva com dados inválidos.')
    }
    return {
      id: debt.id,
      category: debt.category,
      name: debt.name.trim(),
      amount: debt.amount,
      dueDate: debt.dueDate,
      notes: debt.notes,
      isPaid: debt.isPaid,
      paidAt: typeof debt.paidAt === 'string' ? debt.paidAt : null,
      isRecurring: debt.isRecurring === true,
      recurrenceGroupId: typeof debt.recurrenceGroupId === 'string' ? debt.recurrenceGroupId : null,
      installmentAmount: typeof debt.installmentAmount === 'number' ? debt.installmentAmount : undefined,
      installmentsTotal: typeof debt.installmentsTotal === 'number' ? debt.installmentsTotal : undefined,
      installmentsPaid: typeof debt.installmentsPaid === 'number' ? debt.installmentsPaid : undefined,
      interestRateMonthly: typeof debt.interestRateMonthly === 'number' ? debt.interestRateMonthly : undefined,
      priority: debt.priority === 'low' || debt.priority === 'high' ? debt.priority : 'normal',
      remainingBalance: typeof debt.remainingBalance === 'number' ? debt.remainingBalance : debt.amount,
      createdAt: debt.createdAt,
    }
  })
}

const formatDueDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(year, month - 1, day))
}

const emptyDebtDraft = (): DebtDraft => ({
  category: 'Cartão de crédito',
  name: '',
  amount: 0,
  dueDate: '',
  notes: '',
  isRecurring: false,
  priority: 'normal',
})
const localDateValue = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const currentMonthValue = (date = new Date()) => localDateValue(date).slice(0, 7)
const formatMovementDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(year, month - 1, day))
}
const isMovementKind = (value: unknown): value is MovementKind =>
  value === 'expense' || value === 'salary' || value === 'extra'
const isExpenseCategory = (value: string): value is Exclude<MovementCategory, 'Salário' | 'Renda extra'> =>
  expenseCategories.some(({ label }) => label === value)
const isValidMovementCategory = (kind: MovementKind, value: unknown): value is MovementCategory => {
  if (kind === 'expense') return typeof value === 'string' && Boolean(value.trim()) && value.length <= 40
  if (kind === 'salary') return value === 'Salário'
  return value === 'Renda extra'
}
const parseMovements = (value: unknown): Movement[] => {
  if (!Array.isArray(value)) throw new Error('Os lançamentos salvos não estão no formato esperado.')
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('Há um lançamento salvo com dados inválidos.')
    const movement = item as Record<string, unknown>
    const kind = movement.kind
    if (typeof movement.id !== 'string' || !isMovementKind(kind) ||
        !isValidMovementCategory(kind, movement.category) ||
        typeof movement.name !== 'string' || !movement.name.trim() ||
        typeof movement.amount !== 'number' || !Number.isFinite(movement.amount) || movement.amount <= 0 ||
        !isValidDateValue(movement.date) ||
        typeof movement.notes !== 'string' ||
        (movement.walletId !== undefined && movement.walletId !== null && typeof movement.walletId !== 'string') ||
        typeof movement.createdAt !== 'string') {
      throw new Error('Há um lançamento salvo com dados inválidos.')
    }
    return {
      id: movement.id,
      kind,
      category: movement.category,
      name: movement.name.trim(),
      amount: movement.amount,
      date: movement.date,
      notes: movement.notes,
      walletId: typeof movement.walletId === 'string' ? movement.walletId : null,
      createdAt: movement.createdAt,
    }
  })
}
const emptyMovementDraft = (kind: MovementKind = 'expense', walletId: string | null = null): MovementDraft => ({
  kind,
  category: kind === 'expense' ? 'Mercado' : kind === 'salary' ? 'Salário' : 'Renda extra',
  name: '',
  amount: 0,
  date: localDateValue(),
  notes: '',
  walletId,
})

function App() {
  const [activeSection, setActiveSection] = useState<Section>('inicio')
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [preferencesError, setPreferencesError] = useState('')
  const [profile, setProfile] = useState(defaultProfile)
  const [profileDraft, setProfileDraft] = useState(defaultProfile)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profilePhotoError, setProfilePhotoError] = useState('')
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)
  const [backupError, setBackupError] = useState('')
  const [backupStatus, setBackupStatus] = useState('')
  const [isProcessingBackup, setIsProcessingBackup] = useState(false)
  const backupInputRef = useRef<HTMLInputElement>(null)
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [debts, setDebts] = useState<Debt[]>([])
  const [debtsLoaded, setDebtsLoaded] = useState(false)
  const [debtsStorageAvailable, setDebtsStorageAvailable] = useState(true)
  const [debtsError, setDebtsError] = useState('')
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false)
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
  const [debtDraft, setDebtDraft] = useState<DebtDraft>(emptyDebtDraft)
  const [debtFormError, setDebtFormError] = useState('')
  const [debtFilter, setDebtFilter] = useState<'pending' | 'paid' | 'all'>('pending')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'expenses' | 'income' | 'debts'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [undoableEntries, setUndoableEntries] = useState<UndoableEntry[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [movementsLoaded, setMovementsLoaded] = useState(false)
  const [movementsStorageAvailable, setMovementsStorageAvailable] = useState(true)
  const [movementsError, setMovementsError] = useState('')
  const [extras, setExtras] = useState<AppExtras>(defaultExtras)
  const [extrasLoaded, setExtrasLoaded] = useState(false)
  const [extrasStorageAvailable, setExtrasStorageAvailable] = useState(true)
  const [extrasError, setExtrasError] = useState('')
  const [categoryDraft, setCategoryDraft] = useState('')
  const [goalDraft, setGoalDraft] = useState({ name: '', target: 0, saved: 0, deadline: '' })
  const [budgetDraft, setBudgetDraft] = useState({ category: '', limit: 0 })
  const [walletDraft, setWalletDraft] = useState({ name: '', kind: 'checking' as WalletAccount['kind'], openingBalance: 0 })
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(localDateValue())
  const statementInputRef = useRef<HTMLInputElement>(null)
  const [statementPreview, setStatementPreview] = useState<StatementEntry[]>([])
  const [statementSelection, setStatementSelection] = useState<boolean[]>([])
  const [statementError, setStatementError] = useState('')
  const [statementStatus, setStatementStatus] = useState('')
  const [isReadingStatement, setIsReadingStatement] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<'unsupported' | NotificationPermission>(() =>
    supportsNativeReminders() ? 'default' : typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const [movementFormError, setMovementFormError] = useState('')
  const [isMovementFormOpen, setIsMovementFormOpen] = useState(false)
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null)
  const [movementDraft, setMovementDraft] = useState<MovementDraft>(emptyMovementDraft)
  const [movementTab, setMovementTab] = useState<'expenses' | 'income'>('expenses')
  const [androidUpdate, setAndroidUpdate] = useState<AndroidUpdate | null>(null)
  const [isUpdatePromptOpen, setIsUpdatePromptOpen] = useState(false)
  const [installedAndroidAppVersion, setInstalledAndroidAppVersion] = useState('')
  const [installedAndroidAppVersionError, setInstalledAndroidAppVersionError] = useState('')
  const [isCheckingAndroidUpdate, setIsCheckingAndroidUpdate] = useState(isAndroidApp())
  const [isDownloadingAndroidUpdate, setIsDownloadingAndroidUpdate] = useState(false)
  const [hasDownloadedAndroidUpdate, setHasDownloadedAndroidUpdate] = useState(false)
  const [androidUpdateStatus, setAndroidUpdateStatus] = useState('')
  const [androidUpdateError, setAndroidUpdateError] = useState('')
  const dismissedUpdateVersion = useRef<string | null>(null)
  const lastReminderNotification = useRef('')

  useEffect(() => {
    if (!supportsNativeReminders()) return
    let active = true
    void getNativeReminderPermission().then((permission) => {
      if (active) setNotificationPermission(permission)
    }).catch((error: unknown) => {
      console.error('Não foi possível consultar a permissão de notificações do Android.', error)
      if (active) setExtrasError('Não foi possível consultar a permissão de notificações do Android.')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!debtsLoaded || !supportsNativeReminders()) return
    void scheduleDebtReminders(debts).catch((error: unknown) => {
      console.error('Não foi possível programar os lembretes de vencimento.', error)
      setExtrasError('Não foi possível programar os lembretes de vencimento no Android.')
    })
  }, [debts, debtsLoaded])

  useEffect(() => {
    if (!undoableEntries.length) return
    const expiresAt = Math.min(...undoableEntries.map((entry) => entry.expiresAt))
    const timeout = window.setTimeout(() => {
      setUndoableEntries((current) => current.filter((entry) => entry.expiresAt > Date.now()))
    }, Math.max(0, expiresAt - Date.now()))
    return () => window.clearTimeout(timeout)
  }, [undoableEntries])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (isPreferences(parsed)) {
          setPreferences({
            theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
            textSize: parsed.textSize === 'large' ? 'large' : 'normal',
            hideAmounts: parsed.hideAmounts === true,
            accent: parsed.accent === 'ocean' || parsed.accent === 'plum' ? parsed.accent : 'forest',
          })
        }
      }
    } catch (error) {
      console.error('Não foi possível carregar as preferências do GranaZen.', error)
      setPreferencesError('Não foi possível carregar suas preferências salvas.')
    } finally {
      setPreferencesLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!preferencesLoaded) return
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
      setPreferencesError('')
    } catch (error) {
      console.error('Não foi possível salvar as preferências do GranaZen.', error)
      setPreferencesError('Não foi possível salvar as preferências neste dispositivo.')
    }
  }, [preferences, preferencesLoaded])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY)
      if (saved) {
        const parsed = parseProfile(JSON.parse(saved) as unknown)
        setProfile(parsed)
        setProfileDraft(parsed)
      }
    } catch (error) {
      console.error('Não foi possível carregar o perfil do GranaZen.', error)
      setProfileError(error instanceof Error ? error.message : 'Não foi possível carregar o perfil salvo.')
    } finally {
      setProfileLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!profileLoaded) return
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
      setProfileError('')
    } catch (error) {
      console.error('Não foi possível salvar o perfil do GranaZen.', error)
      setProfileError('Não foi possível salvar o perfil neste dispositivo. Libere espaço e tente novamente.')
    }
  }, [profile, profileLoaded])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEBTS_KEY)
      if (saved) setDebts(parseDebts(JSON.parse(saved) as unknown))
    } catch (error) {
      console.error('Não foi possível carregar as dívidas do GranaZen.', error)
      setDebtsError('Não foi possível carregar as dívidas salvas. Os dados guardados foram mantidos.')
      setDebtsStorageAvailable(false)
    } finally {
      setDebtsLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!debtsLoaded || !debtsStorageAvailable) return
    try {
      localStorage.setItem(DEBTS_KEY, JSON.stringify(debts))
      setDebtsError('')
    } catch (error) {
      console.error('Não foi possível salvar as dívidas do GranaZen.', error)
      setDebtsError('Não foi possível salvar as dívidas neste dispositivo.')
    }
  }, [debts, debtsLoaded, debtsStorageAvailable])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MOVEMENTS_KEY)
      if (saved) setMovements(parseMovements(JSON.parse(saved) as unknown))
    } catch (error) {
      console.error('Não foi possível carregar as movimentações do GranaZen.', error)
      setMovementsError('Não foi possível carregar os lançamentos salvos. Os dados guardados foram mantidos.')
      setMovementsStorageAvailable(false)
    } finally {
      setMovementsLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!movementsLoaded || !movementsStorageAvailable) return
    try {
      localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements))
      setMovementsError('')
    } catch (error) {
      console.error('Não foi possível salvar as movimentações do GranaZen.', error)
      setMovementsError('Não foi possível salvar os lançamentos neste dispositivo.')
    }
  }, [movements, movementsLoaded, movementsStorageAvailable])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXTRAS_KEY)
      if (saved) setExtras(parseExtras(JSON.parse(saved) as unknown))
      setExtrasStorageAvailable(true)
    } catch (error) {
      console.error('Não foi possível carregar o planejamento financeiro.', error)
      setExtrasError(error instanceof Error ? error.message : 'Não foi possível carregar as configurações financeiras.')
      setExtrasStorageAvailable(false)
    } finally {
      setExtrasLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!extrasLoaded || !extrasStorageAvailable) return
    try {
      localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras))
      setExtrasError('')
    } catch (error) {
      console.error('Não foi possível salvar o planejamento financeiro.', error)
      setExtrasError('Não foi possível salvar categorias, carteiras e planejamento neste aparelho.')
      setExtrasStorageAvailable(false)
    }
  }, [extras, extrasLoaded, extrasStorageAvailable])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    mediaQuery.addEventListener('change', updateSystemTheme)
    return () => mediaQuery.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    if (!isAndroidApp()) return

    let disposed = false
    let lastCheck = 0
    void getInstalledAndroidAppVersion().then((version) => {
      if (!disposed) {
        setInstalledAndroidAppVersion(version)
        setInstalledAndroidAppVersionError('')
      }
    }).catch((error: unknown) => {
      console.error('Não foi possível identificar a versão instalada do GranaZen.', error)
      if (!disposed) {
        setInstalledAndroidAppVersion('')
        setInstalledAndroidAppVersionError('Não foi possível identificar a versão instalada.')
      }
    })

    const checkForUpdate = async (force = false) => {
      if (!force && Date.now() - lastCheck < 6 * 60 * 60 * 1000) return
      lastCheck = Date.now()
      setIsCheckingAndroidUpdate(true)
      try {
        const update = await checkForAndroidUpdate()
        if (disposed) return
        setAndroidUpdateError('')
        setAndroidUpdate(update)
        setHasDownloadedAndroidUpdate(false)
        setAndroidUpdateStatus(update ? '' : 'Você já está usando a versão mais recente.')
        setIsUpdatePromptOpen(Boolean(update && dismissedUpdateVersion.current !== update.version))
      } catch (error) {
        if (!disposed) setAndroidUpdateError(error instanceof Error ? error.message : 'Não foi possível verificar atualizações.')
      } finally {
        if (!disposed) setIsCheckingAndroidUpdate(false)
      }
    }

    void checkForUpdate(true)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const checkAndroidUpdateManually = async () => {
    setIsCheckingAndroidUpdate(true)
    setAndroidUpdateError('')
    try {
      const installedVersion = await getInstalledAndroidAppVersion()
      const update = await checkForAndroidUpdate()
      setInstalledAndroidAppVersion(installedVersion)
      setInstalledAndroidAppVersionError('')
      setAndroidUpdate(update)
      setHasDownloadedAndroidUpdate(false)
      setAndroidUpdateStatus('')
      setIsUpdatePromptOpen(Boolean(update))
      if (!update) setAndroidUpdateStatus('Você já está usando a versão mais recente.')
    } catch (error) {
      console.error('Não foi possível verificar atualizações do GranaZen.', error)
      setAndroidUpdateError(error instanceof Error ? error.message : 'Não foi possível verificar atualizações.')
    } finally {
      setIsCheckingAndroidUpdate(false)
    }
  }

  const installAndroidUpdate = async () => {
    if (!androidUpdate) return
    setIsDownloadingAndroidUpdate(true)
    setAndroidUpdateError('')
    setAndroidUpdateStatus('')
    try {
      if (!hasDownloadedAndroidUpdate) {
        await downloadAndroidUpdate(androidUpdate)
        setHasDownloadedAndroidUpdate(true)
      }

      const result = await installDownloadedAndroidUpdate()
      if (result.status === 'permission_required') {
        setAndroidUpdateStatus('Permita que o GranaZen instale apps nesta tela de configurações. Depois, volte e toque em “Instalar atualização”.')
      } else {
        setAndroidUpdateStatus('Confirme a atualização na tela do Android.')
        setIsUpdatePromptOpen(false)
      }
    } catch (error) {
      setAndroidUpdateError(error instanceof Error ? error.message : 'Não foi possível baixar ou iniciar a atualização.')
    } finally {
      setIsDownloadingAndroidUpdate(false)
    }
  }

  const updatePreferences = (changes: Partial<Preferences>) =>
    setPreferences((current) => ({ ...current, ...changes }))

  const addCustomExpenseCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const category = categoryDraft.trim()
    if (!category || category.length > 40 || allExpenseCategories.some((item) => item.toLocaleLowerCase('pt-BR') === category.toLocaleLowerCase('pt-BR'))) {
      setExtrasError('Digite uma categoria nova com até 40 caracteres.')
      return
    }
    if (extras.customExpenseCategories.length >= 50) {
      setExtrasError('Você já atingiu o limite de 50 categorias personalizadas.')
      return
    }
    setExtras((current) => ({ ...current, customExpenseCategories: [...current.customExpenseCategories, category] }))
    setCategoryDraft('')
    setExtrasError('')
  }

  const addGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = goalDraft.name.trim()
    if (!name || name.length > 60 || !Number.isFinite(goalDraft.target) || goalDraft.target <= 0 ||
        !Number.isFinite(goalDraft.saved) || goalDraft.saved < 0 ||
        (goalDraft.deadline && !isValidDateValue(goalDraft.deadline))) {
      setExtrasError('Confira nome, valor da meta, valor guardado e prazo.')
      return
    }
    setExtras((current) => ({
      ...current,
      goals: [...current.goals, { id: crypto.randomUUID(), ...goalDraft, name, createdAt: new Date().toISOString() }],
    }))
    setGoalDraft({ name: '', target: 0, saved: 0, deadline: '' })
    setExtrasError('')
  }

  const addBudget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!budgetDraft.category || !Number.isFinite(budgetDraft.limit) || budgetDraft.limit <= 0) {
      setExtrasError('Escolha uma categoria e informe um limite maior que zero.')
      return
    }
    setExtras((current) => ({
      ...current,
      budgets: [
        ...current.budgets.filter((budget) => !(budget.category === budgetDraft.category && budget.month === monthKey)),
        { id: crypto.randomUUID(), category: budgetDraft.category, limit: budgetDraft.limit, month: monthKey },
      ],
    }))
    setBudgetDraft({ category: '', limit: 0 })
    setExtrasError('')
  }

  const addWallet = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = walletDraft.name.trim()
    if (!name || name.length > 40 || extras.wallets.some((wallet) => wallet.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR')) ||
        !Number.isFinite(walletDraft.openingBalance) || extras.wallets.length >= 30) {
      setExtrasError('Confira o nome e o saldo inicial da carteira. Limite de 30 carteiras.')
      return
    }
    setExtras((current) => ({
      ...current,
      wallets: [...current.wallets, { id: crypto.randomUUID(), ...walletDraft, name }],
    }))
    setWalletDraft({ name: '', kind: 'checking', openingBalance: 0 })
    setExtrasError('')
  }

  const handleStatementFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setIsReadingStatement(true)
    setStatementError('')
    setStatementStatus('')
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('O extrato excede o limite de 10 MB.')
      let entries: StatementEntry[]
      if (file.name.toLocaleLowerCase('pt-BR').endsWith('.pdf')) {
        const { parsePdfStatementFile } = await import('./pdfStatementImport')
        entries = await parsePdfStatementFile(await file.arrayBuffer())
      } else {
        entries = parseStatementFile(file.name, await file.text())
      }
      if (entries.length > 1000) throw new Error('O arquivo tem mais de 1.000 lançamentos. Divida o extrato em arquivos menores.')
      const selection = selectNonDuplicateStatementEntries(entries, movements)
      setStatementPreview(entries)
      setStatementSelection(selection)
      if (!selection.some(Boolean)) {
        setStatementStatus('Todos os lançamentos deste arquivo já foram importados. Nenhum será adicionado novamente.')
      }
    } catch (error) {
      console.error('Não foi possível ler o extrato financeiro.', error)
      setStatementError(error instanceof Error ? error.message : 'Não foi possível ler este extrato.')
    } finally {
      setIsReadingStatement(false)
    }
  }

  const importSelectedStatementEntries = () => {
    const selected = statementPreview.filter((_, index) => statementSelection[index])
    if (!selected.length) {
      setStatementError('Selecione pelo menos um lançamento para importar.')
      return
    }
    const selection = selectNonDuplicateStatementEntries(selected, movements)
    const uniqueSelected = selected.filter((_, index) => selection[index])
    if (!uniqueSelected.length) {
      setStatementStatus('Nenhum lançamento novo foi importado. Os itens já constam em Movimentos.')
      setStatementPreview([])
      setStatementSelection([])
      setStatementError('')
      return
    }
    const walletId = extras.wallets[0]?.id ?? null
    const additions: Movement[] = uniqueSelected.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      walletId,
      createdAt: new Date().toISOString(),
    }))
    setMovements((current) => [...current, ...additions])
    setStatementPreview([])
    setStatementSelection([])
    setStatementError('')
    const skipped = selected.length - additions.length
    setStatementStatus(`${additions.length} lançamento${additions.length === 1 ? '' : 's'} importado${additions.length === 1 ? '' : 's'}${skipped ? ` · ${skipped} duplicado${skipped === 1 ? '' : 's'} ignorado${skipped === 1 ? '' : 's'}` : ''}. Confira os dados em Movimentos.`)
  }

  const toggleDashboardCard = (card: string) => {
    setExtras((current) => ({
      ...current,
      dashboardCards: current.dashboardCards.includes(card)
        ? current.dashboardCards.filter((item) => item !== card)
        : [...current.dashboardCards, card],
    }))
  }

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const updated = {
      ...profileDraft,
      name: profileDraft.name.trim(),
      email: profileDraft.email.trim(),
      phone: profileDraft.phone.trim(),
    }
    if (updated.name.length > 50 || updated.email.length > 100 || updated.phone.length > 24) {
      setProfileError('Confira os limites: nome até 50, e-mail até 100 e telefone até 24 caracteres.')
      return
    }
    if (updated.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.email)) {
      setProfileError('Digite um endereço de e-mail válido ou deixe o campo em branco.')
      return
    }
    setProfile(updated)
    setProfileError('')
  }

  const handleProfilePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProfilePhotoError('')
    try {
      const photo = await resizeProfilePhoto(file)
      setProfileDraft((current) => ({ ...current, photo }))
    } catch (error) {
      console.error('Não foi possível preparar a foto do perfil.', error)
      setProfilePhotoError(error instanceof Error ? error.message : 'Não foi possível carregar esta foto.')
    }
  }

  const exportBackup = async () => {
    setBackupError('')
    setBackupStatus('')
    if (!preferencesLoaded || !profileLoaded || !debtsLoaded || !movementsLoaded || !extrasLoaded ||
        !debtsStorageAvailable || !movementsStorageAvailable || !extrasStorageAvailable) {
      setBackupError('Carregue os dados salvos sem erros antes de criar um backup.')
      return
    }

    setIsProcessingBackup(true)
    try {
      const date = localDateValue()
      const content = JSON.stringify({
        app: 'GranaZen',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        preferences,
        profile,
        extras,
        debts,
        movements,
      }, null, 2)
      const saved = await saveBackupFile(content, `granazen-backup-${date}.json`)
      setBackupStatus(saved ? 'Backup salvo. Guarde o arquivo em um local seguro.' : 'Salvamento do backup cancelado.')
    } catch (error) {
      console.error('Não foi possível exportar os dados do GranaZen.', error)
      setBackupError(error instanceof Error ? error.message : 'Não foi possível criar o arquivo de backup.')
    } finally {
      setIsProcessingBackup(false)
    }
  }

  const importBackupContent = async (content: string) => {
    setBackupError('')
    setBackupStatus('')
    if (!preferencesLoaded || !profileLoaded || !debtsLoaded || !movementsLoaded || !extrasLoaded ||
        !debtsStorageAvailable || !movementsStorageAvailable) {
      setBackupError('Resolva os erros de armazenamento antes de importar um backup.')
      return
    }
    if (new TextEncoder().encode(content).byteLength > 20 * 1024 * 1024) {
      setBackupError('O arquivo de backup excede o tamanho permitido.')
      return
    }

    setIsProcessingBackup(true)
    try {
      const value: unknown = JSON.parse(content)
      if (typeof value !== 'object' || value === null) throw new Error('O arquivo não contém um backup válido do GranaZen.')
      const backup = value as Record<string, unknown>
      if (backup.app !== 'GranaZen' || ![1, 2, BACKUP_SCHEMA_VERSION].includes(Number(backup.schemaVersion)) ||
          !Array.isArray(backup.debts) || !Array.isArray(backup.movements)) {
        throw new Error('Este arquivo não é um backup compatível do GranaZen.')
      }

      const importedPreferences = parseBackupPreferences(backup.preferences)
      const importedProfile = backup.schemaVersion === 1 ? defaultProfile : parseProfile(backup.profile)
      const importedDebts = parseDebts(backup.debts)
      const importedMovements = parseMovements(backup.movements)
      const importedExtras = backup.schemaVersion === 3 ? parseExtras(backup.extras) : defaultExtras
      const importedIncome = importedMovements
        .filter((movement) => movement.kind !== 'expense')
        .reduce((total, movement) => total + movement.amount, 0)
      const importedExpenses = importedMovements
        .filter((movement) => movement.kind === 'expense')
        .reduce((total, movement) => total + movement.amount, 0)
      const exportDate = typeof backup.exportedAt === 'string' && Number.isFinite(Date.parse(backup.exportedAt))
        ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(backup.exportedAt))
        : 'data não informada'
      const confirmation = [
        `Backup exportado em ${exportDate}.`,
        `${importedDebts.length} dívidas e ${importedMovements.length} movimentações.`,
        `Ganhos: ${currency(importedIncome)} · Gastos: ${currency(importedExpenses)}.`,
        '',
        'Isso substituirá os dados atuais deste aparelho. Deseja continuar?',
      ].join('\n')
      if (!window.confirm(confirmation)) return

      const values = new Map<string, string>([
        [PREFERENCES_KEY, JSON.stringify(importedPreferences)],
        [PROFILE_KEY, JSON.stringify(importedProfile)],
        [DEBTS_KEY, JSON.stringify(importedDebts)],
        [MOVEMENTS_KEY, JSON.stringify(importedMovements)],
        [EXTRAS_KEY, JSON.stringify(importedExtras)],
      ])
      const previous = new Map([...values.keys()].map((key) => [key, localStorage.getItem(key)]))
      try {
        values.forEach((storedValue, key) => localStorage.setItem(key, storedValue))
      } catch (error) {
        try {
          previous.forEach((storedValue, key) => {
            if (storedValue === null) localStorage.removeItem(key)
            else localStorage.setItem(key, storedValue)
          })
        } catch (rollbackError) {
          console.error('Não foi possível restaurar os dados anteriores após a falha na importação.', rollbackError)
          throw new Error('A importação falhou e não foi possível restaurar todos os dados anteriores. Feche e reabra o app para conferir os dados.')
        }
        throw error
      }

      setPreferences(importedPreferences)
      setProfile(importedProfile)
      setProfileDraft(importedProfile)
      setDebts(importedDebts)
      setMovements(importedMovements)
      setExtras(importedExtras)
      setExtrasStorageAvailable(true)
      setUndoableEntries([])
      setDebtsStorageAvailable(true)
      setMovementsStorageAvailable(true)
      setPreferencesError('')
      setProfileError('')
      setDebtsError('')
      setMovementsError('')
      setBackupStatus('Backup importado com sucesso. Seus dados e configurações foram restaurados.')
    } catch (error) {
      console.error('Não foi possível importar o backup do GranaZen.', error)
      setBackupError(error instanceof Error ? error.message : 'Não foi possível importar este arquivo de backup.')
    } finally {
      setIsProcessingBackup(false)
    }
  }

  const handleBackupFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setBackupError('O arquivo de backup excede o tamanho permitido.')
      return
    }

    setIsProcessingBackup(true)
    try {
      await importBackupContent(await file.text())
    } catch (error) {
      console.error('Não foi possível ler o arquivo de backup.', error)
      setBackupError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo de backup.')
      setIsProcessingBackup(false)
    }
  }

  const selectBackupFile = async () => {
    if (!isAndroidApp()) {
      backupInputRef.current?.click()
      return
    }
    setBackupError('')
    setBackupStatus('')
    setIsProcessingBackup(true)
    try {
      const content = await pickBackupFile()
      if (content !== null) await importBackupContent(content)
      else setIsProcessingBackup(false)
    } catch (error) {
      console.error('Não foi possível selecionar o arquivo de backup.', error)
      setBackupError(error instanceof Error ? error.message : 'Não foi possível abrir o arquivo de backup.')
      setIsProcessingBackup(false)
    }
  }

  const isDarkTheme = preferences.theme === 'dark' || (preferences.theme === 'system' && systemPrefersDark)
  const displayCurrency = (value: number) => preferences.hideAmounts ? '••••••' : currency(value)
  const pendingDebts = debts.filter((debt) => !debt.isPaid)
  const pendingDebtTotal = pendingDebts.reduce((total, debt) => total + (debt.remainingBalance ?? debt.amount), 0)
  const monthKey = currentMonthValue()
  const currentMonthMovements = movements.filter((movement) => movement.date.startsWith(monthKey))
  const allExpenseCategories = [...expenseCategories.map(({ label }) => label), ...extras.customExpenseCategories]
  const currentMonthIncome = currentMonthMovements
    .filter((movement) => movement.kind !== 'expense')
    .reduce((total, movement) => total + movement.amount, 0)
  const currentMonthExpenses = currentMonthMovements
    .filter((movement) => movement.kind === 'expense')
    .reduce((total, movement) => total + movement.amount, 0)
  const availableThisMonth = currentMonthIncome - currentMonthExpenses
  const previousMonthDate = new Date()
  previousMonthDate.setDate(1)
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)
  const previousMonthKey = currentMonthValue(previousMonthDate)
  const previousMonthMovements = movements.filter((movement) => movement.date.startsWith(previousMonthKey))
  const previousMonthIncome = previousMonthMovements
    .filter((movement) => movement.kind !== 'expense')
    .reduce((total, movement) => total + movement.amount, 0)
  const previousMonthExpenses = previousMonthMovements
    .filter((movement) => movement.kind === 'expense')
    .reduce((total, movement) => total + movement.amount, 0)
  const monthEndDay = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate()
  const monthEndDate = `${monthKey}-${String(monthEndDay).padStart(2, '0')}`
  const unpaidDebtsThroughMonthEnd = pendingDebts
    .filter((debt) => debt.dueDate <= monthEndDate)
    .reduce((total, debt) => total + debt.amount, 0)
  const projectedMonthEndBalance = availableThisMonth - unpaidDebtsThroughMonthEnd
  const todayDate = localDateValue()
  const reminderEndDate = new Date()
  reminderEndDate.setDate(reminderEndDate.getDate() + 7)
  const reminderEndDateValue = localDateValue(reminderEndDate)
  const overdueDebts = pendingDebts.filter((debt) => debt.dueDate < todayDate)
  const upcomingDebts = pendingDebts
    .filter((debt) => debt.dueDate >= todayDate && debt.dueDate <= reminderEndDateValue)
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
  const reminderDebts = [...overdueDebts, ...upcomingDebts]
  const reminderNotificationKey = reminderDebts.map((debt) => `${debt.id}:${debt.dueDate}`).join('|')
  const currentMonthBudgets = extras.budgets.filter((budget) => budget.month === monthKey)
  const budgetSummaries = currentMonthBudgets.map((budget) => {
    const spent = currentMonthMovements
      .filter((movement) => movement.kind === 'expense' && movement.category === budget.category)
      .reduce((total, movement) => total + movement.amount, 0)
    return { ...budget, spent, ratio: spent / budget.limit }
  })
  const walletBalances = extras.wallets.map((wallet) => ({
    ...wallet,
    balance: wallet.openingBalance + movements
      .filter((movement) => movement.walletId === wallet.id ||
        (!movement.walletId && wallet.id === extras.wallets[0]?.id))
      .reduce((total, movement) => total + (movement.kind === 'expense' ? -movement.amount : movement.amount), 0),
  }))
  const calendarYear = calendarMonth.getFullYear()
  const calendarMonthIndex = calendarMonth.getMonth()
  const calendarMonthKey = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, '0')}`
  const calendarDays = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate()
  const calendarOffset = (new Date(calendarYear, calendarMonthIndex, 1).getDay() + 6) % 7
  const calendarEntries = [
    ...debts.filter((debt) => (debt.isPaid ? debt.paidAt ?? debt.dueDate : debt.dueDate).startsWith(calendarMonthKey)).map((debt) => ({
      id: `debt-${debt.id}`, date: debt.isPaid ? debt.paidAt ?? debt.dueDate : debt.dueDate, name: debt.name, amount: debt.amount,
      kind: debt.isPaid ? 'paid' as const : 'debt' as const,
    })),
    ...movements.filter((movement) => movement.date.startsWith(calendarMonthKey)).map((movement) => ({
      id: `movement-${movement.id}`, date: movement.date, name: movement.name, amount: movement.amount,
      kind: movement.kind === 'expense' ? 'expense' as const : 'income' as const,
    })),
  ].sort((first, second) => first.date.localeCompare(second.date))
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())
  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date())
  const visibleDebts = debts.filter((debt) =>
    debtFilter === 'all' || (debtFilter === 'paid' ? debt.isPaid : !debt.isPaid),
  ).filter((debt) => matchesSearch(searchQuery, debt.name, debt.category, debt.notes))
    .sort((first, second) => {
      const priorityRank = { high: 0, normal: 1, low: 2 }
      return priorityRank[first.priority ?? 'normal'] - priorityRank[second.priority ?? 'normal'] ||
        first.dueDate.localeCompare(second.dueDate)
    })
  const visibleMovements = movements.filter((movement) =>
    movementTab === 'expenses' ? movement.kind === 'expense' : movement.kind !== 'expense',
  ).filter((movement) => matchesSearch(searchQuery, movement.name, movement.category, movement.notes))
    .sort((first, second) => second.date.localeCompare(first.date) || second.createdAt.localeCompare(first.createdAt))
  const financialHistory = [
    ...movements.map((movement) => ({
      id: movement.id,
      sourceId: movement.id,
      date: movement.date,
      name: movement.name,
      category: movement.category,
      amount: movement.amount,
      kind: movement.kind === 'expense' ? 'expense' as const : 'income' as const,
      createdAt: movement.createdAt,
    })),
    ...debts.filter((debt) => debt.isPaid).map((debt) => ({
      id: debt.id,
      sourceId: debt.id,
      date: debt.paidAt ?? debt.dueDate,
      name: debt.name,
      category: `Dívida paga · ${debt.category}`,
      amount: debt.amount,
      kind: 'debt' as const,
      createdAt: debt.createdAt,
    })),
  ].sort((first, second) => second.date.localeCompare(first.date) || second.createdAt.localeCompare(first.createdAt))
  const visibleHistory = financialHistory.filter((entry) =>
    (historyFilter === 'all' ||
      (historyFilter === 'expenses' && entry.kind === 'expense') ||
      (historyFilter === 'income' && entry.kind === 'income') ||
      (historyFilter === 'debts' && entry.kind === 'debt')) &&
    matchesSearch(searchQuery, entry.name, entry.category),
  )
  const latestUndoableEntry = undoableEntries[undoableEntries.length - 1]
  const lifetimeIncome = movements.filter((movement) => movement.kind !== 'expense').reduce((total, movement) => total + movement.amount, 0)
  const lifetimeExpenses = movements.filter((movement) => movement.kind === 'expense').reduce((total, movement) => total + movement.amount, 0)
  const lifetimePaidDebts = debts.filter((debt) => debt.isPaid).reduce((total, debt) => total + debt.amount, 0)
  const recentMovements = [...currentMonthMovements]
    .sort((first, second) => second.date.localeCompare(first.date) || second.createdAt.localeCompare(first.createdAt))
    .slice(0, 4)
  const chartMaximum = Math.max(currentMonthIncome, currentMonthExpenses, pendingDebtTotal, 1)

  useEffect(() => {
    if (supportsNativeReminders() || notificationPermission !== 'granted' || !reminderDebts.length ||
        lastReminderNotification.current === reminderNotificationKey) return
    lastReminderNotification.current = reminderNotificationKey
    try {
      const overdueCount = overdueDebts.length
      new Notification('Lembretes do GranaZen', {
        body: overdueCount
          ? `Você tem ${overdueCount} conta${overdueCount === 1 ? '' : 's'} vencida${overdueCount === 1 ? '' : 's'} e ${upcomingDebts.length} próxima${upcomingDebts.length === 1 ? '' : 's'} do vencimento.`
          : `${upcomingDebts.length} conta${upcomingDebts.length === 1 ? '' : 's'} vence${upcomingDebts.length === 1 ? '' : 'm'} nos próximos sete dias.`,
        tag: 'granazen-upcoming-bills',
      })
    } catch (error) {
      console.error('Não foi possível exibir os lembretes do GranaZen.', error)
    }
  }, [notificationPermission, reminderNotificationKey])

  const requestReminderNotifications = async () => {
    if (supportsNativeReminders()) {
      try {
        const permission = await requestNativeReminderPermission()
        setNotificationPermission(permission)
        if (permission === 'granted') await scheduleDebtReminders(debts)
      } catch (error) {
        console.error('Não foi possível pedir permissão para notificações do Android.', error)
        setExtrasError('Não foi possível pedir permissão para notificações do Android.')
      }
      return
    }
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
      return
    }
    try {
      setNotificationPermission(await Notification.requestPermission())
    } catch (error) {
      console.error('Não foi possível solicitar permissão para notificações.', error)
      setExtrasError('O navegador não conseguiu solicitar permissão para notificações.')
    }
  }

  const openNewMovementForm = (kind: MovementKind) => {
    setEditingMovementId(null)
    setMovementDraft(emptyMovementDraft(kind, extras.wallets[0]?.id ?? null))
    setMovementFormError('')
    setIsMovementFormOpen(true)
  }

  const openEditMovementForm = (movement: Movement) => {
    setEditingMovementId(movement.id)
    setMovementDraft({
      kind: movement.kind,
      category: movement.category,
      name: movement.name,
      amount: movement.amount,
      date: movement.date,
      notes: movement.notes,
      walletId: movement.walletId ?? null,
    })
    setMovementFormError('')
    setIsMovementFormOpen(true)
  }

  const saveMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = movementDraft.name.trim()
    const categoryMatchesKind = movementDraft.kind === 'expense'
      ? allExpenseCategories.includes(movementDraft.category)
      : incomeCategories.some(({ label }) => label === movementDraft.category) &&
        ((movementDraft.kind === 'salary' && movementDraft.category === 'Salário') ||
          (movementDraft.kind === 'extra' && movementDraft.category === 'Renda extra'))
    if (!categoryMatchesKind) {
      setMovementFormError('Escolha uma categoria compatível com o tipo de lançamento.')
      return
    }
    if (!name) {
      setMovementFormError(movementDraft.kind === 'expense'
        ? 'Descreva o gasto, por exemplo “Almoço” ou “Pedido online”.'
        : 'Informe quem pagou ou a origem do valor recebido.')
      return
    }
    if (!Number.isFinite(movementDraft.amount) || movementDraft.amount <= 0) {
      setMovementFormError('Informe um valor maior que zero.')
      return
    }
    if (!isValidDateValue(movementDraft.date)) {
      setMovementFormError('Informe uma data válida para o lançamento.')
      return
    }

    if (editingMovementId) {
      setMovements((current) => current.map((movement) => movement.id === editingMovementId
        ? { ...movement, ...movementDraft, name, notes: movementDraft.notes.trim() }
        : movement))
    } else {
      setMovements((current) => [...current, {
        ...movementDraft,
        id: crypto.randomUUID(),
        name,
        notes: movementDraft.notes.trim(),
        createdAt: new Date().toISOString(),
      }])
    }
    setIsMovementFormOpen(false)
  }

  const deleteMovement = (id: string, fromHistory = false) => {
    const movement = movements.find((item) => item.id === id)
    if (!movement) return
    setMovements((current) => current.filter((item) => item.id !== id))
    setUndoableEntries((current) => [...current, {
      id: crypto.randomUUID(),
      kind: 'movement',
      item: movement,
      label: fromHistory ? `“${movement.name}” removido do histórico` : `“${movement.name}” excluído`,
      expiresAt: Date.now() + 8000,
    }])
  }

  const renderMonthlyChart = () => {
    const chartItems = [
      { id: 'income', label: 'Ganhos no mês', amount: currentMonthIncome, className: 'chart-income' },
      { id: 'expenses', label: 'Gastos no mês', amount: currentMonthExpenses, className: 'chart-expenses' },
      { id: 'debts', label: 'Dívidas em aberto', amount: pendingDebtTotal, className: 'chart-debts' },
    ]
    return (
      <section className="panel chart-panel" aria-labelledby="monthly-chart-title">
        <div className="panel-heading">
          <div><span className="eyebrow">SEU DINHEIRO EM PERSPECTIVA</span><h2 id="monthly-chart-title">Resumo financeiro</h2></div>
          <span className="chart-period"><CalendarDays size={14} /> {monthLabel}</span>
        </div>
        <p className="chart-description">Ganhos e gastos do mês comparados ao total das dívidas que ainda estão em aberto.</p>
        <div className="chart-bars" role="list" aria-label="Comparação de ganhos, gastos e dívidas">
          {chartItems.map(({ id, label, amount, className }) => {
            const percentage = amount > 0 ? Math.max((amount / chartMaximum) * 100, 2) : 0
            return (
              <div className={`chart-row ${className}`} role="listitem" key={id}>
                <div className="chart-row-heading"><span>{label}</span><strong>{displayCurrency(amount)}</strong></div>
                <div className="chart-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={chartMaximum} aria-valuenow={amount}>
                  <span style={{ width: `${percentage}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="chart-legend"><span><i className="legend-income" /> Receitas registradas</span><span><i className="legend-expenses" /> Gastos registrados</span><span><i className="legend-debts" /> Saldo das dívidas</span></div>
      </section>
    )
  }

  const renderMovements = () => (
    <div className="movements-manager">
      <section className="movement-summary-grid">
        <article className="movement-summary income-summary"><span><ArrowDownLeft size={17} /> Ganhos em {monthLabel}</span><strong>{displayCurrency(currentMonthIncome)}</strong><small>{currentMonthMovements.filter((item) => item.kind !== 'expense').length} valores recebidos</small></article>
        <article className="movement-summary expense-summary"><span><ArrowUpRight size={17} /> Gastos em {monthLabel}</span><strong>{displayCurrency(currentMonthExpenses)}</strong><small>{currentMonthMovements.filter((item) => item.kind === 'expense').length} gastos registrados</small></article>
      </section>
      <section className="panel movements-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">LANÇAMENTOS RÁPIDOS</span><h2>{movementTab === 'expenses' ? 'Meus gastos' : 'Valores recebidos'}</h2></div>
          <button className="primary-button movement-add-button" type="button" onClick={() => openNewMovementForm(movementTab === 'expenses' ? 'expense' : 'extra')}><Plus size={17} /> {movementTab === 'expenses' ? 'Novo gasto' : 'Novo recebimento'}</button>
        </div>
        <div className="movement-tabs" role="group" aria-label="Tipo de movimentação">
          <button type="button" className={movementTab === 'expenses' ? 'movement-tab active' : 'movement-tab'} aria-pressed={movementTab === 'expenses'} onClick={() => setMovementTab('expenses')}><ArrowUpRight size={16} /> Gastos</button>
          <button type="button" className={movementTab === 'income' ? 'movement-tab active' : 'movement-tab'} aria-pressed={movementTab === 'income'} onClick={() => setMovementTab('income')}><ArrowDownLeft size={16} /> Ganhos</button>
        </div>
        {renderSearch(movementTab === 'expenses' ? 'Buscar gastos' : 'Buscar recebimentos')}
        <div className="quick-add-row">
          {movementTab === 'expenses' ? (
            <button type="button" className="quick-add-card" onClick={() => openNewMovementForm('expense')}><span className="quick-add-icon expense-quick"><Plus size={17} /></span><span><strong>Gasto rápido</strong><small>Mercado, comida, jogos e mais</small></span><ChevronRight size={17} /></button>
          ) : (
            <>
              <button type="button" className="quick-add-card" onClick={() => openNewMovementForm('salary')}><span className="quick-add-icon salary-quick"><BriefcaseBusiness size={17} /></span><span><strong>Salário recebido</strong><small>Registre o valor deste mês</small></span><ChevronRight size={17} /></button>
              <button type="button" className="quick-add-card" onClick={() => openNewMovementForm('extra')}><span className="quick-add-icon extra-quick"><Gift size={17} /></span><span><strong>Valor por fora</strong><small>Freelance, venda ou outro</small></span><ChevronRight size={17} /></button>
            </>
          )}
        </div>
        {movementsError && <p className="movement-error" role="alert">{movementsError}</p>}
        {!visibleMovements.length ? (
          <div className="movement-empty-state">
            <span>{movementTab === 'expenses' ? <ShoppingBasket size={22} /> : <Banknote size={22} />}</span>
            <strong>{searchQuery ? 'Nenhum lançamento encontrado' : movementTab === 'expenses' ? 'Nenhum gasto registrado ainda' : 'Nenhum valor recebido registrado'}</strong>
            <p>{searchQuery ? 'Tente buscar por outro nome ou categoria.' : movementTab === 'expenses' ? 'Anote uma compra assim que fizer e acompanhe o total gasto no mês.' : 'Registre seu salário do mês e qualquer dinheiro recebido por fora.'}</p>
            {!searchQuery && <button className="text-button" type="button" onClick={() => openNewMovementForm(movementTab === 'expenses' ? 'expense' : 'extra')}><Plus size={16} /> Adicionar agora</button>}
          </div>
        ) : (
          <div className="movement-list">
            {visibleMovements.map((movement) => {
              const categories = movement.kind === 'expense' ? expenseCategories : incomeCategories
              const category = categories.find(({ label }) => label === movement.category)
              const Icon = category?.icon ?? Tag
              return (
                <article className={`movement-row${movement.kind === 'expense' ? ' is-expense' : ' is-income'}`} key={movement.id}>
                  <span className="movement-icon"><Icon size={18} /></span>
                  <span className="movement-copy">
                    <strong>{movement.name}</strong>
                    <small><span className="movement-category-tag">{movement.category}</span> · {formatMovementDate(movement.date)}</small>
                    {movement.notes && <small className="movement-note">{movement.notes}</small>}
                  </span>
                  <strong className="movement-amount">{movement.kind === 'expense' ? '−' : '+'} {displayCurrency(movement.amount)}</strong>
                  <span className="movement-actions">
                    <button className="debt-action" type="button" onClick={() => openEditMovementForm(movement)} aria-label={`Editar ${movement.name}`} title="Editar"><Pencil size={14} /></button>
                    <button className="debt-action delete-action" type="button" onClick={() => deleteMovement(movement.id)} aria-label={`Excluir ${movement.name}`} title="Excluir"><Trash2 size={14} /></button>
                  </span>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )

  const renderHistory = () => (
    <div className="history-manager">
      <section className="history-summary-grid">
        <article className="history-summary income-summary"><span><ArrowDownLeft size={17} /> Ganhos registrados</span><strong>{displayCurrency(lifetimeIncome)}</strong></article>
        <article className="history-summary expense-summary"><span><ArrowUpRight size={17} /> Gastos registrados</span><strong>{displayCurrency(lifetimeExpenses)}</strong></article>
        <article className="history-summary debt-history-summary"><span><Check size={17} /> Dívidas pagas</span><strong>{displayCurrency(lifetimePaidDebts)}</strong></article>
      </section>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">SUA JORNADA FINANCEIRA</span><h2>Histórico completo</h2></div>
          <span className="history-entry-count">{financialHistory.length} {financialHistory.length === 1 ? 'registro' : 'registros'}</span>
        </div>
        <p className="history-intro">Consulte seus gastos, recebimentos e dívidas que você marcou como pagas, de todos os períodos.</p>
        <div className="history-filters" role="group" aria-label="Filtrar histórico financeiro">
          {([
            ['all', 'Tudo'],
            ['expenses', 'Gastos'],
            ['income', 'Ganhos'],
            ['debts', 'Dívidas pagas'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={historyFilter === id ? 'history-filter active' : 'history-filter'} aria-pressed={historyFilter === id} onClick={() => setHistoryFilter(id)}>{label}</button>
          ))}
        </div>
        {renderSearch('Buscar no histórico financeiro')}
        {!visibleHistory.length ? (
          <div className="history-empty-state">
            <span><History size={22} /></span>
            <strong>{searchQuery ? 'Nenhum registro encontrado' : financialHistory.length ? 'Nenhum registro neste filtro' : 'Seu histórico começa aqui'}</strong>
            <p>{searchQuery ? 'Tente buscar por outro nome ou categoria.' : financialHistory.length ? 'Escolha outro filtro para consultar seus registros.' : 'Gastos, recebimentos e dívidas pagas aparecerão aqui conforme você usar o app.'}</p>
          </div>
        ) : (
          <div className="history-list">
            {visibleHistory.map((entry) => {
              const isExpense = entry.kind !== 'income'
              const icon = entry.kind === 'debt' ? <Check size={17} /> : entry.kind === 'expense' ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />
              return (
                <article className={`history-row history-${entry.kind}`} key={`${entry.kind}-${entry.id}`}>
                  <span className="history-icon">{icon}</span>
                  <span className="history-copy">
                    <strong>{entry.name}</strong>
                    <small>{entry.category} · {formatDueDate(entry.date)}</small>
                  </span>
                  <strong className={isExpense ? 'amount-negative' : 'amount-positive'}>{isExpense ? '−' : '+'} {displayCurrency(entry.amount)}</strong>
                  <button
                    className="debt-action delete-action history-delete-action"
                    type="button"
                    aria-label={`Excluir ${entry.name} do histórico`}
                    title="Excluir do histórico"
                    onClick={() => entry.kind === 'debt' ? deleteDebt(entry.sourceId, true) : deleteMovement(entry.sourceId, true)}
                  ><Trash2 size={14} /></button>
                </article>
              )
            })}
          </div>
        )}
      </section>
      {debtsError && <p className="debt-error" role="alert">{debtsError}</p>}
      {movementsError && <p className="movement-error" role="alert">{movementsError}</p>}
    </div>
  )

  const renderCalendar = () => {
    const displayedMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(calendarMonth)
    const entriesForSelectedDay = calendarEntries.filter((entry) => entry.date === selectedCalendarDay)
    const changeCalendarMonth = (offset: number) => {
      const nextMonth = new Date(calendarYear, calendarMonthIndex + offset, 1)
      const day = Math.min(Number(selectedCalendarDay.slice(8, 10)), new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate())
      setCalendarMonth(nextMonth)
      setSelectedCalendarDay(`${currentMonthValue(nextMonth)}-${String(day).padStart(2, '0')}`)
    }
    return (
      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">CONTAS E MOVIMENTAÇÕES</span><h2>{displayedMonth}</h2></div>
            <div className="calendar-controls">
              <button type="button" className="secondary-button" onClick={() => changeCalendarMonth(-1)} aria-label="Mês anterior">‹</button>
              <button type="button" className="secondary-button" onClick={() => { setCalendarMonth(new Date()); setSelectedCalendarDay(localDateValue()) }}>Hoje</button>
              <button type="button" className="secondary-button" onClick={() => changeCalendarMonth(1)} aria-label="Próximo mês">›</button>
            </div>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid" role="grid" aria-label={`Calendário de ${displayedMonth}`}>
            {Array.from({ length: calendarOffset }, (_, index) => <span className="calendar-day empty" key={`empty-${index}`} />)}
            {Array.from({ length: calendarDays }, (_, index) => {
              const day = index + 1
              const date = `${calendarMonthKey}-${String(day).padStart(2, '0')}`
              const dayEntries = calendarEntries.filter((entry) => entry.date === date)
              return <button type="button" role="gridcell" key={date} className={`calendar-day${date === selectedCalendarDay ? ' selected' : ''}${date === todayDate ? ' today' : ''}`} aria-label={`${day} ${displayedMonth}${dayEntries.length ? `, ${dayEntries.length} lançamentos` : ''}`} aria-selected={date === selectedCalendarDay} onClick={() => setSelectedCalendarDay(date)}><span>{day}</span><span className="calendar-markers" aria-hidden="true">{dayEntries.slice(0, 3).map((entry) => <i className={entry.kind === 'income' ? 'income' : ''} key={entry.id} />)}</span></button>
            })}
          </div>
          <div className="calendar-legend"><span><i className="legend-expenses" /> Contas e gastos</span><span><i className="legend-income" /> Recebimentos</span></div>
        </section>
        <section className="panel calendar-day-panel">
          <div className="panel-heading"><div><span className="eyebrow">DETALHES DO DIA</span><h2>{new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date(`${selectedCalendarDay}T12:00:00`))}</h2></div></div>
          {!entriesForSelectedDay.length ? <div className="history-empty-state"><span><CalendarDays size={21} /></span><strong>Nenhum lançamento neste dia</strong><p>Contas e movimentações cadastradas nesta data aparecerão aqui.</p></div> : (
            <div className="entry-list">{entriesForSelectedDay.map((entry) => <div className="entry-row" key={entry.id}><span className="entry-copy"><strong>{entry.name}</strong><small>{entry.kind === 'debt' ? 'Conta a pagar' : entry.kind === 'paid' ? 'Conta paga' : entry.kind === 'expense' ? 'Gasto' : 'Recebimento'}</small></span><strong className={entry.kind === 'income' ? 'amount-positive' : 'amount-negative'}>{displayCurrency(entry.amount)}</strong></div>)}</div>
          )}
        </section>
      </div>
    )
  }

  const openNewDebtForm = () => {
    setEditingDebtId(null)
    setDebtDraft(emptyDebtDraft())
    setDebtFormError('')
    setIsDebtFormOpen(true)
  }

  const openEditDebtForm = (debt: Debt) => {
    setEditingDebtId(debt.id)
    setDebtDraft({
      category: debt.category,
      name: debt.name,
      amount: debt.amount,
      dueDate: debt.dueDate,
      notes: debt.notes,
      isRecurring: debt.isRecurring,
      installmentAmount: debt.installmentAmount,
      installmentsTotal: debt.installmentsTotal,
      installmentsPaid: debt.installmentsPaid,
      interestRateMonthly: debt.interestRateMonthly,
      priority: debt.priority ?? 'normal',
    })
    setDebtFormError('')
    setIsDebtFormOpen(true)
  }

  const saveDebt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = debtDraft.name.trim()
    if (!name) {
      setDebtFormError('Digite uma identificação, como “Cartão Nubank”.')
      return
    }
    if (!Number.isFinite(debtDraft.amount) || debtDraft.amount <= 0) {
      setDebtFormError('Informe um valor maior que zero.')
      return
    }
    if (!isValidDateValue(debtDraft.dueDate)) {
      setDebtFormError('Informe uma data de vencimento válida.')
      return
    }
    if (debtDraft.interestRateMonthly !== undefined &&
        (!Number.isFinite(debtDraft.interestRateMonthly) || debtDraft.interestRateMonthly < 0 || debtDraft.interestRateMonthly > 100)) {
      setDebtFormError('Informe uma taxa mensal entre 0% e 100%.')
      return
    }
    if (debtDraft.installmentsTotal !== undefined &&
        (!Number.isInteger(debtDraft.installmentsTotal) || debtDraft.installmentsTotal < 1 ||
          (debtDraft.installmentsPaid ?? 0) > debtDraft.installmentsTotal)) {
      setDebtFormError('Confira a quantidade e o número de parcelas já pagas.')
      return
    }
    if (debtDraft.installmentAmount !== undefined &&
        (!Number.isFinite(debtDraft.installmentAmount) || debtDraft.installmentAmount <= 0)) {
      setDebtFormError('O valor da parcela deve ser maior que zero.')
      return
    }

    if (editingDebtId) {
      setDebts((current) => current.map((debt) => debt.id === editingDebtId
        ? {
            ...debt,
            ...debtDraft,
            name,
            notes: debtDraft.notes.trim(),
            remainingBalance: debtDraft.amount,
            recurrenceGroupId: debtDraft.isRecurring ? debt.recurrenceGroupId ?? crypto.randomUUID() : null,
          }
        : debt))
    } else {
      setDebts((current) => [...current, {
        ...debtDraft,
        id: crypto.randomUUID(),
        name,
        notes: debtDraft.notes.trim(),
        isPaid: false,
        paidAt: null,
        recurrenceGroupId: debtDraft.isRecurring ? crypto.randomUUID() : null,
        remainingBalance: debtDraft.amount,
        createdAt: new Date().toISOString(),
      }])
    }
    setIsDebtFormOpen(false)
  }

  const toggleDebtPaid = (id: string) => {
    const debt = debts.find((item) => item.id === id)
    if (!debt) return
    if (debt.isPaid) {
      setDebts((current) => current.map((item) => item.id === id
        ? { ...item, isPaid: false, paidAt: null, remainingBalance: item.amount, installmentsPaid: item.installmentsTotal ? 0 : item.installmentsPaid }
        : item))
      return
    }

    const recurrenceGroupId = debt.recurrenceGroupId ?? (debt.isRecurring ? debt.id : null)
    if (debt.installmentsTotal) {
      const currentBalance = debt.remainingBalance ?? debt.amount
      const installmentsPaid = Math.min(debt.installmentsTotal, (debt.installmentsPaid ?? 0) + 1)
      const interest = currentBalance * (debt.interestRateMonthly ?? 0) / 100
      const balanceAfterInterest = currentBalance + interest
      const regularPayment = debt.installmentAmount ?? debt.amount / debt.installmentsTotal
      const payment = installmentsPaid >= debt.installmentsTotal
        ? balanceAfterInterest
        : Math.min(balanceAfterInterest, regularPayment)
      const remaining = Math.max(0, balanceAfterInterest - payment)
      const isPaid = remaining === 0
      setDebts((current) => current.map((item) => item.id === id
        ? { ...item, remainingBalance: remaining, installmentsPaid, isPaid, paidAt: isPaid ? localDateValue() : null, dueDate: isPaid ? item.dueDate : nextRecurringDueDate(item.dueDate) }
        : item))
      setMovements((current) => [...current, {
        id: crypto.randomUUID(),
        kind: 'expense',
        category: 'Outros',
        name: `Parcela ${installmentsPaid}/${debt.installmentsTotal} · ${debt.name}`,
        amount: payment,
        date: localDateValue(),
        notes: `Pagamento de parcela registrado${interest ? ` · ${currency(interest)} de juros do período incluídos no saldo` : ''}.`,
        walletId: extras.wallets[0]?.id ?? null,
        createdAt: new Date().toISOString(),
      }])
      return
    }

    const paidDebt = { ...debt, isPaid: true, paidAt: localDateValue(), recurrenceGroupId }
    const updated = debts.map((item) => item.id === id ? paidDebt : item)
    if (!debt.isRecurring || !recurrenceGroupId || debts.some((item) =>
      item.id !== id && item.recurrenceGroupId === recurrenceGroupId && !item.isPaid && item.dueDate > debt.dueDate,
    )) {
      setDebts(updated)
      return
    }
    setDebts([...updated, {
      ...debt,
      id: crypto.randomUUID(),
      dueDate: nextRecurringDueDate(debt.dueDate),
      isPaid: false,
      paidAt: null,
      recurrenceGroupId,
      createdAt: new Date().toISOString(),
    }])
  }

  const deleteDebt = (id: string, fromHistory = false) => {
    const debt = debts.find((item) => item.id === id)
    if (!debt) return
    setDebts((current) => current.filter((item) => item.id !== id))
    setUndoableEntries((current) => [...current, {
      id: crypto.randomUUID(),
      kind: 'debt',
      item: debt,
      label: fromHistory ? `“${debt.name}” removida do histórico` : `“${debt.name}” excluída`,
      expiresAt: Date.now() + 8000,
    }])
  }

  const undoLatestDeletion = () => {
    const latest = undoableEntries[undoableEntries.length - 1]
    if (!latest || latest.expiresAt <= Date.now()) return
    if (latest.kind === 'debt') {
      setDebts((current) => current.some((item) => item.id === latest.item.id) ? current : [...current, latest.item])
    } else {
      setMovements((current) => current.some((item) => item.id === latest.item.id) ? current : [...current, latest.item])
    }
    setUndoableEntries((current) => current.filter((entry) => entry.id !== latest.id))
  }

  const renderDebts = () => (
    <div className="debt-manager">
      <section className="debt-summary">
        <div className="debt-summary-icon"><Wallet size={21} /></div>
        <span><small>Total em aberto</small><strong>{displayCurrency(pendingDebtTotal)}</strong></span>
        <span className="debt-summary-count">{pendingDebts.length} {pendingDebts.length === 1 ? 'dívida em aberto' : 'dívidas em aberto'}</span>
      </section>
      <section className="panel debts-panel">
        <div className="panel-heading debts-heading">
          <div>
            <span className="eyebrow">ORGANIZAÇÃO FINANCEIRA</span>
            <h2>Suas dívidas</h2>
          </div>
          <button className="primary-button debt-add-button" type="button" onClick={openNewDebtForm}><Plus size={17} /> Adicionar</button>
        </div>
        <p className="debts-intro">Use um tipo como etiqueta e escolha um nome fácil de reconhecer, como “Cartão Nubank”.</p>
        <div className="debt-filters" role="group" aria-label="Filtrar dívidas">
          {([
            ['pending', 'Em aberto'],
            ['paid', 'Pagas'],
            ['all', 'Todas'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={debtFilter === id ? 'debt-filter active' : 'debt-filter'} aria-pressed={debtFilter === id} onClick={() => setDebtFilter(id)}>{label}</button>
          ))}
        </div>
        {renderSearch('Buscar dívidas por nome, categoria ou observação')}
        {debtsError && <p className="debt-error" role="alert">{debtsError}</p>}
        {!visibleDebts.length ? (
          <div className="debt-empty-state">
            <span><Tag size={23} /></span>
            <strong>{searchQuery ? 'Nenhuma dívida encontrada' : debtFilter === 'paid' ? 'Nenhuma dívida paga por enquanto' : debtFilter === 'all' ? 'Seu controle começa aqui' : 'Nenhuma dívida em aberto'}</strong>
            <p>{searchQuery ? 'Tente buscar por outro nome ou categoria.' : debtFilter === 'paid' ? 'Quando marcar uma dívida como paga, ela aparecerá aqui.' : 'Adicione uma conta ou dívida para acompanhar o valor e o vencimento.'}</p>
            {!searchQuery && debtFilter !== 'paid' && <button className="primary-button" type="button" onClick={openNewDebtForm}><Plus size={17} /> Adicionar dívida</button>}
          </div>
        ) : (
          <div className="debt-list">
            {visibleDebts.map((debt) => {
              const categoryIndex = debtCategories.findIndex(({ label }) => label === debt.category)
              const category = debtCategories[categoryIndex] ?? debtCategories[debtCategories.length - 1]
              const Icon = category.icon
              return (
                <article className={`debt-card${debt.isPaid ? ' is-paid' : ''}`} key={debt.id}>
                  <span className={`debt-card-icon debt-color-${categoryIndex % 5}`}><Icon size={20} /></span>
                  <div className="debt-card-main">
                    <div className="debt-card-title"><strong>{debt.name}</strong><span className={debt.isPaid ? 'debt-tag paid-tag' : 'debt-tag'}>{debt.category}</span></div>
                    {debt.notes && <p className="debt-card-notes">{debt.notes}</p>}
                    <small className="debt-due-date">{debt.isPaid ? 'Paga' : 'Vence'} · {formatDueDate(debt.isPaid ? debt.paidAt ?? debt.dueDate : debt.dueDate)}{debt.priority === 'high' ? ' · Prioridade alta' : ''}</small>
                    {debt.installmentsTotal && <small className="debt-due-date">Parcela {debt.installmentsPaid ?? 0}/{debt.installmentsTotal} · {currency(debt.installmentAmount ?? debt.amount / debt.installmentsTotal)}{debt.interestRateMonthly ? ` · ${debt.interestRateMonthly}% a.m.` : ''}</small>}
                    {debt.isRecurring && <span className="debt-recurring-label">Mensal</span>}
                  </div>
                  <div className="debt-card-end">
                    <strong>{displayCurrency(debt.isPaid ? debt.amount : debt.remainingBalance ?? debt.amount)}</strong>
                    <div className="debt-actions">
                      <button type="button" className={debt.isPaid ? 'debt-action paid-action' : 'debt-action'} onClick={() => toggleDebtPaid(debt.id)} aria-label={debt.isPaid ? `Reabrir ${debt.name}` : debt.installmentsTotal ? `Registrar parcela de ${debt.name}` : `Marcar ${debt.name} como paga`} title={debt.isPaid ? 'Reabrir' : debt.installmentsTotal ? 'Registrar pagamento de parcela' : 'Marcar como paga'}><Check size={16} /></button>
                      <button type="button" className="debt-action" onClick={() => openEditDebtForm(debt)} aria-label={`Editar ${debt.name}`} title="Editar"><Pencil size={15} /></button>
                      <button type="button" className="debt-action delete-action" onClick={() => deleteDebt(debt.id)} aria-label={`Excluir ${debt.name}`} title="Excluir"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )

  const renderPreferences = () => (
    <div className="preferences-layout">
      <details className="settings-group">
        <summary><span><strong>Perfil e aparência</strong><small>Dados pessoais, tema, cores e acessibilidade</small></span><ChevronRight size={17} aria-hidden="true" /></summary>
        <div className="settings-group-content">
      <section className="panel preferences-card profile-card">
        <div className="preferences-card-heading">
          <span className="eyebrow">SEU PERFIL</span>
          <h2>Informações pessoais</h2>
          <p>Adicione uma foto e seus dados para personalizar o GranaZen neste aparelho.</p>
        </div>
        <form className="profile-form" onSubmit={saveProfile}>
          <div className="profile-photo-editor">
            <span className="profile-photo-preview">
              {profileDraft.photo
                ? <img src={profileDraft.photo} alt="Foto do perfil" />
                : profileDraft.name.trim()
                  ? profileInitials(profileDraft.name)
                  : <UserRound size={28} />}
            </span>
            <span className="profile-photo-actions">
              <button className="secondary-button" type="button" onClick={() => profilePhotoInputRef.current?.click()}><Upload size={15} /> Escolher foto</button>
              {profileDraft.photo && <button className="profile-remove-photo" type="button" onClick={() => setProfileDraft((current) => ({ ...current, photo: '' }))}>Remover foto</button>}
              <small>JPG, PNG ou outra imagem · até 10 MB</small>
            </span>
            <input ref={profilePhotoInputRef} className="backup-file-input" type="file" accept="image/*" onChange={(event) => void handleProfilePhotoChange(event)} />
          </div>
          {profilePhotoError && <p className="preferences-error" role="alert">{profilePhotoError}</p>}
          <div className="profile-fields">
            <label>Nome
              <input autoComplete="name" maxLength={50} placeholder="Como quer ser chamado?" value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>E-mail <span className="optional-label">opcional</span>
              <span className="profile-input-icon"><Mail size={15} /><input type="email" autoComplete="email" maxLength={100} placeholder="voce@exemplo.com" value={profileDraft.email} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} /></span>
            </label>
            <label>Telefone <span className="optional-label">opcional</span>
              <span className="profile-input-icon"><Phone size={15} /><input type="tel" autoComplete="tel" maxLength={24} placeholder="(00) 00000-0000" value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} /></span>
            </label>
          </div>
          {profileError && <p className="preferences-error" role="alert">{profileError}</p>}
          <div className="profile-form-actions"><button className="primary-button" type="submit"><Check size={16} /> Salvar perfil</button></div>
        </form>
      </section>
      <section className="panel preferences-card">
        <div className="preferences-card-heading">
          <span className="eyebrow">APARÊNCIA</span>
          <h2>Tema do aplicativo</h2>
          <p>Escolha como o GranaZen aparece no seu aparelho.</p>
        </div>
        <div className="theme-options" role="group" aria-label="Tema do aplicativo">
          {themeOptions.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={preferences.theme === id ? 'theme-option selected' : 'theme-option'} aria-pressed={preferences.theme === id} onClick={() => updatePreferences({ theme: id })}>
              <Icon size={19} /><span>{label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel preferences-card">
        <div className="preferences-card-heading">
          <span className="eyebrow">SEU ESTILO</span>
          <h2>Cor de destaque</h2>
          <p>Personalize os botões e detalhes do app.</p>
        </div>
        <div className="accent-options" role="group" aria-label="Cor de destaque">
          {accentOptions.map(({ id, label, color }) => (
            <button key={id} type="button" className={preferences.accent === id ? 'accent-option selected' : 'accent-option'} aria-pressed={preferences.accent === id} onClick={() => updatePreferences({ accent: id })}>
              <span style={{ backgroundColor: color }} /><span>{label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel preferences-card">
        <div className="preferences-card-heading">
          <span className="eyebrow">ACESSIBILIDADE</span>
          <h2>Leitura e privacidade</h2>
          <p>Ajuste o tamanho dos textos e proteja os valores na tela.</p>
        </div>
        <fieldset className="text-size-options">
          <legend>Tamanho do texto</legend>
          <label><input type="radio" name="text-size" checked={preferences.textSize === 'normal'} onChange={() => updatePreferences({ textSize: 'normal' })} /> Padrão</label>
          <label><input type="radio" name="text-size" checked={preferences.textSize === 'large'} onChange={() => updatePreferences({ textSize: 'large' })} /> Maior</label>
        </fieldset>
        <label className="preference-toggle-row">
          <span><strong>Ocultar valores</strong><small>Esconde saldos e valores das movimentações.</small></span>
          <input type="checkbox" checked={preferences.hideAmounts} onChange={(event) => updatePreferences({ hideAmounts: event.target.checked })} />
        </label>
      </section>
        </div>
      </details>
      <details className="settings-group">
        <summary><span><strong>Organização financeira</strong><small>Carteiras e categorias de gastos</small></span><ChevronRight size={17} aria-hidden="true" /></summary>
        <div className="settings-group-content">
      <section className="panel preferences-card">
        <div className="preferences-card-heading"><span className="eyebrow">ORGANIZAÇÃO</span><h2>Carteiras e contas</h2><p>Separe saldos por conta bancária, poupança, dinheiro ou cartão. Os lançamentos vinculados atualizam o saldo exibido.</p></div>
        <form className="inline-finance-form" onSubmit={addWallet}>
          <label>Nome<input maxLength={40} placeholder="Ex.: Conta principal" value={walletDraft.name} onChange={(event) => setWalletDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Tipo<select value={walletDraft.kind} onChange={(event) => setWalletDraft((current) => ({ ...current, kind: event.target.value as WalletAccount['kind'] }))}><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro</option><option value="credit">Cartão</option><option value="other">Outra</option></select></label>
          <label>Saldo inicial<input type="number" step="0.01" value={walletDraft.openingBalance} onChange={(event) => setWalletDraft((current) => ({ ...current, openingBalance: Number(event.target.value) }))} /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> Adicionar carteira</button>
        </form>
        <div className="finance-settings-list">{walletBalances.map((wallet) => <div className="finance-settings-row" key={wallet.id}><span><strong>{wallet.name}</strong><small>{({ checking: 'Conta corrente', savings: 'Poupança', cash: 'Dinheiro', credit: 'Cartão', other: 'Outra' })[wallet.kind]}</small></span><strong>{displayCurrency(wallet.balance)}</strong>{wallet.id !== 'default-wallet' && <button className="debt-action delete-action" type="button" aria-label={`Excluir carteira ${wallet.name}`} onClick={() => { if (movements.some((movement) => movement.walletId === wallet.id)) setExtrasError('Esta carteira tem lançamentos vinculados e não pode ser excluída.'); else setExtras((current) => ({ ...current, wallets: current.wallets.filter((item) => item.id !== wallet.id) })) }}><Trash2 size={14} /></button>}</div>)}</div>
      </section>
      <section className="panel preferences-card">
        <div className="preferences-card-heading"><span className="eyebrow">CATEGORIAS</span><h2>Suas categorias de gastos</h2><p>Crie etiquetas próprias para organizar gastos. As categorias usadas anteriormente continuam no histórico mesmo se removidas.</p></div>
        <form className="inline-finance-form" onSubmit={addCustomExpenseCategory}><label>Nova categoria<input maxLength={40} placeholder="Ex.: Pets" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} /></label><button className="primary-button" type="submit"><Plus size={16} /> Adicionar</button></form>
        <div className="category-chip-list">{extras.customExpenseCategories.map((category) => <span className="category-chip" key={category}>{category}<button type="button" aria-label={`Remover categoria ${category}`} onClick={() => setExtras((current) => ({ ...current, customExpenseCategories: current.customExpenseCategories.filter((item) => item !== category) }))}><X size={13} /></button></span>)}</div>
      </section>
        </div>
      </details>
      <details className="settings-group">
        <summary><span><strong>Planejamento</strong><small>Orçamentos, metas e resumo inicial</small></span><ChevronRight size={17} aria-hidden="true" /></summary>
        <div className="settings-group-content">
      <section className="panel preferences-card">
        <div className="preferences-card-heading"><span className="eyebrow">PLANEJAMENTO MENSAL</span><h2>Orçamentos por categoria</h2><p>Defina limites para {monthLabel}. Os gastos registrados são comparados ao limite e sinalizam quando estão próximos ou acima.</p></div>
        <form className="inline-finance-form" onSubmit={addBudget}>
          <label>Categoria<select value={budgetDraft.category} onChange={(event) => setBudgetDraft((current) => ({ ...current, category: event.target.value }))}><option value="">Escolher</option>{allExpenseCategories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
          <label>Limite do mês<input type="number" min="0.01" step="0.01" value={budgetDraft.limit || ''} onChange={(event) => setBudgetDraft((current) => ({ ...current, limit: Number(event.target.value) }))} /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> Definir limite</button>
        </form>
        <div className="finance-settings-list">{budgetSummaries.map((budget) => <div className="budget-row" key={budget.id}><div><span><strong>{budget.category}</strong><small>{displayCurrency(budget.spent)} de {displayCurrency(budget.limit)}</small></span><button className="debt-action delete-action" type="button" aria-label={`Excluir orçamento ${budget.category}`} onClick={() => setExtras((current) => ({ ...current, budgets: current.budgets.filter((item) => item.id !== budget.id) }))}><Trash2 size={14} /></button></div><progress max={1} value={Math.min(budget.ratio, 1)} className={budget.ratio >= 1 ? 'budget-over' : budget.ratio >= .8 ? 'budget-warning' : ''} /><small>{budget.ratio >= 1 ? 'Limite atingido ou ultrapassado' : budget.ratio >= .8 ? `${Math.round(budget.ratio * 100)}% utilizado · perto do limite` : `${Math.round(budget.ratio * 100)}% utilizado`}</small></div>)}</div>
      </section>
      <section className="panel preferences-card">
        <div className="preferences-card-heading"><span className="eyebrow">OBJETIVOS</span><h2>Metas de economia</h2><p>Acompanhe objetivos e atualize o valor acumulado conforme você guardar dinheiro.</p></div>
        <form className="inline-finance-form" onSubmit={addGoal}>
          <label>Nome<input maxLength={60} placeholder="Ex.: Reserva de emergência" value={goalDraft.name} onChange={(event) => setGoalDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Valor da meta<input type="number" min="0.01" step="0.01" value={goalDraft.target || ''} onChange={(event) => setGoalDraft((current) => ({ ...current, target: Number(event.target.value) }))} /></label>
          <label>Já guardado<input type="number" min="0" step="0.01" value={goalDraft.saved || ''} onChange={(event) => setGoalDraft((current) => ({ ...current, saved: Number(event.target.value) }))} /></label>
          <label>Prazo<input type="date" value={goalDraft.deadline} onChange={(event) => setGoalDraft((current) => ({ ...current, deadline: event.target.value }))} /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> Criar meta</button>
        </form>
        <div className="finance-settings-list">{extras.goals.map((goal) => <div className="goal-row" key={goal.id}><div><span><strong>{goal.name}</strong><small>{displayCurrency(goal.saved)} de {displayCurrency(goal.target)}{goal.deadline ? ` · prazo ${formatDueDate(goal.deadline)}` : ''}</small></span><label>Atualizar valor guardado<input type="number" min="0" step="0.01" value={goal.saved} onChange={(event) => { const saved = Number(event.target.value); setExtras((current) => ({ ...current, goals: current.goals.map((item) => item.id === goal.id ? { ...item, saved: Math.max(0, saved) } : item) })) }} /></label><button className="debt-action delete-action" type="button" aria-label={`Excluir meta ${goal.name}`} onClick={() => setExtras((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== goal.id) }))}><Trash2 size={14} /></button></div><progress max={goal.target} value={Math.min(goal.saved, goal.target)} /><small>{Math.min(100, Math.round(goal.saved / goal.target * 100))}% da meta atingido</small></div>)}</div>
      </section>
      <section className="panel preferences-card">
        <div className="preferences-card-heading"><span className="eyebrow">PAINEL INICIAL</span><h2>Personalizar resumo</h2><p>Escolha quais blocos aparecem no início. Lembretes de vencimento seguem disponíveis na aba Contas.</p></div>
        <div className="dashboard-options">{[
          ['balance', 'Saldo do mês'], ['income', 'Ganhos'], ['expenses', 'Gastos'], ['debts', 'Dívidas'],
          ['reminders', 'Lembretes'], ['chart', 'Gráfico financeiro'], ['planning', 'Comparação e previsão'],
          ['budgets', 'Orçamentos'], ['goals', 'Metas'], ['activity', 'Atividade recente'],
        ].map(([id, label]) => <label key={id}><input type="checkbox" checked={extras.dashboardCards.includes(id)} onChange={() => toggleDashboardCard(id)} />{label}</label>)}</div>
      </section>
        </div>
      </details>
      <details className="settings-group">
        <summary><span><strong>Importar extratos</strong><small>CSV, OFX ou PDF com texto selecionável</small></span><ChevronRight size={17} aria-hidden="true" /></summary>
        <div className="settings-group-content">
      <section className="panel preferences-card">
        <div className="preferences-card-heading"><span className="eyebrow">EXTRATO BANCÁRIO</span><h2>Importar CSV, OFX ou PDF</h2><p>O arquivo é lido neste aparelho. Revise e selecione os lançamentos antes de adicioná-los; PDFs digitalizados como imagem não permitem extração de texto.</p></div>
        <button className="secondary-button" type="button" onClick={() => statementInputRef.current?.click()} disabled={isReadingStatement}><FileUp size={16} /> {isReadingStatement ? 'Lendo arquivo…' : 'Selecionar extrato'}</button>
        <input ref={statementInputRef} className="backup-file-input" type="file" accept=".csv,.txt,.ofx,.pdf,text/csv,application/pdf" onChange={(event) => void handleStatementFile(event)} />
        {statementError && <p className="preferences-error" role="alert">{statementError}</p>}
        {statementStatus && <p className="backup-status" role="status">{statementStatus}</p>}
        {statementPreview.length > 0 && <div className="statement-review"><p>{statementSelection.filter(Boolean).length} de {statementPreview.length} itens selecionados. Itens possivelmente duplicados vêm desmarcados.</p><div className="finance-settings-list">{statementPreview.map((entry, index) => <label className="statement-row" key={`${entry.date}-${entry.name}-${index}`}><input type="checkbox" checked={statementSelection[index]} onChange={(event) => setStatementSelection((current) => current.map((selected, itemIndex) => itemIndex === index ? event.target.checked : selected))} /><span><strong>{entry.name}</strong><small>{formatMovementDate(entry.date)} · {entry.category}</small></span><strong>{entry.kind === 'expense' ? '−' : '+'}{displayCurrency(entry.amount)}</strong></label>)}</div><div className="profile-form-actions"><button type="button" className="primary-button" onClick={importSelectedStatementEntries} disabled={!statementSelection.some(Boolean)}><Check size={16} /> Importar selecionados</button></div></div>}
      </section>
        </div>
      </details>
      <details className="settings-group">
        <summary><span><strong>Lembretes e aplicativo</strong><small>Notificações e atualizações no Android</small></span><ChevronRight size={17} aria-hidden="true" /></summary>
        <div className="settings-group-content">
      {isAndroidApp() && (
        <section className="panel preferences-card app-update-settings" aria-live="polite">
          <div className="preferences-card-heading">
            <span className="eyebrow">ATUALIZAÇÕES</span>
            <h2>Atualização do aplicativo</h2>
            <p>O GranaZen verifica atualizações automaticamente ao abrir e quando você volta ao aplicativo.</p>
          </div>
          <div className="app-update-version">
            <span>Versão instalada</span>
            <strong>{installedAndroidAppVersion || (installedAndroidAppVersionError ? 'Indisponível' : 'Verificando…')}</strong>
          </div>
          {androidUpdate && (
            <div className="app-update-available">
              <p><strong>Versão {androidUpdate.version} disponível.</strong> Baixe e instale para atualizar o GranaZen.</p>
              {androidUpdate.notes && <details className="update-prompt-notes"><summary>O que mudou nesta versão</summary><p>{androidUpdate.notes}</p></details>}
              <button className="primary-button app-update-action" type="button" onClick={() => void installAndroidUpdate()} disabled={isDownloadingAndroidUpdate}>
                <Download size={16} />
                {isDownloadingAndroidUpdate ? 'Baixando atualização…' : hasDownloadedAndroidUpdate ? 'Instalar atualização' : 'Atualizar agora'}
              </button>
            </div>
          )}
          {installedAndroidAppVersionError && <p className="update-error" role="alert">{installedAndroidAppVersionError}</p>}
          {androidUpdateStatus && <p className="backup-status" role="status">{androidUpdateStatus}</p>}
          {androidUpdateError && <p className="update-error" role="alert">{androidUpdateError}</p>}
          {!androidUpdate && (
            <button className="secondary-button app-update-action" type="button" onClick={() => void checkAndroidUpdateManually()} disabled={isCheckingAndroidUpdate}>
              <Download size={16} />
              {isCheckingAndroidUpdate ? 'Verificando atualização…' : 'Verificar atualização'}
            </button>
          )}
        </section>
      )}
      <section className="panel preferences-card">
        <div className="preferences-card-heading"><span className="eyebrow">LEMBRETES</span><h2>{supportsNativeReminders() ? 'Notificações no Android' : 'Notificações do navegador'}</h2><p>{supportsNativeReminders() ? 'Receba um aviso um dia antes do vencimento, mesmo com o app fechado. O Android pode ajustar o horário de entrega conforme as configurações de bateria e alarmes.' : 'Quando o navegador oferecer suporte, o GranaZen pode avisar ao abrir o app sobre contas vencidas ou próximas do vencimento. Isso não agenda alarmes quando o app está fechado.'}</p></div>
        {notificationPermission === 'unsupported' ? <p className="backup-warning">Notificações do sistema não são compatíveis neste ambiente.</p> : notificationPermission === 'granted' ? <p className="backup-status">Permissão concedida. {supportsNativeReminders() ? 'Os avisos de vencimento estão programados para contas próximas.' : 'Os lembretes aparecem quando você abre o app; alarmes quando ele está fechado não são suportados.'}</p> : <button className="secondary-button" type="button" onClick={() => void requestReminderNotifications()} disabled={notificationPermission === 'denied'}><Bell size={16} /> {notificationPermission === 'denied' ? 'Permissão bloqueada nas configurações do aparelho' : 'Permitir notificações neste aparelho'}</button>}
      </section>
        </div>
      </details>
      <details className="settings-group">
        <summary><span><strong>Backup e seus dados</strong><small>Exportação e restauração entre aparelhos</small></span><ChevronRight size={17} aria-hidden="true" /></summary>
        <div className="settings-group-content">
      <section className="panel preferences-card backup-card">
        <div className="preferences-card-heading">
          <span className="eyebrow">SEUS DADOS</span>
          <h2>Backup e troca de aparelho</h2>
          <p>Exporte seu perfil, configurações, dívidas, histórico, gastos e recebimentos para restaurá-los em outro aparelho.</p>
        </div>
        <div className="backup-actions">
          <button className="primary-button" type="button" onClick={() => void exportBackup()} disabled={isProcessingBackup}>
            <Download size={16} /> {isProcessingBackup ? 'Aguarde…' : 'Exportar backup'}
          </button>
          <button className="secondary-button" type="button" onClick={() => void selectBackupFile()} disabled={isProcessingBackup}>
            <Upload size={16} /> Importar backup
          </button>
          <input ref={backupInputRef} className="backup-file-input" type="file" accept=".json,application/json" onChange={(event) => void handleBackupFileChange(event)} />
        </div>
        <p className="backup-warning">A importação substitui os dados que estão neste aparelho. O arquivo não tem senha: guarde-o em um local privado.</p>
        {backupError && <p className="preferences-error" role="alert">{backupError}</p>}
        {backupStatus && <p className="backup-status" role="status">{backupStatus}</p>}
      </section>
        </div>
      </details>
      {preferencesError && <p className="preferences-error" role="alert">{preferencesError}</p>}
      {extrasError && <p className="preferences-error" role="alert">{extrasError}</p>}
    </div>
  )

  const renderSearch = (label: string) => (
    <label className="search-control">
      <Search size={16} aria-hidden="true" />
      <input type="search" aria-label={label} placeholder={label} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      {searchQuery && <button type="button" aria-label="Limpar busca" onClick={() => setSearchQuery('')}><X size={15} /></button>}
    </label>
  )

  const renderEntries = () => {
    const accountEntries = debts
      .filter((debt) => !debt.isPaid || debt.paidAt?.startsWith(monthKey))
      .filter((debt) => matchesSearch(searchQuery, debt.name, debt.category, debt.notes))
      .sort((first, second) => first.dueDate.localeCompare(second.dueDate))
    return (
    <section className="panel entries-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{monthLabel.toLocaleUpperCase('pt-BR')}</span>
          <h2>Contas e vencimentos</h2>
        </div>
        <button className="primary-button" type="button" onClick={openNewDebtForm}><Plus size={17} /> Adicionar conta</button>
      </div>
      <p className="chart-description">Contas reais cadastradas em Dívidas, incluindo vencidas, futuras e pagas neste mês.</p>
      {renderSearch('Buscar contas por nome, categoria ou observação')}
      {!accountEntries.length ? (
        <div className="history-empty-state">
          <span><ReceiptText size={22} /></span>
          <strong>{searchQuery ? 'Nenhuma conta encontrada' : 'Nenhuma conta cadastrada'}</strong>
          <p>{searchQuery ? 'Tente buscar por outro nome ou categoria.' : 'Adicione uma conta para acompanhar o valor e o vencimento aqui.'}</p>
          {!searchQuery && <button className="text-button" type="button" onClick={openNewDebtForm}><Plus size={16} /> Adicionar conta</button>}
        </div>
      ) : (
        <div className="entry-list">
          {accountEntries.map((debt) => {
            const categoryIndex = debtCategories.findIndex(({ label }) => label === debt.category)
            const category = debtCategories[categoryIndex] ?? debtCategories[debtCategories.length - 1]
            const Icon = category.icon
            const isOverdue = !debt.isPaid && debt.dueDate < localDateValue()
            const status = debt.isPaid ? 'Pago' : isOverdue ? 'Atrasada' : 'Pendente'
            return (
              <article className="entry-row" key={debt.id}>
                <span className={`entry-icon debt-color-${categoryIndex % 5}`}><Icon size={20} /></span>
                <span className="entry-copy"><strong>{debt.name}</strong><small>{debt.category} · {debt.isPaid ? 'Pago' : `Vence ${formatDueDate(debt.dueDate)}`}{debt.isRecurring ? ' · Mensal' : ''}</small></span>
                <span className="entry-end"><strong>{displayCurrency(debt.isPaid ? debt.amount : debt.remainingBalance ?? debt.amount)}</strong><small className={`status${debt.isPaid ? ' status-done' : isOverdue ? ' status-overdue' : ''}`}>{status}</small></span>
                <span className="debt-actions">
                  {!debt.isPaid && <button type="button" className="debt-action" onClick={() => toggleDebtPaid(debt.id)} aria-label={`Marcar ${debt.name} como paga`} title="Marcar como paga"><Check size={15} /></button>}
                  <button type="button" className="debt-action" onClick={() => openEditDebtForm(debt)} aria-label={`Editar ${debt.name}`} title="Editar"><Pencil size={14} /></button>
                  <button type="button" className="debt-action delete-action" onClick={() => deleteDebt(debt.id)} aria-label={`Excluir ${debt.name}`} title="Excluir"><Trash2 size={14} /></button>
                </span>
              </article>
            )
          })}
        </div>
      )}
    </section>
    )
  }

  return (
    <div className={`app-shell theme-${isDarkTheme ? 'dark' : 'light'} accent-${preferences.accent}${preferences.textSize === 'large' ? ' text-size-large' : ''}`}>
      <main className="main-content">
        <header className="topbar">
          <button className="topbar-brand" type="button" onClick={() => setActiveSection('inicio')} aria-label="Ir para o início do GranaZen">
            <span className="brand-mark"><Wallet size={19} strokeWidth={2.2} /></span><span>Grana<span>Zen</span></span>
          </button>
          <div className="topbar-actions"><button className="icon-button notification-button" type="button" onClick={() => setActiveSection('contas')} aria-label={reminderDebts.length ? `Ver ${reminderDebts.length} contas vencidas ou próximas do vencimento` : 'Ver contas'}><Bell size={19} />{reminderDebts.length > 0 && <i />}</button><button className="avatar top-avatar profile-avatar-button" type="button" onClick={() => setActiveSection('mais')} aria-label={`Abrir perfil${profile.name ? ` de ${profile.name}` : ''}`}>{profile.photo ? <img src={profile.photo} alt="" /> : profileInitials(profile.name)}</button></div>
        </header>

        <nav className="desktop-nav" aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeSection === id ? 'desktop-nav-item active' : 'desktop-nav-item'} type="button" onClick={() => setActiveSection(id)} aria-current={activeSection === id ? 'page' : undefined}>
              <Icon size={17} /><span>{label}</span>
              {id === 'contas' && pendingDebts.length > 0 && <span className="desktop-nav-count">{pendingDebts.length}</span>}
            </button>
          ))}
        </nav>

        <div className="page-content">
          <div className="page-heading">
            <div><span className="eyebrow">{activeSection === 'mais' ? 'DEIXE DO SEU JEITO' : activeSection === 'movimentos' ? 'CONTROLE DO DIA A DIA' : activeSection === 'historico' ? 'VISÃO AO LONGO DO TEMPO' : activeSection === 'dividas' ? 'CONTAS E COMPROMISSOS' : activeSection === 'contas' ? 'ORGANIZAÇÃO FINANCEIRA' : activeSection === 'calendario' ? 'AGENDA FINANCEIRA' : todayLabel}</span><h1>{sectionTitles[activeSection]}</h1><p>{activeSection === 'mais' ? 'Ajuste o visual e a leitura do seu aplicativo.' : activeSection === 'movimentos' ? 'Anote gastos rápidos e todo dinheiro que entrar.' : activeSection === 'historico' ? 'Acompanhe tudo que aconteceu com seu dinheiro ao longo do tempo.' : activeSection === 'dividas' ? 'Acompanhe vencimentos, pagamentos e contas recorrentes.' : activeSection === 'contas' ? 'Veja seus compromissos financeiros em um só lugar.' : activeSection === 'calendario' ? 'Consulte contas, gastos e recebimentos por data.' : 'Um resumo claro para você cuidar bem do seu dinheiro.'}</p></div>
            {activeSection !== 'mais' && activeSection !== 'contas' && activeSection !== 'historico' && activeSection !== 'calendario' && <button className="primary-button" onClick={() => activeSection === 'dividas' ? openNewDebtForm() : openNewMovementForm('expense')}><Plus size={18} /> {activeSection === 'dividas' ? 'Nova dívida' : activeSection === 'movimentos' ? 'Novo gasto' : 'Novo lançamento'}</button>}
          </div>
          {activeSection === 'mais' ? (
            renderPreferences()
          ) : activeSection === 'calendario' ? (
            renderCalendar()
          ) : activeSection === 'movimentos' ? (
            renderMovements()
          ) : activeSection === 'historico' ? (
            renderHistory()
          ) : activeSection === 'inicio' ? (
            <>
              <section className="summary-grid">
                {extras.dashboardCards.includes('balance') && <article className="balance-card">
                  <div className="balance-top"><span>Saldo após gastos no mês</span><button onClick={() => updatePreferences({ hideAmounts: !preferences.hideAmounts })} aria-label={preferences.hideAmounts ? 'Mostrar valores' : 'Ocultar valores'}>{preferences.hideAmounts ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                  <div className="balance-value">{displayCurrency(availableThisMonth)}</div>
                  <div className="balance-foot"><span className="balance-indicator"><i /> Ganhos menos gastos</span><span>{monthLabel}</span></div>
                  <div className="balance-decoration decoration-one" /><div className="balance-decoration decoration-two" />
                </article>}
                {extras.dashboardCards.includes('income') && <article className="metric-card"><span className="metric-icon income-icon"><ArrowDownRight size={19} /></span><span className="metric-label">Ganhos recebidos</span><strong>{displayCurrency(currentMonthIncome)}</strong><small><b>{currentMonthMovements.filter((item) => item.kind !== 'expense').length} recebimentos</b> no mês</small></article>}
                {extras.dashboardCards.includes('expenses') && <article className="metric-card"><span className="metric-icon expense-icon"><ArrowUpRight size={19} /></span><span className="metric-label">Gastos registrados</span><strong>{displayCurrency(currentMonthExpenses)}</strong><small><b>{currentMonthMovements.filter((item) => item.kind === 'expense').length} gastos</b> no mês</small></article>}
                {extras.dashboardCards.includes('debts') && <article className="metric-card"><span className="metric-icon debt-icon"><ArrowLeftRight size={18} /></span><span className="metric-label">Dívidas em aberto</span><strong>{displayCurrency(pendingDebtTotal)}</strong><small><b>{pendingDebts.length} {pendingDebts.length === 1 ? 'dívida' : 'dívidas'}</b> {pendingDebts.length === 1 ? 'cadastrada' : 'cadastradas'}</small></article>}
              </section>

              {extras.dashboardCards.includes('reminders') && reminderDebts.length > 0 && (
                <section className={`panel reminders-panel${overdueDebts.length ? ' has-overdue' : ''}`} aria-labelledby="reminders-title">
                  <div className="panel-heading">
                    <div><span className="eyebrow">LEMBRETES DE VENCIMENTO</span><h2 id="reminders-title">{overdueDebts.length ? `${overdueDebts.length} conta${overdueDebts.length === 1 ? '' : 's'} atrasada${overdueDebts.length === 1 ? '' : 's'}` : 'Contas vencendo em breve'}</h2></div>
                    <button className="link-button" type="button" onClick={() => setActiveSection('contas')}>Ver contas <ChevronRight size={15} /></button>
                  </div>
                  <div className="reminder-list">
                    {reminderDebts.slice(0, 3).map((debt) => (
                      <div className="reminder-row" key={debt.id}>
                        <span><strong>{debt.name}</strong><small>{debt.dueDate < todayDate ? 'Vencida' : `Vence ${formatDueDate(debt.dueDate)}`}</small></span>
                        <strong>{displayCurrency(debt.amount)}</strong>
                      </div>
                    ))}
                    {reminderDebts.length > 3 && <small className="reminder-more">E mais {reminderDebts.length - 3} contas próximas do vencimento.</small>}
                  </div>
                </section>
              )}

              {extras.dashboardCards.includes('chart') && renderMonthlyChart()}
              {extras.dashboardCards.includes('planning') && <section className="panel outlook-panel">
                <div className="panel-heading">
                  <div><span className="eyebrow">COMPARAÇÃO E PREVISÃO</span><h2>Planejamento do mês</h2></div>
                </div>
                <div className="outlook-grid">
                  <article><span>Ganhos deste mês</span><strong>{displayCurrency(currentMonthIncome)}</strong><small>Anterior: {displayCurrency(previousMonthIncome)}</small></article>
                  <article><span>Gastos deste mês</span><strong>{displayCurrency(currentMonthExpenses)}</strong><small>Anterior: {displayCurrency(previousMonthExpenses)}</small></article>
                  <article className="outlook-projection"><span>Saldo estimado após contas</span><strong>{displayCurrency(projectedMonthEndBalance)}</strong><small>Considera lançamentos feitos e dívidas com vencimento até o fim do mês.</small></article>
                </div>
              </section>}
              {extras.dashboardCards.includes('budgets') && budgetSummaries.length > 0 && <section className="panel dashboard-finance-panel"><div className="panel-heading"><div><span className="eyebrow">LIMITES DO MÊS</span><h2>Orçamentos por categoria</h2></div><button type="button" className="link-button" onClick={() => setActiveSection('mais')}>Gerenciar <ChevronRight size={15} /></button></div>{budgetSummaries.map((budget) => <div className="dashboard-budget-row" key={budget.id}><span>{budget.category}</span><progress max={1} value={Math.min(budget.ratio, 1)} className={budget.ratio >= 1 ? 'budget-over' : budget.ratio >= .8 ? 'budget-warning' : ''} /><strong>{displayCurrency(budget.spent)} / {displayCurrency(budget.limit)}</strong></div>)}</section>}
              {extras.dashboardCards.includes('goals') && extras.goals.length > 0 && <section className="panel dashboard-finance-panel"><div className="panel-heading"><div><span className="eyebrow">OBJETIVOS</span><h2>Metas de economia</h2></div><button type="button" className="link-button" onClick={() => setActiveSection('mais')}>Gerenciar <ChevronRight size={15} /></button></div>{extras.goals.map((goal) => <div className="dashboard-budget-row" key={goal.id}><span>{goal.name}</span><progress max={goal.target} value={Math.min(goal.saved, goal.target)} /><strong>{displayCurrency(goal.saved)} / {displayCurrency(goal.target)}</strong></div>)}</section>}
              {extras.dashboardCards.includes('activity') && <div className="dashboard-grid">
                <section className="panel activity-panel recent-activity-panel">
                  <div className="panel-heading"><div><span className="eyebrow">LANÇAMENTOS DO MÊS</span><h2>Atividade recente</h2></div><button className="link-button" onClick={() => setActiveSection('movimentos')}>Ver todos <ChevronRight size={15} /></button></div>
                  {!recentMovements.length ? (
                    <div className="recent-empty"><span><ChartNoAxesColumnIncreasing size={21} /></span><p>Seus gastos e recebimentos aparecerão aqui.</p><button className="text-button" onClick={() => setActiveSection('movimentos')}><Plus size={16} /> Registrar lançamento</button></div>
                  ) : (
                    <div className="activity-list">{recentMovements.map((movement) => {
                      const categories = movement.kind === 'expense' ? expenseCategories : incomeCategories
                      const category = categories.find(({ label }) => label === movement.category)
                      const Icon = category?.icon ?? Tag
                      const isExpense = movement.kind === 'expense'
                      return <div className="activity-row" key={movement.id}><span className={`activity-icon ${isExpense ? 'expense' : 'income'}`}><Icon size={17} /></span><span className="activity-copy"><strong>{movement.name}</strong><small>{movement.category} · {formatMovementDate(movement.date)}</small></span><strong className={isExpense ? 'amount-negative' : 'amount-positive'}>{isExpense ? '−' : '+'} {displayCurrency(movement.amount)}</strong></div>
                    })}</div>
                  )}
                  {movementsError && <p className="movement-error" role="alert">{movementsError}</p>}
                  <button className="text-button" onClick={() => openNewMovementForm('expense')}><Plus size={16} /> Registrar gasto rápido</button>
                </section>
              </div>}

              <section className="insight-strip"><span className="insight-icon"><ShieldCheck size={19} /></span><span><strong>Resumo atualizado.</strong> Seus números consideram os lançamentos salvos neste aparelho.</span><button aria-label="Ver movimentações" onClick={() => setActiveSection('movimentos')}><ChevronRight size={17} /></button></section>
            </>
          ) : activeSection === 'dividas' ? (
            renderDebts()
          ) : (
            <>
              {renderEntries()}
            </>
          )}
        </div>

        <nav className="mobile-nav" aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={activeSection === id ? 'mobile-nav-item active' : 'mobile-nav-item'} type="button" onClick={() => setActiveSection(id)} aria-current={activeSection === id ? 'page' : undefined}><Icon size={20} /><span>{label}</span></button>)}
        </nav>
        {latestUndoableEntry && (
          <div className="undo-toast" role="status" aria-live="polite">
            <span>{latestUndoableEntry.label}</span>
            <button type="button" onClick={undoLatestDeletion}>Desfazer</button>
          </div>
        )}

        {isDebtFormOpen && (
          <div className="debt-form-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsDebtFormOpen(false)
          }}>
            <section className="debt-form-dialog" role="dialog" aria-modal="true" aria-labelledby="debt-form-title">
              <div className="debt-form-heading">
                <div><span className="eyebrow">{editingDebtId ? 'ATUALIZE OS DADOS' : 'NOVO CADASTRO'}</span><h2 id="debt-form-title">{editingDebtId ? 'Editar dívida' : 'Adicionar dívida'}</h2></div>
                <button className="icon-button" type="button" onClick={() => setIsDebtFormOpen(false)} aria-label="Fechar formulário"><X size={20} /></button>
              </div>
              <p className="debt-form-intro">Escolha uma etiqueta para o tipo e dê um nome que ajude você a identificar essa conta.</p>
              <form className="debt-form" onSubmit={saveDebt}>
                <label>Tipo de dívida
                  <select value={debtDraft.category} onChange={(event) => {
                    const category = event.target.value
                    if (isDebtCategory(category)) setDebtDraft((current) => ({ ...current, category }))
                  }}>
                    {debtCategories.map(({ label }) => <option key={label} value={label}>{label}</option>)}
                  </select>
                </label>
                <label>Identificação
                  <input autoFocus maxLength={60} placeholder={debtDraft.category === 'Cartão de crédito' ? 'Ex.: Cartão Nubank' : `Ex.: ${debtDraft.category} de casa`} value={debtDraft.name} onChange={(event) => setDebtDraft((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <div className="debt-form-fields">
                  <label>Valor total ou saldo devedor
                    <span className="currency-input"><span>R$</span><input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0,00" value={debtDraft.amount || ''} onChange={(event) => setDebtDraft((current) => ({ ...current, amount: Number(event.target.value) }))} /></span>
                  </label>
                  <label>Vencimento
                    <input type="date" value={debtDraft.dueDate} onChange={(event) => setDebtDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                  </label>
                </div>
                <div className="debt-form-fields">
                  <label>Quantidade de parcelas <span className="optional-label">opcional</span>
                    <input type="number" min="1" step="1" value={debtDraft.installmentsTotal ?? ''} onChange={(event) => setDebtDraft((current) => ({ ...current, installmentsTotal: event.target.value ? Number(event.target.value) : undefined, installmentsPaid: event.target.value ? current.installmentsPaid ?? 0 : undefined }))} />
                  </label>
                  <label>Valor da parcela <span className="optional-label">opcional</span>
                    <input type="number" min="0.01" step="0.01" value={debtDraft.installmentAmount ?? ''} onChange={(event) => setDebtDraft((current) => ({ ...current, installmentAmount: event.target.value ? Number(event.target.value) : undefined }))} />
                  </label>
                </div>
                <div className="debt-form-fields">
                  <label>Parcelas já pagas
                    <input type="number" min="0" max={debtDraft.installmentsTotal ?? undefined} step="1" value={debtDraft.installmentsPaid ?? 0} onChange={(event) => setDebtDraft((current) => ({ ...current, installmentsPaid: Number(event.target.value) }))} disabled={!debtDraft.installmentsTotal} />
                  </label>
                  <label>Juros ao mês (%) <span className="optional-label">opcional</span>
                    <input type="number" min="0" max="100" step="0.01" value={debtDraft.interestRateMonthly ?? ''} onChange={(event) => setDebtDraft((current) => ({ ...current, interestRateMonthly: event.target.value ? Number(event.target.value) : undefined }))} />
                  </label>
                </div>
                <label>Prioridade de pagamento
                  <select value={debtDraft.priority ?? 'normal'} onChange={(event) => setDebtDraft((current) => ({ ...current, priority: event.target.value as Debt['priority'] }))}><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option></select>
                </label>
                <label>Observação <span className="optional-label">opcional</span>
                  <textarea rows={2} maxLength={240} placeholder="Detalhes que você queira lembrar" value={debtDraft.notes} onChange={(event) => setDebtDraft((current) => ({ ...current, notes: event.target.value }))} />
                </label>
                <label className="recurring-debt-option">
                  <input type="checkbox" checked={debtDraft.isRecurring} onChange={(event) => setDebtDraft((current) => ({ ...current, isRecurring: event.target.checked }))} />
                  <span><strong>Conta recorrente mensal</strong><small>Ao marcar como paga, uma nova conta será criada para o mês seguinte.</small></span>
                </label>
                {debtFormError && <p className="debt-error" role="alert">{debtFormError}</p>}
                <div className="debt-form-actions">
                  <button className="secondary-button" type="button" onClick={() => setIsDebtFormOpen(false)}>Cancelar</button>
                  <button className="primary-button" type="submit">{editingDebtId ? 'Salvar alterações' : 'Salvar dívida'}</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {isMovementFormOpen && (
          <div className="debt-form-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsMovementFormOpen(false)
          }}>
            <section className="debt-form-dialog movement-form-dialog" role="dialog" aria-modal="true" aria-labelledby="movement-form-title">
              <div className="debt-form-heading">
                <div>
                  <span className="eyebrow">{editingMovementId ? 'ATUALIZE O LANÇAMENTO' : 'REGISTRO RÁPIDO'}</span>
                  <h2 id="movement-form-title">{editingMovementId ? 'Editar lançamento' : movementDraft.kind === 'expense' ? 'Registrar gasto' : movementDraft.kind === 'salary' ? 'Registrar salário recebido' : 'Registrar valor por fora'}</h2>
                </div>
                <button className="icon-button" type="button" onClick={() => setIsMovementFormOpen(false)} aria-label="Fechar formulário"><X size={20} /></button>
              </div>
              <p className="debt-form-intro">Lançamentos entram nos totais do mês pela data escolhida. Você pode registrar o salário com o valor recebido em cada mês.</p>
              <form className="debt-form" onSubmit={saveMovement}>
                <fieldset className="movement-kind-options">
                  <legend>O que você quer registrar?</legend>
                  {([
                    { kind: 'expense', label: 'Gasto', category: 'Mercado' },
                    { kind: 'salary', label: 'Salário', category: 'Salário' },
                    { kind: 'extra', label: 'Por fora', category: 'Renda extra' },
                  ] as const).map(({ kind, label, category }) => (
                    <button
                      type="button"
                      key={kind}
                      className={movementDraft.kind === kind ? `movement-kind-option active ${kind}` : `movement-kind-option ${kind}`}
                      aria-pressed={movementDraft.kind === kind}
                      onClick={() => setMovementDraft((current) => ({
                        ...current,
                        kind,
                        category,
                        name: current.name === 'Salário' || current.name === 'Renda extra' ? (kind === 'salary' ? 'Salário' : '') : current.name,
                      }))}
                    >
                      {kind === 'expense' ? <ArrowUpRight size={16} /> : kind === 'salary' ? <BriefcaseBusiness size={16} /> : <Gift size={16} />}
                      {label}
                    </button>
                  ))}
                </fieldset>
                {movementDraft.kind === 'expense' ? (
                  <label>Categoria do gasto
                    <select value={movementDraft.category} onChange={(event) => {
                      const category = event.target.value
                      if (isExpenseCategory(category) || extras.customExpenseCategories.includes(category)) setMovementDraft((current) => ({ ...current, category }))
                    }}>
                        {[...expenseCategories.map(({ label }) => label), ...extras.customExpenseCategories].map((label) => <option key={label} value={label}>{label}</option>)}
                    </select>
                  </label>
                ) : (
                  <div className="income-kind-note">
                    <span>{movementDraft.kind === 'salary' ? <BriefcaseBusiness size={17} /> : <Gift size={17} />}</span>
                    <span><strong>{movementDraft.kind === 'salary' ? 'Salário do mês' : 'Renda extra'}</strong><small>Este valor será somado aos ganhos de {monthLabel} conforme a data.</small></span>
                  </div>
                )}
                <label>Carteira
                  <select value={movementDraft.walletId ?? ''} onChange={(event) => setMovementDraft((current) => ({ ...current, walletId: event.target.value || null }))}>
                    <option value="">Não vinculada</option>
                    {extras.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                  </select>
                </label>
                <label>{movementDraft.kind === 'expense' ? 'O que você comprou?' : movementDraft.kind === 'salary' ? 'Identificação do salário' : 'De onde veio esse valor?'}
                  <input
                    autoFocus
                    maxLength={60}
                    placeholder={movementDraft.kind === 'expense' ? 'Ex.: Compra no mercado' : movementDraft.kind === 'salary' ? 'Ex.: Salário de novembro' : 'Ex.: Freelance, venda, presente'}
                    value={movementDraft.name}
                    onChange={(event) => setMovementDraft((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <div className="debt-form-fields">
                  <label>Valor
                    <span className="currency-input"><span>R$</span><input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0,00" value={movementDraft.amount || ''} onChange={(event) => setMovementDraft((current) => ({ ...current, amount: Number(event.target.value) }))} /></span>
                  </label>
                  <label>Data
                    <input type="date" value={movementDraft.date} onChange={(event) => setMovementDraft((current) => ({ ...current, date: event.target.value }))} />
                  </label>
                </div>
                <label>Observação <span className="optional-label">opcional</span>
                  <textarea rows={2} maxLength={240} placeholder="Um detalhe para lembrar depois" value={movementDraft.notes} onChange={(event) => setMovementDraft((current) => ({ ...current, notes: event.target.value }))} />
                </label>
                {movementFormError && <p className="debt-error" role="alert">{movementFormError}</p>}
                <div className="debt-form-actions">
                  <button className="secondary-button" type="button" onClick={() => setIsMovementFormOpen(false)}>Cancelar</button>
                  <button className="primary-button" type="submit">{editingMovementId ? 'Salvar alterações' : movementDraft.kind === 'expense' ? 'Salvar gasto' : 'Salvar recebimento'}</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {isAndroidApp() && androidUpdate && isUpdatePromptOpen && (
          <div className="update-prompt-backdrop" role="presentation">
            <section className="update-prompt" role="alertdialog" aria-modal="true" aria-labelledby="update-prompt-title" aria-describedby="update-prompt-description">
              <div className="update-prompt-top">
                <span className="update-prompt-icon"><Download size={21} /></span>
                <span className="update-prompt-badge">NOVA VERSÃO</span>
              </div>
              <h2 id="update-prompt-title">Atualização disponível</h2>
              <p id="update-prompt-description">O GranaZen <strong>{androidUpdate.version}</strong> está pronto para instalar.</p>
              {androidUpdate.notes && <details className="update-prompt-notes"><summary>O que mudou nesta versão</summary><p>{androidUpdate.notes}</p></details>}
              {androidUpdateStatus && <p className="update-prompt-status" role="status">{androidUpdateStatus}</p>}
              {androidUpdateError && <p className="update-prompt-error" role="alert">{androidUpdateError}</p>}
              <button className="primary-button update-install-button" type="button" onClick={() => void installAndroidUpdate()} disabled={isDownloadingAndroidUpdate}>
                <Download size={17} />
                {isDownloadingAndroidUpdate ? 'Baixando atualização…' : hasDownloadedAndroidUpdate ? 'Instalar atualização' : 'Atualizar agora'}
              </button>
              <button className="update-prompt-later" type="button" onClick={() => {
                dismissedUpdateVersion.current = androidUpdate.version
                setIsUpdatePromptOpen(false)
              }} disabled={isDownloadingAndroidUpdate}>Decidir depois</button>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
