import { Link } from 'react-router-dom'
import { Fuel, LogOut, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function Dashboard() {
  const { user, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
  }

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
            <span>Usuário autenticado</span>
          </div>
          <p className="font-mono text-sm text-[#F7F9F8] break-all">
            {user?.email || 'comboio@comboiologistica.com.br'}
          </p>
          <div className="flex items-center gap-2 pt-2 text-xs text-[#16A34A]">
            <Fuel className="w-3.5 h-3.5" />
            <span>Sessão ativa via Supabase Auth</span>
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
