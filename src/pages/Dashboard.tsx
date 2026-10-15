import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AlertTriangle, Clock, LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { AdminHome, CompanyHome, DriverHome, OperatorHome } from '@/pages/homes'
import { supabase } from '@/lib/supabase/client'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile, loading, accessDenied, signOut } = useAuth()

  // CA-F1-01-05: sem sessão não há acesso — volta para o login.
  useEffect(() => {
    if (!loading && !user && !accessDenied) {
      navigate('/', { replace: true })
    }
  }, [loading, user, accessDenied, navigate])

  const handleLogout = async () => {
    await signOut()
  }

  // F1-007: usuário autenticado SEM perfil vai ao onboarding de papel.
  // (Usuário com e-mail confirmado e sem linha em profiles — signup concluído,
  // perfil ainda não criado. O gate de ERRO de leitura segue vermelho no hook.)
  useEffect(() => {
    if (!loading && user && !profile && !accessDenied) {
      navigate('/onboarding', { replace: true })
    }
  }, [loading, user, profile, accessDenied, navigate])

  if (loading) {
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[480px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center">
          <p className="text-sm text-[#8B9A97]" role="status" aria-live="polite">
            Verificando seu acesso...
          </p>
        </div>
      </div>
    )
  }

  // Acesso negado: conta desativada ou falha na leitura do perfil (linha vermelha).
  if (accessDenied && !profile) {
    return (
      <div className="w-full flex justify-center">
        <div
          role="alert"
          className="w-full max-w-[480px] rounded-2xl border border-[#DC2626]/30 bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in text-center"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/30 flex items-center justify-center text-[#DC2626] mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#F7F9F8]">Acesso bloqueado</h1>
          <p className="text-sm text-[#8B9A97] mt-3">{accessDenied}</p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full h-12 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-semibold text-sm transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
            <Link
              to="/"
              className="text-xs text-[#8B9A97] hover:text-[#F7F9F8] underline underline-offset-4"
            >
              Ir para o login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Perfil pendente: sessão existe, mas a operação não é liberada (CA-F1-01-02).
  if (profile && profile.status === 'pending') {
    return (
      <>
        <CompanyPendingRouter />
        <div className="w-full flex justify-center">
          <div className="w-full max-w-[480px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#EAB308]/10 border border-[#EAB308]/30 flex items-center justify-center text-[#EAB308] mb-4">
              <Clock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#F7F9F8]">Aguardando aprovação</h1>
            <p className="text-sm text-[#8B9A97] mt-3">
              Seu cadastro foi recebido e está pendente de aprovação pela administração. Até lá, o
              sistema fica indisponível para você.
            </p>
            <div className="my-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left">
              <div className="flex items-center gap-2 text-xs text-[#8B9A97]">
                <User className="w-4 h-4 text-[#EAB308]" />
                <span>Aguardando aprovação</span>
              </div>
              <p className="font-mono text-sm text-[#F7F9F8] break-all mt-1">
                {user?.email || profile.full_name || '—'}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full h-12 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-semibold text-sm transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
              >
                <LogOut className="w-4 h-4" />
                Encerrar sessão
              </button>
              <Link
                to="/"
                className="text-xs text-[#8B9A97] hover:text-[#F7F9F8] underline underline-offset-4"
              >
                Voltar para a página de login
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Acesso liberado: perfil ativo — home por papel (CA-F1-01-05).
  const email = user?.email ?? null
  if (profile?.role === 'admin') {
    return <AdminHome email={email} onLogout={handleLogout} />
  }
  if (profile?.role === 'operator') {
    return <OperatorHome email={email} onLogout={handleLogout} />
  }
  if (profile?.role === 'driver') {
    return <DriverHome email={email} onLogout={handleLogout} />
  }
  if (profile?.role === 'company') {
    return <CompanyHome email={email} onLogout={handleLogout} />
  }
  return null
}

// F1-007: perfil company pendente SEM empresa vinculada precisa concluir a
// solicitação — o Dashboard redireciona ao formulário. O componente wrapper
// consulta o vínculo sob RLS (o usuário só enxerga o próprio).
export function CompanyPendingRouter() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (loading || !user || !profile) return
    if (profile.role !== 'company' || profile.status !== 'pending') {
      navigate('/dashboard', { replace: true })
      return
    }
    let cancelled = false
    supabase
      .from('company_users')
      .select('company_id, status')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        // Sem vínculo: formulário de solicitação (F1-007).
        // Com vínculo pending: pedido enviado — aguarda aprovação (F1-008).
        if (!data) {
          navigate('/company-request', { replace: true })
        }
      })
    return () => {
      cancelled = true
    }
  }, [loading, user, profile, navigate])

  return null
}
