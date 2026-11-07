import { useState } from 'react'
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Bell,
  CalendarDays,
  CarFront,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Eye,
  EyeOff,
  House,
  Landmark,
  Plus,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingBasket,
  Wallet,
} from 'lucide-react'

type Section = 'inicio' | 'receitas' | 'contas' | 'dividas'

const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const navigation: { id: Section; label: string; icon: typeof House }[] = [
  { id: 'inicio', label: 'Início', icon: House },
  { id: 'receitas', label: 'Receitas', icon: ArrowDownLeft },
  { id: 'contas', label: 'Contas', icon: ReceiptText },
  { id: 'dividas', label: 'Dívidas', icon: ArrowLeftRight },
]

const sectionTitles: Record<Section, string> = {
  inicio: 'Visão geral',
  receitas: 'Minhas receitas',
  contas: 'Contas do mês',
  dividas: 'Dívidas e empréstimos',
}

const upcomingBills = [
  { name: 'Aluguel', detail: 'Moradia · vence dia 10', amount: 1450, icon: House, color: 'violet' },
  { name: 'Cartão de crédito', detail: 'Cartão · vence dia 14', amount: 680.5, icon: CreditCard, color: 'blue' },
  { name: 'Energia elétrica', detail: 'Casa · vence dia 18', amount: 142.3, icon: Banknote, color: 'amber' },
]

const recentActivity = [
  { name: 'Salário', detail: 'Receita · dia 05', amount: 4200, icon: ArrowDownLeft, type: 'income' },
  { name: 'Supermercado', detail: 'Alimentação · dia 06', amount: -286.4, icon: ShoppingBasket, type: 'expense' },
  { name: 'Parcela do carro', detail: 'Empréstimo · dia 07', amount: -540, icon: CarFront, type: 'expense' },
]

const demoEntries: Record<Exclude<Section, 'inicio'>, { name: string; detail: string; amount: number; icon: typeof Wallet; status: string }[]> = {
  receitas: [
    { name: 'Salário', detail: 'Recebido · dia 05', amount: 4200, icon: Banknote, status: 'Recebido' },
    { name: 'Freelance', detail: 'Previsto · dia 20', amount: 650, icon: Landmark, status: 'Previsto' },
  ],
  contas: [
    { name: 'Aluguel', detail: 'Vence dia 10', amount: 1450, icon: House, status: 'Pendente' },
    { name: 'Cartão de crédito', detail: 'Vence dia 14', amount: 680.5, icon: CreditCard, status: 'Pendente' },
    { name: 'Energia elétrica', detail: 'Vence dia 18', amount: 142.3, icon: Banknote, status: 'Pendente' },
    { name: 'Internet', detail: 'Pago · dia 03', amount: 99.9, icon: ShieldCheck, status: 'Pago' },
  ],
  dividas: [
    { name: 'Financiamento do carro', detail: 'Parcela 8 de 36', amount: 540, icon: CarFront, status: 'Em andamento' },
    { name: 'Empréstimo pessoal', detail: 'Parcela 3 de 12', amount: 320, icon: Landmark, status: 'Em andamento' },
  ],
}

function App() {
  const [activeSection, setActiveSection] = useState<Section>('inicio')
  const [balanceVisible, setBalanceVisible] = useState(true)

  const renderEntries = (section: Exclude<Section, 'inicio'>) => (
    <section className="panel entries-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">JULHO 2025</span>
          <h2>{section === 'receitas' ? 'Entradas previstas' : section === 'contas' ? 'Lançamentos' : 'Parcelas ativas'}</h2>
        </div>
        <button className="icon-button" aria-label="Filtrar lançamentos"><Settings2 size={19} /></button>
      </div>
      <div className="entry-list">
        {demoEntries[section].map(({ name, detail, amount, icon: Icon, status }) => (
          <div className="entry-row" key={name}>
            <span className="entry-icon"><Icon size={20} /></span>
            <span className="entry-copy"><strong>{name}</strong><small>{detail}</small></span>
            <span className="entry-end"><strong>{currency(amount)}</strong><small className={status === 'Pago' || status === 'Recebido' ? 'status status-done' : 'status'}>{status}</small></span>
          </div>
        ))}
      </div>
      <button className="text-button"><Plus size={17} /> Adicionar {section === 'receitas' ? 'receita' : section === 'contas' ? 'conta' : 'dívida'}</button>
    </section>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setActiveSection('inicio')}>
          <span className="brand-mark"><Wallet size={21} strokeWidth={2.2} /></span>
          <span>Grana<span className="brand-light">Zen</span><small>FINANÇAS PESSOAIS</small></span>
        </a>
        <span className="nav-caption">MENU PRINCIPAL</span>
        <nav className="side-nav" aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeSection === id ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection(id)}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
              {id === 'contas' && <span className="nav-count">3</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={18} /></span><strong>Um passo de cada vez</strong><small>Organizar seu dinheiro pode ser simples.</small></div>
          <button className="profile-button"><span className="avatar">F</span><span className="profile-copy"><strong>Meu espaço</strong><small>Plano pessoal</small></span><ChevronDown size={16} /></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Meu espaço</span><ChevronRight size={14} /><strong>{sectionTitles[activeSection]}</strong></div>
          <div className="topbar-actions"><span className="month-picker"><CalendarDays size={16} /> Julho 2025 <ChevronDown size={15} /></span><button className="icon-button notification-button" aria-label="Notificações"><Bell size={19} /><i /></button><span className="avatar top-avatar">F</span></div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><span className="eyebrow">TERÇA-FEIRA, 08 DE JULHO</span><h1>{sectionTitles[activeSection]}<span className="wave"> ✳</span></h1><p>Um resumo claro para você cuidar bem do seu dinheiro.</p></div>
            <button className="primary-button"><Plus size={18} /> Novo lançamento</button>
          </div>

          {activeSection === 'inicio' ? (
            <>
              <section className="summary-grid">
                <article className="balance-card">
                  <div className="balance-top"><span>Saldo disponível no mês</span><button onClick={() => setBalanceVisible(!balanceVisible)} aria-label={balanceVisible ? 'Ocultar saldo' : 'Mostrar saldo'}>{balanceVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button></div>
                  <div className="balance-value">{balanceVisible ? currency(4200) : 'R$ ••••••'}</div>
                  <div className="balance-foot"><span className="balance-indicator"><i /> Atualizado agora</span><span>de 01 a 31 jul</span></div>
                  <div className="balance-decoration decoration-one" /><div className="balance-decoration decoration-two" />
                </article>
                <article className="metric-card"><span className="metric-icon income-icon"><ArrowDownRight size={19} /></span><span className="metric-label">Receitas recebidas</span><strong>{currency(4200)}</strong><small><b>+1 receita</b> neste mês</small></article>
                <article className="metric-card"><span className="metric-icon expense-icon"><ArrowUpRight size={19} /></span><span className="metric-label">Contas a pagar</span><strong>{currency(2272.8)}</strong><small><b>3 contas</b> pendentes</small></article>
                <article className="metric-card"><span className="metric-icon debt-icon"><ArrowLeftRight size={18} /></span><span className="metric-label">Dívidas ativas</span><strong>{currency(860)}</strong><small><b>2 parcelas</b> neste mês</small></article>
              </section>

              <div className="dashboard-grid">
                <section className="panel bills-panel">
                  <div className="panel-heading"><div><span className="eyebrow">FIQUE DE OLHO</span><h2>Próximas contas</h2></div><button className="link-button" onClick={() => setActiveSection('contas')}>Ver todas <ChevronRight size={15} /></button></div>
                  <div className="bill-list">{upcomingBills.map(({ name, detail, amount, icon: Icon, color }) => <div className="bill-row" key={name}><span className={`bill-icon ${color}`}><Icon size={19} /></span><span className="bill-copy"><strong>{name}</strong><small>{detail}</small></span><span className="bill-amount">{currency(amount)}</span></div>)}</div>
                  <button className="text-button" onClick={() => setActiveSection('contas')}><Plus size={17} /> Adicionar conta</button>
                </section>
                <section className="panel activity-panel">
                  <div className="panel-heading"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Atividade recente</h2></div><button className="icon-button" aria-label="Ver movimentações"><ChevronRight size={19} /></button></div>
                  <div className="activity-list">{recentActivity.map(({ name, detail, amount, icon: Icon, type }) => <div className="activity-row" key={name}><span className={`activity-icon ${type}`}><Icon size={17} /></span><span className="activity-copy"><strong>{name}</strong><small>{detail}</small></span><strong className={type === 'income' ? 'amount-positive' : 'amount-negative'}>{type === 'income' ? '+' : '−'} {currency(Math.abs(amount))}</strong></div>)}</div>
                  <button className="text-button"><ArrowLeftRight size={16} /> Ver movimentações</button>
                </section>
              </div>

              <section className="insight-strip"><span className="insight-icon"><ShieldCheck size={19} /></span><span><strong>Você está no controle.</strong> Seu saldo cobre as contas previstas para este mês.</span><button aria-label="Entendi"><ChevronRight size={17} /></button></section>
              <p className="demo-note">Este é um modelo com dados de demonstração. Seus dados ainda não são salvos.</p>
            </>
          ) : (
            <>
              {renderEntries(activeSection)}
              <p className="demo-note">Este é um modelo com dados de demonstração. Seus dados ainda não são salvos.</p>
            </>
          )}
        </div>

        <nav className="mobile-nav" aria-label="Navegação móvel">
          {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={activeSection === id ? 'mobile-nav-item active' : 'mobile-nav-item'} onClick={() => setActiveSection(id)}><Icon size={20} /><span>{label}</span></button>)}
        </nav>
      </main>
    </div>
  )
}

export default App
