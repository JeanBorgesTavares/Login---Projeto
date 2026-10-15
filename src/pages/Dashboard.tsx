import { Link } from 'react-router-dom'
import { AlertTriangle, Clock, Fuel, LogOut, ShieldCheck, User } from 'lucide-react'
import { useAuth, type UserRole } from '@/hooks/use-auth'

const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  company: 'Empresa',
  driver: 'Motorista',
}

export default function Dashboard() {
  const { user, profile, loading, accessDenied, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
  }

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
    )
  }

  // Acesso liberado: perfil ativo.
  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[480px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#16A34A]/10 border border-[#16A34A]/30 flex items-center justify-center text-[#16A34A] mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F9F8]">
          Bem-vindo ao Posto Comboio
        </h1>
        <p className="text-sm text-[#8B9A97] mt-2">
          Você está autenticado com sucesso no sistema de cadastro.
        </p>

        <div className="my-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#8B9A97]">
            <User className="w-4 h-4 text-[#16A34A]" />
            <span>
              {profile?.full_name || 'Usuário autenticado'}
              {profile ? ` · ${roleLabel[profile.role]}` : ''}
            </span>
          </div>
          <p className="font-mono text-sm text-[#F7F9F8] break-all">
            {user?.email || 'comboio@comboiologistica.com.br'}
          </p>
          <div className="flex items-center gap-2 pt-2 text-xs text-[#16A34A]">
            <Fuel className="w-3.5 h-3.5" />
            <span>Sessão ativa via Supabase Auth · perfil ativo verificado</span>
          </div>
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
  )
}
