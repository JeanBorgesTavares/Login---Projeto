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
  CalendarClock,
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

// F1-017 (debug do teste humano): erros crus de constraint viram mensagem de operador.
function msgAmigavel(msg: string): string {
  if (msg.includes('arrival_window_max')) {
    return 'Janela máxima de 4 horas — ajuste o início ou o fim.'
  }
  if (msg.includes('arrival_window_valid') || msg.includes('janela inválida')) {
    return 'Janela inválida — o fim deve ser depois do início.'
  }
  if (msg.includes('arrival_window_check') || msg.includes('passado')) {
    return 'A janela não pode começar no passado.'
  }
  return msg
}

// ---------------------------------------------------------------------------
// F1-015 · SPEC-F1-03 · CA-F1-03-02/03 · S303/S304
// Agenda interna: internos ativos (admin/operador) veem as previsões, decidem
// (confirmar / recusar com motivo / no-show após a janela) e criam previsão
// por terceiro. Toda decisão passa pela RPC review_arrival_request — RLS e
// auditoria ficam no banco; a tela nunca promete vaga.
// ---------------------------------------------------------------------------

function InternalAgenda() {
  type AgendaRow = {
    id: string
    kind: string
    status: string
    starts_at: string
    ends_at: string
    source: string
    version: number
    drivers: { full_name: string } | null
    vehicles: { plate_normalized: string } | null
  }
  const [rows, setRows] = useState<AgendaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<AgendaRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)

  // Criação por terceiro: interno cria previsão para motorista ativo com
  // veículo vinculado (validação completa na RPC — a tela só lista opções).
  const [drivers, setDrivers] = useState<Array<{ user_id: string; full_name: string }>>([])
  const [cDriver, setCDriver] = useState('')
  const [cVehicles, setCVehicles] = useState<Array<{ id: string; plate: string }>>([])
  const [cVehicle, setCVehicle] = useState('')
  const [cKind, setCKind] = useState<'parking' | 'triage'>('parking')
  const [cDate, setCDate] = useState('')
  const [cStart, setCStart] = useState('')
  const [cEnd, setCEnd] = useState('')
  const [cNotes, setCNotes] = useState('')
  const [cBusy, setCBusy] = useState(false)
  const [cMsg, setCMsg] = useState<string | null>(null)
  const [cErr, setCErr] = useState<string | null>(null)

  // F1-019: registrar chegada (check-in) — previsto ou espontâneo (walk-in).
  const [checkinRow, setCheckinRow] = useState<AgendaRow | null>(null)
  const [ciPlate, setCiPlate] = useState('')
  const [ciType, setCiType] = useState<'truck' | 'car' | 'motorcycle'>('truck')
  const [ciName, setCiName] = useState('')
  const [ciContact, setCiContact] = useState('')
  const [ciTicket, setCiTicket] = useState('')
  const [ciBusy, setCiBusy] = useState(false)
  const [ciErr, setCiErr] = useState<string | null>(null)
  const [ciMsg, setCiMsg] = useState<string | null>(null)

  // F1-020: reconciliação — vincular visita provisória a motorista validado
  // (mesmo visit.id, motivo obrigatório, correção de vínculo errado auditada).
  const [linkVisit, setLinkVisit] = useState<{
    id: string
    plate: string
    driverName: string | null
  } | null>(null)
  const [lkDriver, setLkDriver] = useState('')
  const [lkReason, setLkReason] = useState('')
  const [lkBusy, setLkBusy] = useState(false)
  const [lkErr, setLkErr] = useState<string | null>(null)
  const [lkMsg, setLkMsg] = useState<string | null>(null)

  const openLink = (v: {
    id: string
    plate_snapshot: string
    drivers: { full_name: string } | null
  }) => {
    setLinkVisit({ id: v.id, plate: v.plate_snapshot, driverName: v.drivers?.full_name ?? null })
    setLkDriver('')
    setLkReason('')
    setLkErr(null)
    setLkMsg(null)
  }

  // F1-021: check-out — saída única; dados incompletos exigem exceção com motivo.
  const [outVisit, setOutVisit] = useState<{ id: string; plate: string } | null>(null)
  const [outException, setOutException] = useState(false)
  const [outNote, setOutNote] = useState('')
  const [outBusy, setOutBusy] = useState(false)
  const [outErr, setOutErr] = useState<string | null>(null)
  const [outMsg, setOutMsg] = useState<string | null>(null)

  const openCheckout = (v: { id: string; plate_snapshot: string }) => {
    setOutVisit({ id: v.id, plate: v.plate_snapshot })
    setOutException(false)
    setOutNote('')
    setOutErr(null)
    setOutMsg(null)
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setOutBusy(true)
    setOutErr(null)
    setOutMsg(null)
    const { data, error: err } = await supabase.rpc('check_out_visit', {
      p_visit_id: outVisit?.id ?? null,
      p_release_state: outException ? 'exception' : 'recorded',
      p_release_note: outNote || null,
    })
    setOutBusy(false)
    if (err) {
      setOutErr(err.message)
      return
    }
    // Sucesso fecha o modal — a visita saindo da lista é a confirmação.
    setOutVisit(null)
    await loadVisits()
  }

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLkBusy(true)
    setLkErr(null)
    setLkMsg(null)
    const { data, error: err } = await supabase.rpc('link_visit_driver', {
      p_visit_id: linkVisit?.id ?? null,
      p_driver_user_id: lkDriver || null,
      p_reason: lkReason,
    })
    setLkBusy(false)
    if (err) {
      setLkErr(err.message)
      return
    }
    // Sucesso fecha o modal — o espelho recarregado é a confirmação.
    setLinkVisit(null)
    await loadVisits()
  }

  // F1-019 (ajuste do teste humano): espelho de quem está presente no pátio.
  const [visits, setVisits] = useState<
    Array<{
      id: string
      plate_snapshot: string
      vehicle_type: string
      status: string
      arrived_at: string | null
      provisional_driver_name: string | null
      drivers: { full_name: string } | null
    }>
  >([])
  const [vLoading, setVLoading] = useState(true)
  const [vError, setVError] = useState<string | null>(null)

  const loadVisits = async () => {
    setVLoading(true)
    setVError(null)
    const { data, error: err } = await supabase
      .from('visits')
      .select(
        'id, plate_snapshot, vehicle_type, status, arrived_at, provisional_driver_name, drivers(full_name)',
      )
      .eq('status', 'inside')
      .order('arrived_at', { ascending: false })
    if (err) {
      setVError('Não foi possível carregar as visitas presentes.')
    } else {
      setVisits(
        (data ?? []) as Array<{
          id: string
          plate_snapshot: string
          vehicle_type: string
          status: string
          arrived_at: string | null
          provisional_driver_name: string | null
          drivers: { full_name: string } | null
        }>,
      )
    }
    setVLoading(false)
  }

  const statusMeta: Record<string, { label: string; cls: string }> = {
    requested: { label: 'Solicitada', cls: 'text-[#EAB308]' },
    confirmed: { label: 'Confirmada', cls: 'text-[#16A34A]' },
    rejected: { label: 'Recusada', cls: 'text-[#DC2626]' },
    cancelled: { label: 'Cancelada', cls: 'text-[#8B9A97]' },
    no_show: { label: 'Não compareceu', cls: 'text-[#DC2626]' },
    arrived: { label: 'Chegou', cls: 'text-[#16A34A]' },
  }

  const sourceLabel: Record<string, string> = {
    driver: 'motorista',
    company: 'empresa',
    internal: 'interno',
  }

  const fmtWindow = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  const load = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('arrival_requests')
      .select(
        'id, kind, status, starts_at, ends_at, source, version, drivers(full_name), vehicles(plate_normalized)',
      )
      .order('starts_at', { ascending: true })
    if (err) {
      setError('Não foi possível carregar a agenda. Tente novamente.')
    } else {
      setRows((data ?? []) as AgendaRow[])
    }
    setLoading(false)
  }

  const loadDrivers = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('user_id, full_name')
      .order('full_name', { ascending: true })
    if (data) {
      setDrivers((data as Array<{ user_id: string; full_name: string }>).filter((d) => d.full_name))
    }
  }

  const loadVehicles = async (driverUserId: string) => {
    setCVehicle('')
    setCVehicles([])
    if (!driverUserId) return
    const { data } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', driverUserId)
      .maybeSingle()
    if (!data) return
    const { data: links } = await supabase
      .from('driver_vehicle_links')
      .select('vehicles(id, plate_normalized)')
      .eq('driver_id', data.id)
      .is('valid_to', null)
    const list = (
      (links ?? []) as Array<{ vehicles: { id: string; plate_normalized: string } | null }>
    )
      .filter((l) => l.vehicles)
      .map((l) => ({ id: l.vehicles!.id, plate: l.vehicles!.plate_normalized }))
    setCVehicles(list)
  }

  const handleDecision = async (
    r: AgendaRow,
    decision: 'confirm' | 'refuse' | 'no_show',
    reason?: string,
  ) => {
    setBusy(r.id)
    setRejectError(null)
    setError(null)
    const { error: err } = await supabase.rpc('review_arrival_request', {
      p_request_id: r.id,
      p_decision: decision,
      p_reason: reason ?? null,
      p_version: r.version,
    })
    setBusy(null)
    if (err) {
      if (decision === 'refuse' || decision === 'reopen') {
        setRejectError(err.message)
      } else {
        setError(err.message)
      }
      // S306: conflito de versão — recarrega a agenda para mostrar o estado real.
      if (err.message.toLowerCase().includes('conflito')) {
        await load()
      }
      return
    }
    setRejecting(null)
    setRejectReason('')
    await load()
  }

  const openCheckin = (r: AgendaRow) => {
    setCheckinRow(r)
    setCiPlate(r.vehicles?.plate_normalized ?? '')
    setCiType('truck')
    setCiName('')
    setCiContact('')
    setCiTicket('')
    setCiErr(null)
    setCiMsg(null)
  }

  const openWalkin = () => {
    setCheckinRow({
      id: '',
      kind: '',
      status: '',
      starts_at: '',
      ends_at: '',
      source: '',
      version: 0,
      drivers: null,
      vehicles: null,
    })
    setCiPlate('')
    setCiType('truck')
    setCiName('')
    setCiContact('')
    setCiTicket('')
    setCiErr(null)
    setCiMsg(null)
  }

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCiBusy(true)
    setCiErr(null)
    setCiMsg(null)
    const key = checkinRow?.id ? `req:${checkinRow.id}` : `walkin:${ciPlate}:${Date.now()}`
    const { data, error: err } = await supabase.rpc('check_in_visit', {
      p_arrival_request_id: checkinRow?.id || null,
      p_plate: ciPlate || null,
      p_vehicle_type: ciType,
      p_provisional_name: ciName || null,
      p_provisional_contact: ciContact || null,
      p_ticket: ciTicket || null,
      p_idempotency_key: key,
    })
    setCiBusy(false)
    if (err) {
      setCiErr(err.message)
      return
    }
    // Sucesso fecha o modal — o espelho recarregado é a confirmação.
    setCheckinRow(null)
    await load()
    void loadVisits()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCBusy(true)
    setCMsg(null)
    setCErr(null)
    const startsIso = new Date(`${cDate}T${cStart}:00`).toISOString()
    const endsIso = new Date(`${cDate}T${cEnd}:00`).toISOString()
    const { error: err } = await supabase.rpc('create_arrival_request', {
      p_vehicle_id: cVehicle,
      p_kind: cKind,
      p_starts_at: startsIso,
      p_ends_at: endsIso,
      p_notes: cNotes || null,
      p_driver_user_id: cDriver,
    })
    setCBusy(false)
    if (err) {
      setCErr(msgAmigavel(err.message))
      return
    }
    setCDate('')
    setCStart('')
    setCEnd('')
    setCDriver('')
    setCNotes('')
    setCVehicles([])
    setCMsg('Previsão criada em nome do motorista. Ela nasce solicitada — não é garantia de vaga.')
    await load()
  }

  useEffect(() => {
    void load()
    void loadDrivers()
    void loadVisits()
  }, [])

  return (
    <section aria-labelledby="agenda-heading" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#16A34A]" />
          <h2 id="agenda-heading" className="text-sm font-semibold text-[#F7F9F8]">
            Agenda de previsões
          </h2>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
          aria-label="Recarregar agenda"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-2 p-3 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/5">
          <p className="text-xs text-[#DC2626]">{error}</p>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <p role="status" className="text-xs text-[#8B9A97] py-4 text-center">
          Carregando agenda...
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const meta = statusMeta[r.status] ?? { label: r.status, cls: 'text-[#8B9A97]' }
            const canDecide = r.status === 'requested'
            const canNoShow = r.status === 'confirmed' && new Date(r.ends_at) < new Date()
            return (
              <li key={r.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#F7F9F8] truncate">
                      {r.drivers?.full_name ?? '—'}
                      <span className="text-[#8B9A97]"> · </span>
                      <span className="font-mono">{r.vehicles?.plate_normalized ?? '—'}</span>
                    </p>
                    <p className="text-[11px] text-[#8B9A97] mt-0.5">
                      {r.kind === 'parking' ? 'Estacionamento' : 'Triagem'} · por{' '}
                      {sourceLabel[r.source] ?? r.source} · {fmtWindow(r.starts_at)} →{' '}
                      {fmtWindow(r.ends_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
                    {canDecide && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDecision(r, 'confirm')}
                          disabled={busy === r.id}
                          className="h-8 px-2.5 rounded-lg bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] text-[11px] font-semibold transition-all disabled:opacity-50"
                        >
                          {busy === r.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Confirmar'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejecting(r)
                            setRejectReason('')
                            setRejectError(null)
                          }}
                          disabled={busy === r.id}
                          className="h-8 px-2.5 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] text-[11px] font-semibold transition-all disabled:opacity-50"
                        >
                          Recusar
                        </button>
                      </>
                    )}
                    {canNoShow && (
                      <button
                        type="button"
                        onClick={() => handleDecision(r, 'no_show')}
                        disabled={busy === r.id}
                        className="h-8 px-2.5 rounded-lg bg-[#EAB308]/10 hover:bg-[#EAB308]/20 border border-[#EAB308]/30 text-[#EAB308] text-[11px] font-semibold transition-all disabled:opacity-50"
                      >
                        {busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'No-show'}
                      </button>
                    )}
                    {r.status === 'confirmed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openCheckin(r)}
                          disabled={busy === r.id}
                          className="h-8 px-2.5 rounded-lg bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-[#3B82F6] text-[11px] font-semibold transition-all disabled:opacity-50"
                        >
                          {busy === r.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Registrar chegada'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejecting(r)
                            setRejectReason('')
                            setRejectError(null)
                          }}
                          disabled={busy === r.id}
                          className="h-8 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-[#8B9A97] text-[11px] font-semibold transition-all disabled:opacity-50"
                        >
                          Reabrir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
          {rows.length === 0 && (
            <li className="text-xs text-[#8B9A97] py-4 text-center">Nenhuma previsão na agenda.</li>
          )}
        </ul>
      )}

      {/* --- F1-022: painel de ocupação (S406 — conta só visitas abertas) --- */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { type: 'truck', label: 'Caminhões', ref: 500 },
          { type: 'car', label: 'Carros', ref: 100 },
          { type: 'motorcycle', label: 'Motos', ref: 100 },
        ].map((t) => {
          const n = visits.filter((v) => v.vehicle_type === t.type).length
          return (
            <div
              key={t.type}
              className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center"
            >
              <p className="text-xl font-extrabold text-[#F7F9F8]">{n}</p>
              <p className="text-[11px] text-[#8B9A97] mt-0.5">{t.label}</p>
              <p className="text-[10px] text-[#8B9A97]/60">capac. ref. {t.ref}</p>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] text-[#8B9A97]/70">
        Ocupação conta apenas veículos presentes (visitas abertas). Capacidade é referência
        operacional, não garantia de vaga.
      </p>

      {/* --- F1-019: espelho de quem está presente no pátio agora --- */}
      <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#F7F9F8] flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-[#3B82F6]" />
            Visitas no pátio agora ({visits.length})
          </p>
          <button
            type="button"
            onClick={loadVisits}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar visitas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${vLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {vError ? (
          <p role="alert" className="text-xs text-[#DC2626]">
            {vError}
          </p>
        ) : visits.length === 0 ? (
          <p className="text-xs text-[#8B9A97]">Nenhum veículo presente no pátio.</p>
        ) : (
          <ul className="space-y-1.5">
            {visits.map((v) => (
              <li key={v.id} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-[#F7F9F8]">{v.plate_snapshot}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openCheckout(v)}
                      className="h-7 px-2 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] text-[11px] font-semibold transition-all"
                    >
                      Registrar saída
                    </button>
                    {!v.drivers && (
                      <button
                        type="button"
                        onClick={() => openLink(v)}
                        className="h-7 px-2 rounded-lg bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#8B5CF6] text-[11px] font-semibold transition-all"
                      >
                        Vincular motorista
                      </button>
                    )}
                    {v.drivers && (
                      <button
                        type="button"
                        onClick={() => openLink(v)}
                        className="h-7 px-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-[#8B9A97] text-[11px] font-semibold transition-all"
                      >
                        Corrigir vínculo
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#8B9A97] mt-1 truncate">
                  {v.drivers?.full_name ?? v.provisional_driver_name ?? '—'} ·{' '}
                  {v.vehicle_type === 'truck'
                    ? 'Caminhão'
                    : v.vehicle_type === 'car'
                      ? 'Carro'
                      : 'Moto'}
                  {v.arrived_at
                    ? ` · ${new Date(v.arrived_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleCreate} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="agenda-driver"
            className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
          >
            Motorista <span className="text-[#DC2626]">*</span>
          </label>
          <select
            id="agenda-driver"
            value={cDriver}
            onChange={(e) => {
              setCDriver(e.target.value)
              void loadVehicles(e.target.value)
            }}
            required
            className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40"
          >
            <option value="">Selecione</option>
            {drivers.map((d) => (
              <option key={d.user_id} value={d.user_id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="agenda-vehicle"
            className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
          >
            Veículo do motorista <span className="text-[#DC2626]">*</span>
          </label>
          <select
            id="agenda-vehicle"
            value={cVehicle}
            onChange={(e) => setCVehicle(e.target.value)}
            required
            disabled={!cDriver}
            className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 disabled:opacity-50"
          >
            <option value="">{cDriver ? 'Selecione' : 'Escolha o motorista primeiro'}</option>
            {cVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="agenda-kind" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
            Finalidade
          </label>
          <select
            id="agenda-kind"
            value={cKind}
            onChange={(e) => setCKind(e.target.value as 'parking' | 'triage')}
            className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40"
          >
            <option value="parking">Estacionamento</option>
            <option value="triage">Triagem</option>
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3">
            <label
              htmlFor="agenda-date"
              className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
            >
              Data <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="agenda-date"
              type="date"
              value={cDate}
              onChange={(e) => setCDate(e.target.value)}
              required
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40"
            />
          </div>
          <div>
            <label
              htmlFor="agenda-start"
              className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
            >
              Início <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="agenda-start"
              type="time"
              value={cStart}
              onChange={(e) => setCStart(e.target.value)}
              required
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40"
            />
          </div>
          <div>
            <label htmlFor="agenda-end" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
              Fim <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="agenda-end"
              type="time"
              value={cEnd}
              onChange={(e) => setCEnd(e.target.value)}
              required
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40"
            />
          </div>
        </div>
        <div>
          <label htmlFor="agenda-notes" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
            Observação (opcional)
          </label>
          <input
            id="agenda-notes"
            value={cNotes}
            onChange={(e) => setCNotes(e.target.value)}
            placeholder="Ex.: nota do pedido, produto, referência"
            className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40"
          />
        </div>
        <button
          type="submit"
          disabled={cBusy}
          className="w-full h-11 rounded-xl bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {cBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {cBusy ? 'Criando...' : 'Criar previsão para o motorista'}
        </button>
      </form>
      {cMsg && (
        <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> {cMsg}
        </p>
      )}
      {cErr && (
        <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> {cErr}
        </p>
      )}
      <p className="mt-3 text-[11px] text-[#8B9A97] leading-relaxed">
        Previsão não é garantia de vaga. Recusa exige motivo e tudo fica auditado (quem decidiu,
        quando e por quê). No-show só após o fim da janela.
      </p>

      {/* --- F1-019: botão de chegada espontânea + modal de check-in --- */}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={openWalkin}
          className="h-10 px-4 rounded-xl bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-[#3B82F6] text-sm font-semibold transition-all"
        >
          Registrar chegada espontânea
        </button>
      </div>

      {checkinRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registrar chegada"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-[#F7F9F8]">
                {checkinRow.id ? 'Registrar chegada (previsto)' : 'Registrar chegada espontânea'}
              </h3>
              <button
                type="button"
                onClick={() => setCheckinRow(null)}
                aria-label="Fechar"
                className="text-[#8B9A97] hover:text-[#F7F9F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#8B9A97] mb-4">
              {checkinRow.id
                ? 'Confirme a placa do veículo que chegou. A previsão vira "Chegou" e o veículo fica presente no pátio.'
                : 'Veículo sem previsão. Placa e tipo são obrigatórios; nome/contato ficam provisórios até a reconciliação.'}
            </p>
            <form onSubmit={handleCheckin} className="space-y-3">
              <div>
                <label
                  htmlFor="ci-plate"
                  className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
                >
                  Placa <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="ci-plate"
                  value={ciPlate}
                  onChange={(e) => setCiPlate(e.target.value)}
                  placeholder="ABC1D23"
                  required
                  disabled={!!checkinRow.id}
                  className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="ci-type"
                  className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
                >
                  Tipo
                </label>
                <select
                  id="ci-type"
                  value={ciType}
                  onChange={(e) => setCiType(e.target.value as 'truck' | 'car' | 'motorcycle')}
                  className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                >
                  <option value="truck">Caminhão</option>
                  <option value="car">Carro</option>
                  <option value="motorcycle">Moto</option>
                </select>
              </div>
              {!checkinRow.id && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="ci-contact"
                      className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
                    >
                      Contato (provisório)
                    </label>
                    <input
                      id="ci-contact"
                      value={ciContact}
                      onChange={(e) => setCiContact(e.target.value)}
                      placeholder="Telefone/WhatsApp"
                      className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                    />
                  </div>
                </div>
              )}
              <div>
                <label
                  htmlFor="ci-ticket"
                  className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
                >
                  Ticket de referência
                </label>
                <input
                  id="ci-ticket"
                  value={ciTicket}
                  onChange={(e) => setCiTicket(e.target.value)}
                  placeholder="Opcional"
                  className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                />
              </div>
              {ciErr && (
                <p role="alert" className="text-xs text-[#DC2626] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {ciErr}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={ciBusy}
                  className="flex-1 h-11 rounded-xl bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-[#3B82F6] font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {ciBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Registrar chegada
                </button>
                <button
                  type="button"
                  onClick={() => setCheckinRow(null)}
                  className="h-11 px-4 rounded-xl border border-white/[0.08] text-[#8B9A97] hover:text-[#F7F9F8] text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
            {ciMsg && (
              <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> {ciMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* --- F1-021: modal de check-out (saída normal ou exceção) --- */}
      {outVisit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registrar saída"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-[#F7F9F8]">Registrar saída</h3>
              <button
                type="button"
                onClick={() => setOutVisit(null)}
                aria-label="Fechar"
                className="text-[#8B9A97] hover:text-[#F7F9F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#8B9A97] mb-4">
              Visita da placa <span className="font-mono text-[#F7F9F8]">{outVisit.plate}</span>. A
              saída é única — reenvio não cria segunda saída.
            </p>
            <form onSubmit={handleCheckout} className="space-y-3">
              <label className="flex items-center gap-2 text-xs text-[#F7F9F8]">
                <input
                  type="checkbox"
                  checked={outException}
                  onChange={(e) => setOutException(e.target.checked)}
                  className="w-4 h-4 accent-[#EAB308]"
                />
                Saída com exceção (dados/acerto incompletos)
              </label>
              <div>
                <label
                  htmlFor="out-note"
                  className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
                >
                  {outException ? (
                    <>
                      Motivo da exceção <span className="text-[#DC2626]">*</span>
                    </>
                  ) : (
                    'Observação (opcional)'
                  )}
                </label>
                <input
                  id="out-note"
                  value={outNote}
                  onChange={(e) => setOutNote(e.target.value)}
                  placeholder={
                    outException ? 'Ex.: sem acerto completo no caixa' : 'Ex.: pagamento conferido'
                  }
                  required={outException}
                  minLength={outException ? 3 : 0}
                  className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/40"
                />
              </div>
              {outErr && (
                <p role="alert" className="text-xs text-[#DC2626] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {outErr}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={outBusy}
                  className="flex-1 h-11 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {outBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirmar saída
                </button>
                <button
                  type="button"
                  onClick={() => setOutVisit(null)}
                  className="h-11 px-4 rounded-xl border border-white/[0.08] text-[#8B9A97] hover:text-[#F7F9F8] text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
            {outMsg && (
              <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> {outMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* --- F1-020: modal de reconciliação (vincular/corrigir motorista) --- */}
      {linkVisit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vincular motorista à visita"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-[#F7F9F8]">
                {linkVisit.driverName
                  ? 'Corrigir vínculo da visita'
                  : 'Vincular motorista à visita'}
              </h3>
              <button
                type="button"
                onClick={() => setLinkVisit(null)}
                aria-label="Fechar"
                className="text-[#8B9A97] hover:text-[#F7F9F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#8B9A97] mb-4">
              Visita da placa <span className="font-mono text-[#F7F9F8]">{linkVisit.plate}</span>
              {linkVisit.driverName ? (
                <>
                  {' '}
                  atualmente vinculada a{' '}
                  <span className="text-[#F7F9F8]">{linkVisit.driverName}</span>. A correção fica
                  auditada com seu nome e motivo.
                </>
              ) : (
                ' — sem motorista validado. A reconciliação preserva o mesmo ID e o histórico da visita.'
              )}
            </p>
            <form onSubmit={handleLink} className="space-y-3">
              <div>
                <label
                  htmlFor="lk-driver"
                  className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
                >
                  Motorista <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  id="lk-driver"
                  value={lkDriver}
                  onChange={(e) => setLkDriver(e.target.value)}
                  required
                  className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
                >
                  <option value="">Selecione</option>
                  {drivers.map((d) => (
                    <option key={d.user_id} value={d.user_id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="lk-reason"
                  className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
                >
                  Motivo <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="lk-reason"
                  value={lkReason}
                  onChange={(e) => setLkReason(e.target.value)}
                  placeholder="Ex.: motorista identificado no guichê"
                  required
                  minLength={3}
                  className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
                />
              </div>
              {lkErr && (
                <p role="alert" className="text-xs text-[#DC2626] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {lkErr}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={lkBusy}
                  className="flex-1 h-11 rounded-xl bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#8B5CF6] font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {lkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirmar vínculo
                </button>
                <button
                  type="button"
                  onClick={() => setLinkVisit(null)}
                  className="h-11 px-4 rounded-xl border border-white/[0.08] text-[#8B9A97] hover:text-[#F7F9F8] text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
            {lkMsg && (
              <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> {lkMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* --- Modal de recusa com motivo obrigatório --- */}
      {rejecting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${
            rejecting.status === 'confirmed' ? 'Reabrir' : 'Recusar'
          } previsão de ${rejecting.drivers?.full_name ?? 'motorista'}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-[#F7F9F8]">
                {rejecting.status === 'confirmed' ? 'Reabrir previsão' : 'Recusar previsão'}
              </h3>
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
            <p className="text-sm text-[#8B9A97] mb-4">
              <span className="text-[#F7F9F8] font-medium">
                {rejecting.drivers?.full_name ?? '—'}
              </span>{' '}
              · <span className="font-mono">{rejecting.vehicles?.plate_normalized ?? '—'}</span>
            </p>
            <label
              htmlFor="agenda-reject-reason"
              className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
            >
              Motivo da recusa <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              id="agenda-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder={
                rejecting.status === 'confirmed'
                  ? 'Ex.: confirmação acidental'
                  : 'Ex.: pátio sem capacidade na janela solicitada'
              }
              className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/40"
            />
            {rejectError && (
              <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {rejectError}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={rejectReason.trim().length < 3 || busy === rejecting.id}
                onClick={() =>
                  handleDecision(
                    rejecting,
                    rejecting.status === 'confirmed' ? 'reopen' : 'refuse',
                    rejectReason.trim(),
                  )
                }
                className="flex-1 h-11 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy === rejecting.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {rejecting.status === 'confirmed' ? 'Confirmar reabertura' : 'Confirmar recusa'}
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
    </section>
  )
}

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

  const handleReviewLink = async (l: PendingLink, decision: 'approve' | 'refuse') => {
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
                    onClick={() => handleReviewLink(l, 'approve')}
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
                    onClick={() => handleReviewLink(l, 'refuse')}
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

      {/* --- F1-015: Agenda de previsões (decisão e criação por terceiro) --- */}
      <InternalAgenda />

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
      {/* --- F1-015: Agenda de previsões também na home do operador --- */}
      <InternalAgenda />
    </HomeShell>
  )
}

export function CompanyHome({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  // F1-014: Previsões da frota — a empresa cria previsões SOMENTE para seus
  // vínculos ativos (motorista vinculado à empresa; veículo vinculado ao
  // motorista). Validação completa no banco (RPC); a tela só lista opções.
  type FleetRequest = {
    id: string
    kind: string
    status: string
    starts_at: string
    ends_at: string
    drivers: { full_name: string } | null
    vehicles: { plate_normalized: string } | null
  }
  type FleetDriver = {
    user_id: string
    full_name: string
  }
  const [fleetRequests, setFleetRequests] = useState<FleetRequest[]>([])
  const [fleetDrivers, setFleetDrivers] = useState<FleetDriver[]>([])
  const [fleetLoading, setFleetLoading] = useState(true)
  const [fDriver, setFDriver] = useState('')
  const [fVehicle, setFVehicle] = useState('')
  const [fVehicles, setFVehicles] = useState<Array<{ id: string; plate: string }>>([])
  const [fKind, setFKind] = useState<'parking' | 'triage'>('parking')
  const [fDate, setFDate] = useState('')
  const [fStart, setFStart] = useState('')
  const [fEnd, setFEnd] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [fBusy, setFBusy] = useState(false)
  const [fMsg, setFMsg] = useState<string | null>(null)
  const [fErr, setFErr] = useState<string | null>(null)

  // F1-024 (piloto): vínculos pendentes — motorista pediu por CNPJ; empresa confirma.
  type PendingLink = { link_id: string; driver_name: string }
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [plBusy, setPlBusy] = useState<string | null>(null)
  const [plErr, setPlErr] = useState<string | null>(null)

  const loadFleet = async () => {
    setFleetLoading(true)
    const [reqRes, drvRes] = await Promise.all([
      supabase
        .from('arrival_requests')
        .select(
          'id, kind, status, starts_at, ends_at, drivers(full_name), vehicles(plate_normalized)',
        )
        .order('starts_at', { ascending: true }),
      supabase
        .from('company_driver_links')
        .select('drivers(user_id, full_name)')
        .eq('status', 'active'),
    ])
    if (!reqRes.error) {
      setFleetRequests((reqRes.data ?? []) as FleetRequest[])
    }
    if (!drvRes.error) {
      const rows = ((drvRes.data ?? []) as Array<{ drivers: FleetDriver | null }>)
        .filter((r) => r.drivers)
        .map((r) => r.drivers as FleetDriver)
      setFleetDrivers(rows)
    }
    setFleetLoading(false)
  }

  const loadFleetVehicles = async (driverUserId: string) => {
    setFVehicle('')
    setFVehicles([])
    if (!driverUserId) return
    // Veículos do motorista via vínculos (RLS: empresa vê só o próprio contexto).
    const { data } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', driverUserId)
      .maybeSingle()
    if (!data) return
    const { data: links } = await supabase
      .from('driver_vehicle_links')
      .select('vehicles(id, plate_normalized)')
      .eq('driver_id', data.id)
      .is('valid_to', null)
    const rows = (
      (links ?? []) as Array<{ vehicles: { id: string; plate_normalized: string } | null }>
    )
      .filter((l) => l.vehicles)
      .map((l) => ({ id: l.vehicles!.id, plate: l.vehicles!.plate_normalized }))
    setFVehicles(rows)
  }

  const loadPendingLinks = async () => {
    const { data, error } = await supabase.rpc('company_pending_driver_links')
    if (!error) {
      setPendingLinks((data ?? []) as PendingLink[])
    }
  }

  const handleConfirmLink = async (linkId: string, decision: 'approve' | 'refuse') => {
    setPlBusy(linkId)
    setPlErr(null)
    const { error } = await supabase.rpc('company_confirm_driver_link', {
      p_link_id: linkId,
      p_decision: decision,
      p_reason: decision === 'refuse' ? 'recusado pela empresa' : null,
    })
    setPlBusy(null)
    if (error) {
      setPlErr(error.message)
      return
    }
    await Promise.all([loadPendingLinks(), loadFleet()])
  }

  useEffect(() => {
    loadFleet()
    loadPendingLinks()
  }, [])

  const handleFleetCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFBusy(true)
    setFMsg(null)
    setFErr(null)
    const startsIso = new Date(`${fDate}T${fStart}:00`).toISOString()
    const endsIso = new Date(`${fDate}T${fEnd}:00`).toISOString()
    const { error } = await supabase.rpc('create_arrival_request', {
      p_vehicle_id: fVehicle,
      p_kind: fKind,
      p_starts_at: startsIso,
      p_ends_at: endsIso,
      p_notes: fNotes || null,
      p_driver_user_id: fDriver,
    })
    setFBusy(false)
    if (error) {
      setFErr(msgAmigavel(error.message))
      return
    }
    setFDate('')
    setFStart('')
    setFEnd('')
    setFDriver('')
    setFNotes('')
    setFVehicles([])
    setFMsg('Previsão solicitada para o motorista vinculado. Aguarde a confirmação da equipe.')
    await loadFleet()
  }

  const fleetStatusMeta: Record<string, { label: string; cls: string }> = {
    requested: { label: 'Solicitada', cls: 'text-[#EAB308]' },
    confirmed: { label: 'Confirmada', cls: 'text-[#16A34A]' },
    rejected: { label: 'Recusada', cls: 'text-[#DC2626]' },
    cancelled: { label: 'Cancelada', cls: 'text-[#8B9A97]' },
    no_show: { label: 'Não compareceu', cls: 'text-[#DC2626]' },
    arrived: { label: 'Chegou', cls: 'text-[#16A34A]' },
  }

  const fmtWindow = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <HomeShell
      icon={<Building2 className="w-8 h-8" />}
      title="Sua empresa"
      subtitle="Área da empresa no Posto Comboio. Você vê apenas os dados da sua própria empresa."
      email={email}
      accent="purple"
      onLogout={onLogout}
    >
      {/* --- F1-024: Motoristas aguardando confirmação --- */}
      <section aria-labelledby="pending-links-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#8B5CF6]" />
            <h2 id="pending-links-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Motoristas aguardando confirmação
            </h2>
          </div>
          <button
            type="button"
            onClick={loadPendingLinks}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar vínculos pendentes"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {pendingLinks.length === 0 ? (
          <p className="text-xs text-[#8B9A97] py-2 text-center">
            Nenhum motorista aguardando confirmação.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingLinks.map((pl) => (
              <li
                key={pl.link_id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[#F7F9F8] truncate">{pl.driver_name}</p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleConfirmLink(pl.link_id, 'approve')}
                      disabled={plBusy === pl.link_id}
                      className="h-9 px-3 rounded-lg bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] font-semibold text-xs transition-all disabled:opacity-50"
                    >
                      {plBusy === pl.link_id ? '...' : 'Confirmar frota'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmLink(pl.link_id, 'refuse')}
                      disabled={plBusy === pl.link_id}
                      className="h-9 px-3 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-semibold text-xs transition-all disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {plErr && (
          <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {plErr}
          </p>
        )}
      </section>

      {/* --- F1-014: Previsões da frota --- */}
      <section aria-labelledby="fleet-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#8B5CF6]" />
            <h2 id="fleet-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Previsões da frota
            </h2>
          </div>
          <button
            type="button"
            onClick={loadFleet}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar previsões"
          >
            <RefreshCw className={`w-4 h-4 ${fleetLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {fleetLoading && fleetRequests.length === 0 ? (
          <p role="status" className="text-xs text-[#8B9A97] py-4 text-center">
            Carregando previsões...
          </p>
        ) : (
          <ul className="space-y-2">
            {fleetRequests.map((r) => {
              const meta = fleetStatusMeta[r.status] ?? { label: r.status, cls: 'text-[#8B9A97]' }
              return (
                <li
                  key={r.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[#F7F9F8] truncate">
                        {r.drivers?.full_name ?? '—'}
                        <span className="text-[#8B9A97]"> · </span>
                        <span className="font-mono">{r.vehicles?.plate_normalized ?? '—'}</span>
                      </p>
                      <p className="text-[11px] text-[#8B9A97] mt-0.5">
                        {r.kind === 'parking' ? 'Estacionamento' : 'Triagem'} ·{' '}
                        {fmtWindow(r.starts_at)} → {fmtWindow(r.ends_at)}
                      </p>
                    </div>
                    <span className={`text-[11px] font-semibold shrink-0 ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                </li>
              )
            })}
            {fleetRequests.length === 0 && (
              <li className="text-xs text-[#8B9A97] py-4 text-center">
                Nenhuma previsão da frota ainda.
              </li>
            )}
          </ul>
        )}

        <form onSubmit={handleFleetCreate} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="fleet-driver"
              className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
            >
              Motorista vinculado <span className="text-[#DC2626]">*</span>
            </label>
            <select
              id="fleet-driver"
              value={fDriver}
              onChange={(e) => {
                setFDriver(e.target.value)
                void loadFleetVehicles(e.target.value)
              }}
              required
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
            >
              <option value="">Selecione</option>
              {fleetDrivers.map((d) => (
                <option key={d.user_id} value={d.user_id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="fleet-vehicle"
              className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
            >
              Veículo do motorista <span className="text-[#DC2626]">*</span>
            </label>
            <select
              id="fleet-vehicle"
              value={fVehicle}
              onChange={(e) => setFVehicle(e.target.value)}
              required
              disabled={!fDriver}
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 disabled:opacity-50"
            >
              <option value="">{fDriver ? 'Selecione' : 'Escolha o motorista primeiro'}</option>
              {fVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fleet-kind" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
              Finalidade
            </label>
            <select
              id="fleet-kind"
              value={fKind}
              onChange={(e) => setFKind(e.target.value as 'parking' | 'triage')}
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
            >
              <option value="parking">Estacionamento</option>
              <option value="triage">Triagem</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
              <label
                htmlFor="fleet-date"
                className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
              >
                Data <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="fleet-date"
                type="date"
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
                required
                className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
              />
            </div>
            <div>
              <label
                htmlFor="fleet-start"
                className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
              >
                Início <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="fleet-start"
                type="time"
                value={fStart}
                onChange={(e) => setFStart(e.target.value)}
                required
                className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
              />
            </div>
            <div>
              <label
                htmlFor="fleet-end"
                className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
              >
                Fim <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="fleet-end"
                type="time"
                value={fEnd}
                onChange={(e) => setFEnd(e.target.value)}
                required
                className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="fleet-notes"
              className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
            >
              Observação (opcional)
            </label>
            <input
              id="fleet-notes"
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              placeholder="Ex.: carga de soja, doca 2"
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
            />
          </div>
          <button
            type="submit"
            disabled={fBusy}
            className="w-full h-11 rounded-xl bg-[#EAB308]/10 hover:bg-[#EAB308]/20 border border-[#EAB308]/30 text-[#EAB308] font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {' '}
            {fBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarClock className="w-4 h-4" />
            )}
            {fBusy ? 'Enviando...' : 'Solicitar previsão'}
          </button>
        </form>
        {fMsg && (
          <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {fMsg}
          </p>
        )}
        {fErr && (
          <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {fErr}
          </p>
        )}
        <p className="mt-3 text-[11px] text-[#8B9A97] leading-relaxed">
          A empresa solicita apenas para motoristas vinculados. Previsão não é garantia de vaga e
          toda solicitação fica pendente até a confirmação da equipe.
        </p>
      </section>

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

  // F1-024 (piloto): vínculo com empresa via CNPJ — nasce pendente, a empresa confirma.
  type LinkedCompany = { link_id: string; company_name: string; status: string }
  const [myCompanies, setMyCompanies] = useState<LinkedCompany[]>([])
  const [cnpj, setCnpj] = useState('')
  const [clBusy, setClBusy] = useState(false)
  const [clMsg, setClMsg] = useState<string | null>(null)
  const [clErr, setClErr] = useState<string | null>(null)

  // F1-013: Minhas previsões — autosserviço do motorista (S301/S307).
  type MyRequest = {
    id: string
    kind: string
    status: string
    starts_at: string
    ends_at: string
    notes: string | null
    version: number
    vehicles: { plate_normalized: string } | null
  }
  const [myRequests, setMyRequests] = useState<MyRequest[]>([])
  const [reqLoading, setReqLoading] = useState(true)
  const [reqVehicle, setReqVehicle] = useState('')
  const [reqKind, setReqKind] = useState<'parking' | 'triage'>('parking')
  const [reqDate, setReqDate] = useState('')
  const [reqStart, setReqStart] = useState('')
  const [reqEnd, setReqEnd] = useState('')
  const [reqBusy, setReqBusy] = useState(false)
  const [reqMsg, setReqMsg] = useState<string | null>(null)
  const [reqErr, setReqErr] = useState<string | null>(null)
  const [reqNotes, setReqNotes] = useState('')
  const [cancelBusy, setCancelBusy] = useState<string | null>(null)

  const loadMyRequests = async () => {
    setReqLoading(true)
    const { data, error } = await supabase
      .from('arrival_requests')
      .select('id, kind, status, starts_at, ends_at, notes, version, vehicles(plate_normalized)')
      .order('starts_at', { ascending: true })
    if (!error) {
      setMyRequests((data ?? []) as MyRequest[])
    }
    setReqLoading(false)
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqBusy(true)
    setReqMsg(null)
    setReqErr(null)
    // Janela em UTC a partir de data + hora local do usuário.
    const startsIso = new Date(`${reqDate}T${reqStart}:00`).toISOString()
    const endsIso = new Date(`${reqDate}T${reqEnd}:00`).toISOString()
    const { error } = await supabase.rpc('create_arrival_request', {
      p_vehicle_id: reqVehicle,
      p_kind: reqKind,
      p_starts_at: startsIso,
      p_ends_at: endsIso,
      p_notes: reqNotes || null,
    })
    setReqBusy(false)
    if (error) {
      setReqErr(msgAmigavel(error.message))
      return
    }
    setReqDate('')
    setReqStart('')
    setReqEnd('')
    setReqMsg('Previsão solicitada. Aguarde a confirmação da equipe — não é garantia de vaga.')
    await loadMyRequests()
  }

  const handleCancelRequest = async (r: MyRequest) => {
    setCancelBusy(r.id)
    setReqErr(null)
    const { error } = await supabase.rpc('change_arrival_request', {
      p_request_id: r.id,
      p_cancel: true,
      p_version: r.version,
    })
    setCancelBusy(null)
    if (error) {
      setReqErr(error.message)
      // S306: conflito de versão — recarrega para mostrar o estado real.
      if (error.message.toLowerCase().includes('conflito')) {
        await loadMyRequests()
      }
      return
    }
    await loadMyRequests()
  }

  const reqStatusMeta: Record<string, { label: string; cls: string }> = {
    requested: { label: 'Solicitada', cls: 'text-[#EAB308]' },
    confirmed: { label: 'Confirmada', cls: 'text-[#16A34A]' },
    rejected: { label: 'Recusada', cls: 'text-[#DC2626]' },
    cancelled: { label: 'Cancelada', cls: 'text-[#8B9A97]' },
    no_show: { label: 'Não compareceu', cls: 'text-[#DC2626]' },
    arrived: { label: 'Chegou', cls: 'text-[#16A34A]' },
    draft: { label: 'Rascunho', cls: 'text-[#8B9A97]' },
  }

  const fmtWindow = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  const loadMyVehicles = async () => {
    setVehiclesLoading(true)
    const { data, error } = await supabase
      .from('driver_vehicle_links')
      .select('id, valid_from, vehicles(id, plate_normalized, type)')
      .is('valid_to', null)
      .order('valid_from', { ascending: false })
    if (!error) {
      setMyVehicles((data ?? []) as MyVehicle[])
    }
    setVehiclesLoading(false)
  }

  const loadMyCompanies = async () => {
    const { data, error } = await supabase.rpc('driver_linked_companies')
    if (!error) {
      setMyCompanies((data ?? []) as LinkedCompany[])
    }
  }

  const handleCompanyLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setClBusy(true)
    setClMsg(null)
    setClErr(null)
    const { data, error } = await supabase.rpc('request_company_link', { p_cnpj: cnpj })
    setClBusy(false)
    if (error) {
      setClErr(error.message)
      return
    }
    const resumed = ((data ?? {}) as { resumed?: boolean }).resumed
    setCnpj('')
    setClMsg(
      resumed
        ? 'Solicitação já existia — aguardando a confirmação da empresa.'
        : 'Solicitação enviada. A empresa vai confirmar seu vínculo à frota.',
    )
    await loadMyCompanies()
  }

  useEffect(() => {
    loadMyVehicles()
    loadMyRequests()
    loadMyCompanies()
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
      {/* --- F1-024: Minha empresa (vínculo via CNPJ) --- */}
      <section aria-labelledby="my-company-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#EAB308]" />
            <h2 id="my-company-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Minha empresa
            </h2>
          </div>
          <button
            type="button"
            onClick={loadMyCompanies}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar empresas"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {myCompanies.length === 0 ? (
          <p className="text-xs text-[#8B9A97] py-2 text-center">
            Nenhum vínculo com empresa ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {myCompanies.map((mc) => (
              <li
                key={mc.link_id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3"
              >
                <p className="text-sm text-[#F7F9F8] truncate">{mc.company_name}</p>
                <span
                  className={`text-[11px] font-semibold shrink-0 ${
                    mc.status === 'active' ? 'text-[#16A34A]' : 'text-[#EAB308]'
                  }`}
                >
                  {mc.status === 'active' ? 'Frota ativa' : 'Aguardando confirmação'}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCompanyLink} className="mt-4 space-y-3">
          <div>
            <label htmlFor="cl-cnpj" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
              CNPJ da sua empresa <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="cl-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              required
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
            />
          </div>
          <button
            type="submit"
            disabled={clBusy}
            className="w-full h-11 rounded-xl bg-[#EAB308]/10 hover:bg-[#EAB308]/20 border border-[#EAB308]/30 text-[#EAB308] font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {clBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {clBusy ? 'Enviando...' : 'Vincular à empresa'}
          </button>
        </form>
        {clMsg && (
          <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {clMsg}
          </p>
        )}
        {clErr && (
          <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {clErr}
          </p>
        )}
      </section>

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

      {/* --- F1-013: Minhas previsões --- */}
      <section aria-labelledby="my-requests-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#EAB308]" />
            <h2 id="my-requests-heading" className="text-sm font-semibold text-[#F7F9F8]">
              Minhas previsões
            </h2>
          </div>
          <button
            type="button"
            onClick={loadMyRequests}
            className="text-[#8B9A97] hover:text-[#F7F9F8] transition-colors"
            aria-label="Recarregar previsões"
          >
            <RefreshCw className={`w-4 h-4 ${reqLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {reqLoading && myRequests.length === 0 ? (
          <p role="status" className="text-xs text-[#8B9A97] py-4 text-center">
            Carregando previsões...
          </p>
        ) : (
          <ul className="space-y-2">
            {myRequests.map((r) => {
              const meta = reqStatusMeta[r.status] ?? { label: r.status, cls: 'text-[#8B9A97]' }
              const cancellable = r.status === 'requested' || r.status === 'confirmed'
              return (
                <li
                  key={r.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[#F7F9F8] font-mono truncate">
                        {r.vehicles?.plate_normalized ?? '—'}
                        <span className="text-[#8B9A97] font-sans">
                          {' '}
                          · {r.kind === 'parking' ? 'Estacionamento' : 'Triagem'}
                        </span>
                      </p>
                      <p className="text-[11px] text-[#8B9A97] mt-0.5">
                        {fmtWindow(r.starts_at)} → {fmtWindow(r.ends_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
                      {cancellable && (
                        <button
                          type="button"
                          onClick={() => handleCancelRequest(r)}
                          disabled={cancelBusy === r.id}
                          className="h-8 px-2.5 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] text-[11px] font-semibold transition-all disabled:opacity-50"
                        >
                          {cancelBusy === r.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Cancelar'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
            {myRequests.length === 0 && (
              <li className="text-xs text-[#8B9A97] py-4 text-center">Nenhuma previsão ainda.</li>
            )}
          </ul>
        )}

        <form onSubmit={handleCreateRequest} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="req-vehicle"
              className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
            >
              Veículo <span className="text-[#DC2626]">*</span>
            </label>
            <select
              id="req-vehicle"
              value={reqVehicle}
              onChange={(e) => setReqVehicle(e.target.value)}
              required
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
            >
              <option value="">Selecione</option>
              {myVehicles.map((mv) => (
                <option key={mv.id} value={(mv.vehicles as { id?: string })?.id ?? ''}>
                  {mv.vehicles?.plate_normalized}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="req-kind" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
              Finalidade
            </label>
            <select
              id="req-kind"
              value={reqKind}
              onChange={(e) => setReqKind(e.target.value as 'parking' | 'triage')}
              className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
            >
              <option value="parking">Estacionamento</option>
              <option value="triage">Triagem</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3">
              <label htmlFor="req-date" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
                Data <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="req-date"
                type="date"
                value={reqDate}
                onChange={(e) => setReqDate(e.target.value)}
                required
                className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
              />
            </div>
            <div>
              <label
                htmlFor="req-start"
                className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
              >
                Início <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="req-start"
                type="time"
                value={reqStart}
                onChange={(e) => setReqStart(e.target.value)}
                required
                className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
              />
            </div>
            <div>
              <label htmlFor="req-end" className="block text-xs font-medium text-[#F7F9F8] mb-1.5">
                Fim <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="req-end"
                type="time"
                value={reqEnd}
                onChange={(e) => setReqEnd(e.target.value)}
                required
                className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 text-sm text-[#F7F9F8] focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
              />
            </div>
            <div className="col-span-3">
              <label
                htmlFor="req-notes"
                className="block text-xs font-medium text-[#F7F9F8] mb-1.5"
              >
                Observação (opcional)
              </label>
              <input
                id="req-notes"
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
                placeholder="Ex.: carga de soja, doca 2"
                className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={reqBusy}
            className="w-full h-11 rounded-xl bg-[#EAB308]/10 hover:bg-[#EAB308]/20 border border-[#EAB308]/30 text-[#EAB308] font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {reqBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarClock className="w-4 h-4" />
            )}
            {reqBusy ? 'Enviando...' : 'Solicitar previsão'}
          </button>
        </form>
        {reqMsg && (
          <p role="status" className="mt-3 text-xs text-[#16A34A] flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {reqMsg}
          </p>
        )}
        {reqErr && (
          <p role="alert" className="mt-3 text-xs text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {reqErr}
          </p>
        )}
        <p className="mt-3 text-[11px] text-[#8B9A97] leading-relaxed">
          Previsão não é garantia de vaga. Toda solicitação fica pendente até a confirmação da
          equipe. Janela máxima de 4 horas e até 60 dias à frente.
        </p>
      </section>

      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-xs text-[#8B9A97] leading-relaxed">
          Isolamento ativo: você vê apenas as suas previsões e os seus veículos.
        </p>
      </div>
    </HomeShell>
  )
}
