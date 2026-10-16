// F1-005 · SPEC-F1-01 · CA-F1-01-05 · S103/S105
// Homes por perfil: cada papel vê a própria home após o gate de segurança
// (use-auth) liberar o acesso. Nenhuma home cria ou altera permissão —
// a segurança continua vindo do gate + RLS + Edge Function.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Fuel,
  Loader2,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserCog,
  UserRound,
  Users,
  XCircle,
  X,
  Link2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth, type UserRole } from '@/hooks/use-auth'

const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  company: 'Empresa',
  driver: 'Motorista',
}

// ---------------------------------------------------------------------------
// Moldura comum das homes (título, ícone, sessão e logout).
// ---------------------------------------------------------------------------

export function HomeShell({
  icon,
  title,
  subtitle,
  email,
  accent,
  children,
  onLogout,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  email: string | null | undefined
  accent: 'green' | 'blue' | 'purple' | 'amber'
  children: React.ReactNode
  onLogout: () => void
}) {
  const { profile } = useAuth()
  const accentMap = {
    green: { bg: 'bg-[#16A34A]/10', border: 'border-[#16A34A]/30', text: 'text-[#16A34A]' },
    blue: { bg: 'bg-[#3B82F6]/10', border: 'border-[#3B82F6]/30', text: 'text-[#3B82F6]' },
    purple: { bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/30', text: 'text-[#8B5CF6]' },
    amber: { bg: 'bg-[#EAB308]/10', border: 'border-[#EAB308]/30', text: 'text-[#EAB308]' },
  } as const
  const a = accentMap[accent]

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[560px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
        <div
          className={`mx-auto w-16 h-16 rounded-2xl ${a.bg} ${a.border} border flex items-center justify-center ${a.text} mb-4`}
        >
          {icon}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F9F8] text-center">{title}</h1>
        <p className="text-sm text-[#8B9A97] mt-2 text-center">{subtitle}</p>

        <div className="my-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#8B9A97]">
            <UserRound className={`w-4 h-4 ${a.text}`} />
            <span>
              {profile?.full_name || 'Usuário autenticado'}
              {profile ? ` · ${roleLabel[profile.role]}` : ''}
            </span>
          </div>
          <p className="font-mono text-sm text-[#F7F9F8] break-all">{email || '—'}</p>
          <div className="flex items-center gap-2 pt-2 text-xs text-[#16A34A]">
            <Fuel className="w-3.5 h-3.5" />
            <span>Sessão ativa via Supabase Auth · perfil ativo verificado</span>
          </div>
        </div>

        {children}

        <div className="flex flex-col gap-3 mt-6">
          <button
            type="button"
            onClick={onLogout}
            className="w-full h-12 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-semibold text-sm transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
          >
            <LogOut className="w-4 h-4" />
            Encerrar sessão
          </button>
          <Link
            to="/"
            className="text-xs text-[#8B9A97] hover:text-[#F7F9F8] underline underline-offset-4 text-center"
          >
            Voltar para a página de login
          </Link>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Home ADMIN — administração de internos (lista, convidar, desativar/ativar).
// Chama a Edge Function da F1-004 com o JWT do chamador; service_role nunca
// chega ao navegador. A lista de perfis vem da RLS profiles_select_self_or_internal.
// ---------------------------------------------------------------------------

type InternalRow = {
  user_id: string
  role: UserRole
  status: 'pending' | 'active' | 'disabled'
  full_name: string | null
}

const statusMeta = {
  pending: { label: 'Pendente', icon: Clock, cls: 'text-[#EAB308]' },
  active: { label: 'Ativo', icon: CheckCircle2, cls: 'text-[#16A34A]' },
  disabled: { label: 'Desativado', icon: XCircle, cls: 'text-[#DC2626]' },
} as const

export function AdminHome({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  const { profile } = useAuth()
  const [rows, setRows] = useState<InternalRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [inviteErr, setInviteErr] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  // F1-008: fila de aprovação de empresas (empresas pending via RLS).
  type PendingCompany = {
    id: string
    name: string
    cnpj_normalized: string | null
    contact_name: string | null
  }
  const [pendingCompanies, setPendingCompanies] = useState<PendingCompany[]>([])
  const [approvalLoading, setApprovalLoading] = useState(true)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [reviewBusy, setReviewBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<PendingCompany | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)

  // F1-009: fila de motoristas pendentes (ativação por interno).
  type PendingDriver = {
    user_id: string
    full_name: string
    cpf_normalized: string
    phone: string | null
  }
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([])
  const [driversLoading, setDriversLoading] = useState(true)
  const [driverBusy, setDriverBusy] = useState<string | null>(null)

  // F1-010: fila de vínculos empresa↔motorista/veículo pendentes (revisão interna).
  type PendingLink = {
    id: string
    kind: 'driver' | 'vehicle'
    company: { name: string } | null
    driver_name: string | null
    plate: string | null
  }
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [linkBusy, setLinkBusy] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  const loadPendingLinks = async () => {
    setLinksLoading(true)
    setLinkError(null)
    const [dRes, vRes] = await Promise.all([
      supabase
        .from('company_driver_links')
        .select('id, companies(name), drivers(full_name)')
        .eq('status', 'pending'),
      supabase
        .from('company_vehicle_links')
        .select('id, companies(name), vehicles(plate_normalized)')
        .eq('status', 'pending'),
    ])
    if (dRes.error || vRes.error) {
      setLinkError('Não foi possível carregar a fila de vínculos. Tente novamente.')
      setLinksLoading(false)
      return
    }
    const dRows = (
      (dRes.data ?? []) as Array<{
        id: string
        companies: { name: string } | null
        drivers: { full_name: string } | null
      }>
    ).map((r) => ({
      id: r.id,
      kind: 'driver' as const,
      company: r.companies,
      driver_name: r.drivers?.full_name ?? null,
      plate: null,
    }))
    const vRows = (
      (vRes.data ?? []) as Array<{
        id: string
        companies: { name: string } | null
        vehicles: { plate_normalized: string } | null
      }>
    ).map((r) => ({
      id: r.id,
      kind: 'vehicle' as const,
      company: r.companies,
      driver_name: null,
      plate: r.vehicles?.plate_normalized ?? null,
    }))
    setPendingLinks([...dRows, ...vRows])
    setLinksLoading(false)
  }

  const handleReviewLink = async (l: PendingLink, decision: 'active' | 'disabled') => {
    setLinkBusy(l.id)
    setLinkError(null)
    const { error } = await supabase.rpc('review_link', {
      p_link_id: l.id,
      p_decision: decision,
    })
    setLinkBusy(null)
    if (error) {
      setLinkError(error.message)
      return
    }
    await loadPendingLinks()
  }

  const loadPendingDrivers = async () => {
    setDriversLoading(true)
    const { data, error } = await supabase
      .from('drivers')
      .select('user_id, full_name, cpf_normalized, phone')
      .eq('company_link_status', 'pending')
      .order('created_at', { ascending: true })
    if (!error) {
      setPendingDrivers((data ?? []) as PendingDriver[])
    }
    setDriversLoading(false)
  }

  const handleDriverStatus = async (d: PendingDriver, status: 'active' | 'disabled') => {
    setDriverBusy(d.user_id)
    const { error } = await supabase.rpc('set_driver_status', {
      p_driver_user_id: d.user_id,
      p_status: status,
    })
    setDriverBusy(null)
    if (error) {
      setReviewError(error.message)
      return
    }
    await loadPendingDrivers()
  }

  const loadPendingCompanies = async () => {
    setApprovalLoading(true)
    setApprovalError(null)
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, cnpj_normalized, contact_name')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) {
      setApprovalError('Não foi possível carregar a fila de aprovação. Tente novamente.')
    } else {
      setPendingCompanies((data ?? []) as PendingCompany[])
    }
    setApprovalLoading(false)
  }

  const handleReview = async (
    pc: PendingCompany,
    decision: 'approve' | 'reject',
    reason?: string,
  ) => {
    setReviewBusy(pc.id)
    setReviewError(null)
    const { data, error } = await supabase.rpc('review_company', {
      p_company_id: pc.id,
      p_decision: decision,
      p_reason: reason ?? null,
    })
    setReviewBusy(null)
    if (error) {
      // Erro da revisão aparece NO CONTEXTO da ação (modal/fila), não no convite.
      setReviewError(error.message)
      return
    }
    void data
    setRejecting(null)
    setRejectReason('')
    await loadPendingCompanies()
  }

  const loadList = async () => {
    setListLoading(true)
    setListError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, role, status, full_name')
      .in('role', ['admin', 'operator'])
      .order('created_at', { ascending: true })
    if (error) {
      // Mensagem própria: não expõe detalhe técnico nem dado de terceiros.
      setListError('Não foi possível carregar a lista de internos. Tente novamente.')
    } else {
      setRows((data ?? []) as InternalRow[])
    }
    setListLoading(false)
  }

  useEffect(() => {
    loadList()
    loadPendingCompanies()
    loadPendingDrivers()
    loadPendingLinks()
  }, [])

  const callAdminFunction = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-manage-internal', { body })
    if (error) {
      return { ok: false, message: 'Falha de comunicação com o servidor. Tente novamente.' }
    }
    const r = data as { ok?: boolean; error?: string; message?: string; idempotent?: boolean }
    if (r && r.ok) {
      return { ok: true, message: r.message ?? 'Ação concluída.' }
    }
    return { ok: false, message: r?.error ?? 'A ação não pôde ser concluída.' }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteBusy(true)
    setInviteMsg(null)
    setInviteErr(null)
    const res = await callAdminFunction({
      action: 'invite',
      email: inviteEmail,
      full_name: inviteName,
      role: 'operator',
    })
    if (res.ok) {
      setInviteName('')
      setInviteEmail('')
      setInviteMsg(
        res.message.includes('já existe')
          ? 'Usuário já existia; nada foi alterado.'
          : 'Convite registrado. O operador nasce pendente e precisa ser ativado.',
      )
      await loadList()
    } else {
      setInviteErr(res.message)
    }
    setInviteBusy(false)
  }

  const handleSetStatus = async (row: InternalRow, status: 'active' | 'disabled') => {
    setActionBusy(row.user_id)
    const res = await callAdminFunction({ action: 'set_status', user_id: row.user_id, status })
    if (res.ok) {
      await loadList()
    }
    setActionBusy(null)
  }

  return (
    <HomeShell
      icon={<ShieldCheck className="w-8 h-8" />}
      title="Administração"
      subtitle="Gestão de internos do sistema: convite, ativação e desativação."
      email={email}
      accent="green"
      onLogout={onLogout}
    >
      {/* --- Convidar interno --- */}
      <section aria-labelledby="invite-heading" className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-[#16A34A]" />
          <h2 id="invite-heading" className="text-sm font-semibold text-[#F7F9F8]">
            Convidar operador
          </h2>
        </div>
        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label htmlFor="invite-name" className="sr-only">
              Nome do operador
            </label>
            <input
              id="invite-name"
              type="text"
              autoComplete="off"
              required
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Nome do operador"
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40"
            />
          </div>
          <div>
            <label htmlFor="invite-email" className="sr-only">
              E-mail do operador
            </label>
            <input
              id="invite-email"
              type="email"
              autoComplete="off"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@empresa.com.br"
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40"
            />
          </div>
          <button
            type="submit"
            disabled={inviteBusy}
            className="w-full h-11 rounded-xl bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
          >
            {inviteBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {inviteBusy ? 'Registrando convite...' : 'Convidar operador'}
          </button>
        </form>
        {inviteMsg && (
          <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {inviteMsg}
          </p>
        )}
        {inviteErr && (
          <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {inviteErr}
          </p>
        )}
        <p className="mt-3 text-[11px] text-[#8B9A97] leading-relaxed">
          O convite cria apenas operadores, que nascem pendentes. Administradores são criados por
          procedimento controlado — nunca por esta tela.
        </p>
      </section>

      {/* --- F1-008: Fila de aprovação de empresas --- */}
      <section aria-labelledby="approval-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#16A34A]" />
            <h2 id="approval-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Empresas aguardando aprovação
            </h2>
          </div>
          <button
            type="button"
            onClick={loadPendingCompanies}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar fila de aprovação"
          >
            <RefreshCw className={`w-4 h-4 ${approvalLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {approvalLoading && pendingCompanies.length === 0 ? (
          <p role="status" className="text-xs text-[#8B9A97] py-4 text-center">
            Carregando pedidos...
          </p>
        ) : approvalError ? (
          <div role="alert" className="p-3 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/5">
            <p className="text-xs text-[#DC2626]">{approvalError}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pendingCompanies.map((pc) => (
              <li key={pc.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#F7F9F8] truncate">{pc.name}</p>
                    <p className="text-[11px] text-[#8B9A97] mt-0.5 font-mono">
                      CNPJ {pc.cnpj_normalized || '—'} · {pc.contact_name || 'sem contato'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReview(pc, 'approve')}
                      disabled={reviewBusy === pc.id}
                      className="h-9 px-3 rounded-lg bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] text-xs font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
                    >
                      {reviewBusy === pc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Aprovar'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(pc)}
                      disabled={reviewBusy === pc.id}
                      className="h-9 px-3 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] text-xs font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {pendingCompanies.length === 0 && (
              <li className="text-xs text-[#8B9A97] py-4 text-center">
                Nenhuma empresa aguardando aprovação.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* --- F1-009: Motoristas aguardando ativação --- */}
      <section aria-labelledby="drivers-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#16A34A]" />
            <h2 id="drivers-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Motoristas aguardando ativação
            </h2>
          </div>
          <button
            type="button"
            onClick={loadPendingDrivers}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar motoristas"
          >
            <RefreshCw className={`w-4 h-4 ${driversLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {driversLoading && pendingDrivers.length === 0 ? (
          <p role="status" className="text-xs text-[#8B9A97] py-4 text-center">
            Carregando motoristas...
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingDrivers.map((d) => (
              <li
                key={d.user_id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F7F9F8] truncate">{d.full_name}</p>
                  <p className="text-[11px] text-[#8B9A97] font-mono">
                    CPF {d.cpf_normalized} · {d.phone || 'sem telefone'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDriverStatus(d, 'active')}
                    disabled={driverBusy === d.user_id}
                    className="h-9 px-3 rounded-lg bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] text-xs font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
                  >
                    {driverBusy === d.user_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Ativar'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDriverStatus(d, 'disabled')}
                    disabled={driverBusy === d.user_id}
                    className="h-9 px-3 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] text-xs font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                  >
                    Recusar
                  </button>
                </div>
              </li>
            ))}
            {pendingDrivers.length === 0 && (
              <li className="text-xs text-[#8B9A97] py-4 text-center">
                Nenhum motorista aguardando ativação.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* --- F1-010: Vínculos aguardando revisão --- */}
      <section aria-labelledby="links-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#16A34A]" />
            <h2 id="links-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Vínculos aguardando revisão
            </h2>
          </div>
          <button
            type="button"
            onClick={loadPendingLinks}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar vínculos"
          >
            <RefreshCw className={`w-4 h-4 ${linksLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {linkError && (
          <div
            role="alert"
            className="mb-2 p-3 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/5"
          >
            <p className="text-xs text-[#DC2626]">{linkError}</p>
          </div>
        )}

        {linksLoading && pendingLinks.length === 0 ? (
          <p role="status" className="text-xs text-[#8B9A97] py-4 text-center">
            Carregando vínculos...
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingLinks.map((l) => (
              <li
                key={l.id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F7F9F8] truncate">
                    {l.company?.name ?? 'Empresa'} ·{' '}
                    {l.kind === 'driver'
                      ? (l.driver_name ?? 'motorista')
                      : `veículo ${l.plate ?? '—'}`}
                  </p>
                  <p className="text-[11px] text-[#8B9A97]">
                    {l.kind === 'driver'
                      ? 'Vínculo empresa × motorista'
                      : 'Vínculo empresa × veículo'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReviewLink(l, 'active')}
                    disabled={linkBusy === l.id}
                    className="h-9 px-3 rounded-lg bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] text-xs font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
                  >
                    {linkBusy === l.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Aprovar'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewLink(l, 'disabled')}
                    disabled={linkBusy === l.id}
                    className="h-9 px-3 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] text-xs font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                  >
                    Recusar
                  </button>
                </div>
              </li>
            ))}
            {pendingLinks.length === 0 && (
              <li className="text-xs text-[#8B9A97] py-4 text-center">
                Nenhum vínculo aguardando revisão.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* --- Lista de internos --- */}
      <section aria-labelledby="internals-heading">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#16A34A]" />
            <h2 id="internals-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Internos
            </h2>
          </div>
          <button
            type="button"
            onClick={loadList}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar lista"
          >
            <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {listLoading && rows.length === 0 ? (
          <p role="status" className="text-xs text-[#8B9A97] py-4 text-center">
            Carregando internos...
          </p>
        ) : listError ? (
          <div role="alert" className="p-3 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/5">
            <p className="text-xs text-[#DC2626]">{listError}</p>
            <button
              type="button"
              onClick={loadList}
              className="mt-2 text-xs text-[#8B9A97] hover:text-[#F7F9F8] underline underline-offset-4"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const meta = statusMeta[row.status]
              const StatusIcon = meta.icon
              const isSelf = row.user_id === profile?.user_id
              return (
                <li
                  key={row.user_id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[#F7F9F8] truncate">
                      {row.full_name || 'Sem nome'}
                      {isSelf && <span className="text-[#8B9A97]"> (você)</span>}
                    </p>
                    <p className="text-[11px] text-[#8B9A97]">
                      {roleLabel[row.role]} ·{' '}
                      <span className={`inline-flex items-center gap-1 ${meta.cls}`}>
                        <StatusIcon className="w-3 h-3" /> {meta.label}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.status !== 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleSetStatus(row, 'active')}
                        disabled={actionBusy === row.user_id}
                        className="h-9 px-3 rounded-lg bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] text-xs font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
                      >
                        {actionBusy === row.user_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Ativar'
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetStatus(row, 'disabled')}
                        disabled={actionBusy === row.user_id || isSelf}
                        title={isSelf ? 'Você não pode desativar a si mesmo' : undefined}
                        className="h-9 px-3 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] text-xs font-semibold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                      >
                        {actionBusy === row.user_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Desativar'
                        )}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
            {rows.length === 0 && (
              <li className="text-xs text-[#8B9A97] py-4 text-center">
                Nenhum interno encontrado.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* --- F1-008: modal de rejeição com motivo obrigatório --- */}
      {rejecting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Rejeitar ${rejecting.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-[#F7F9F8]">Rejeitar cadastro</h3>
              <button
                type="button"
                onClick={() => {
                  setRejecting(null)
                  setRejectReason('')
                }}
                aria-label="Fechar"
                className="text-[#8B9A97] hover:text-[#F7F9F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[#8B9A97] mb-1">
              <span className="text-[#F7F9F8] font-medium">{rejecting.name}</span>
            </p>
            <p className="text-xs text-[#8B9A97] mb-4">
              O motivo fica registrado na auditoria e a empresa pode corrigir e solicitar de novo.
            </p>
            <label
              htmlFor="reject-reason"
              className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
            >
              Motivo da rejeição <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ex.: CNPJ não confere com o contato informado"
              className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/40"
            />
            {reviewError && (
              <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {reviewError}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={rejectReason.trim().length < 3 || reviewBusy === rejecting.id}
                onClick={() => handleReview(rejecting, 'reject', rejectReason.trim())}
                className="flex-1 h-11 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reviewBusy === rejecting.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar rejeição
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejecting(null)
                  setRejectReason('')
                }}
                className="h-11 px-4 rounded-xl border border-white/[0.08] text-[#8B9A97] hover:text-[#F7F9F8] text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </HomeShell>
  )
}

// ---------------------------------------------------------------------------
// Homes OPERADOR / EMPRESA / MOTORISTA — conteúdo por papel, sem ações
// administrativas (S105: operador não vê administração de internos).
// ---------------------------------------------------------------------------

export function OperatorHome({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  return (
    <HomeShell
      icon={<UserCog className="w-8 h-8" />}
      title="Operação"
      subtitle="Painel operacional do Posto Comboio. Funções operacionais chegam nas próximas fases."
      email={email}
      accent="blue"
      onLogout={onLogout}
    >
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-xs text-[#8B9A97] leading-relaxed">
          Sua home de operador está ativa. As funções operacionais (triagem, filas e check-in) serão
          liberadas nas fases seguintes do plano — nesta fase você confirma o acesso e o perfil
          correto.
        </p>
      </div>
    </HomeShell>
  )
}

export function CompanyHome({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  return (
    <HomeShell
      icon={<Building2 className="w-8 h-8" />}
      title="Sua empresa"
      subtitle="Área da empresa no Posto Comboio. Você vê apenas os dados da sua própria empresa."
      email={email}
      accent="purple"
      onLogout={onLogout}
    >
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-xs text-[#8B9A97] leading-relaxed">
          Isolamento ativo: consultas da sua conta só retornam o contexto da sua empresa — o acesso
          a dados de outras contas é negado pelo banco, mesmo por consulta direta.
        </p>
      </div>
    </HomeShell>
  )
}

export function DriverHome({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  // F1-010: "Meus veículos" — lista vínculos ativos (RLS: só o próprio) e
  // permite cadastrar/vincular veículo pela RPC (cria se não existir).
  type MyVehicle = {
    id: string
    valid_from: string
    vehicles: { plate_normalized: string; type: string } | null
  }
  const [myVehicles, setMyVehicles] = useState<MyVehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [plate, setPlate] = useState('')
  const [vType, setVType] = useState<'truck' | 'car' | 'motorcycle'>('truck')
  const [addBusy, setAddBusy] = useState(false)
  const [addMsg, setAddMsg] = useState<string | null>(null)
  const [addErr, setAddErr] = useState<string | null>(null)

  const loadMyVehicles = async () => {
    setVehiclesLoading(true)
    const { data, error } = await supabase
      .from('driver_vehicle_links')
      .select('id, valid_from, vehicles(plate_normalized, type)')
      .is('valid_to', null)
      .order('valid_from', { ascending: false })
    if (!error) {
      setMyVehicles((data ?? []) as MyVehicle[])
    }
    setVehiclesLoading(false)
  }

  useEffect(() => {
    loadMyVehicles()
  }, [])

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddBusy(true)
    setAddMsg(null)
    setAddErr(null)
    // 1) Registra o veículo (idempotente por placa; cria se não existir).
    const { error: regErr } = await supabase.rpc('register_vehicle', {
      p_plate: plate,
      p_type: vType,
    })
    if (regErr) {
      setAddErr(regErr.message)
      setAddBusy(false)
      return
    }
    // 2) Vincula a si mesmo (idempotente; reativa vínculo encerrado).
    const { error: linkErr } = await supabase.rpc('link_driver_vehicle', {
      p_plate: plate,
    })
    setAddBusy(false)
    if (linkErr) {
      setAddErr(linkErr.message)
      return
    }
    setPlate('')
    setAddMsg('Veículo vinculado ao seu cadastro.')
    await loadMyVehicles()
  }

  const typeLabel: Record<string, string> = {
    truck: 'Caminhão',
    car: 'Carro',
    motorcycle: 'Moto',
  }

  return (
    <HomeShell
      icon={<Truck className="w-8 h-8" />}
      title="Área do motorista"
      subtitle="Sua área no Posto Comboio. Você vê apenas os seus próprios dados."
      email={email}
      accent="amber"
      onLogout={onLogout}
    >
      {/* --- F1-010: Meus veículos --- */}
      <section aria-labelledby="my-vehicles-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#EAB308]" />
            <h2 id="my-vehicles-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Meus veículos
            </h2>
          </div>
          <button
            type="button"
            onClick={loadMyVehicles}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar veículos"
          >
            <RefreshCw className={`w-4 h-4 ${vehiclesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {vehiclesLoading && myVehicles.length === 0 ? (
          <p role="status" className="text-xs text-[#8B9A97] py-4 text-center">
            Carregando veículos...
          </p>
        ) : (
          <ul className="space-y-2">
            {myVehicles.map((mv) => (
              <li
                key={mv.id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3"
              >
                <p className="text-sm text-[#F7F9F8] font-mono truncate">
                  {mv.vehicles?.plate_normalized ?? '—'}
                </p>
                <p className="text-[11px] text-[#8B9A97] shrink-0">
                  {typeLabel[mv.vehicles?.type ?? 'truck']}
                </p>
              </li>
            ))}
            {myVehicles.length === 0 && (
              <li className="text-xs text-[#8B9A97] py-4 text-center">
                Nenhum veículo vinculado ainda.
              </li>
            )}
          </ul>
        )}

        <form onSubmit={handleAddVehicle} className="mt-4 space-y-3">
          <div>
            <label htmlFor="veh-plate" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
              Placa do veículo <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="veh-plate"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="ABC1D23"
              autoComplete="off"
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
            />
          </div>
          <div>
            <label htmlFor="veh-type" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
              Tipo
            </label>
            <select
              id="veh-type"
              value={vType}
              onChange={(e) => setVType(e.target.value as 'truck' | 'car' | 'motorcycle')}
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
            >
              <option value="truck">Caminhão</option>
              <option value="car">Carro</option>
              <option value="motorcycle">Moto</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={addBusy}
            className="w-full h-11 rounded-xl bg-[#EAB308]/10 hover:bg-[#EAB308]/20 border border-[#EAB308]/30 text-[#EAB308] font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAB308]"
          >
            {addBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {addBusy ? 'Vinculando...' : 'Vincular veículo'}
          </button>
        </form>
        {addMsg && (
          <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {addMsg}
          </p>
        )}
        {addErr && (
          <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {addErr}
          </p>
        )}
        <p className="mt-3 text-[11px] text-[#8B9A97] leading-relaxed">
          Placa já cadastrada é reaproveitada — nunca duplicada. Vínculo encerrado é reativado com o
          histórico preservado.
        </p>
      </section>

      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-xs text-[#8B9A97] leading-relaxed">
          Isolamento ativo: previsões e histórico chegam nas próximas fases; hoje você confirma o
          acesso, o perfil correto de motorista e seus veículos.
        </p>
      </div>
    </HomeShell>
  )
}
