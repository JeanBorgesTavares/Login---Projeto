// F1-007 · SPEC-F1-02 · CA-F1-02-01 · S201
// Onboarding de papel no 1º login: usuário autenticado SEM perfil escolhe
// Empresa ou Motorista. A policy profiles_insert_self_external_pending
// (F1-002) cria o perfil pending — aqui só escolhemos o papel.
// NUNCA oferecemos admin/operator: interno é convite do admin (F1-004).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Loader2, Truck, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [busy, setBusy] = useState<'company' | 'driver' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const chooseRole = async (role: 'company' | 'driver') => {
    if (!user) return
    setBusy(role)
    setError(null)
    // A policy só aceita company/driver + pending — o banco é a barreira.
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ user_id: user.id, role, status: 'pending', full_name: user.email })
    if (insertError) {
      // 23505 = perfil já existe: segue o fluxo, o gate decide a tela.
      if (String(insertError.code) === '23505') {
        navigate('/dashboard', { replace: true })
        return
      }
      setError('Não foi possível registrar seu perfil. Tente novamente.')
      setBusy(null)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[480px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#16A34A]/10 border border-[#16A34A]/30 flex items-center justify-center text-[#16A34A] mb-4">
          <UserRound className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F9F8] text-center">
          Como você vai usar o sistema?
        </h1>
        <p className="text-sm text-[#8B9A97] mt-2 text-center">
          Escolha o seu perfil de acesso para continuar.
        </p>

        <div className="mt-8 space-y-4">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => chooseRole('company')}
            className="w-full p-5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-[#8B5CF6]/40 text-left transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6] shrink-0">
                {busy === 'company' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F7F9F8]">Empresa</p>
                <p className="text-xs text-[#8B9A97] mt-1 leading-relaxed">
                  Solicitar cadastro da sua empresa (CNPJ) e gerenciar sua frota e previsões.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => chooseRole('driver')}
            className="w-full p-5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-[#EAB308]/40 text-left transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAB308]"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#EAB308]/10 border border-[#EAB308]/30 flex items-center justify-center text-[#EAB308] shrink-0">
                {busy === 'driver' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Truck className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F7F9F8]">Motorista</p>
                <p className="text-xs text-[#8B9A97] mt-1 leading-relaxed">
                  Se cadastrar como motorista e acompanhar suas previsões de chegada.
                </p>
              </div>
            </div>
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs text-[#DC2626] text-center">
            {error}
          </p>
        )}

        <p className="mt-6 text-[11px] text-[#8B9A97] text-center leading-relaxed">
          Usuários internos (administradores e operadores) não se cadastram por aqui — o acesso
          interno é criado por convite da administração.
        </p>
      </div>
    </div>
  )
}
