// F1-009 · SPEC-F1-02 · CA-F1-02-03 · S203
// Autoinscrição de motorista: perfil driver/pending SEM linha em drivers
// preenche nome completo, CPF e telefone. O cadastro nasce pending — não
// reserva e não acessa nada; a ativação é de interno (home admin).

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

type FieldErrors = Partial<Record<'full_name' | 'cpf' | 'phone', string>>

const onlyDigits = (v: string) => v.replace(/\D+/g, '')

export default function DriverRequest() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [fullName, setFullName] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    if (fullName.trim().length < 3) errs.full_name = 'Informe seu nome completo.'
    if (onlyDigits(cpf).length !== 11) errs.cpf = 'CPF deve ter 11 dígitos.'
    if (phone.trim().length < 8) errs.phone = 'Informe um telefone com DDD.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!validate()) return

    setSubmitting(true)
    const { error } = await supabase.rpc('request_driver_registration', {
      p_full_name: fullName,
      p_cpf: cpf,
      p_phone: phone,
    })
    setSubmitting(false)

    if (error) {
      setServerError(error.message)
      return
    }
    setDone(true)
  }

  const inputCls = (hasError: boolean) =>
    `w-full h-11 rounded-xl bg-white/[0.03] border px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40 ${
      hasError ? 'border-[#DC2626]' : 'border-white/[0.08]'
    }`

  if (done) {
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[480px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#16A34A]/10 border border-[#16A34A]/30 flex items-center justify-center text-[#16A34A] mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#F7F9F8]">Cadastro enviado</h1>
          <p className="text-sm text-[#8B9A97] mt-3 leading-relaxed">
            Seu cadastro de motorista ficou{' '}
            <strong className="text-[#F7F9F8]">pendente de ativação</strong>. Nossa equipe vai
            conferir seus dados e liberar o acesso.
          </p>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/', { replace: true })
            }}
            className="mt-6 w-full h-12 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] font-semibold text-sm transition-all"
          >
            Encerrar sessão
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[480px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#EAB308]/10 border border-[#EAB308]/30 flex items-center justify-center text-[#EAB308] mb-4">
          <Truck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#F7F9F8] text-center">
          Cadastro de motorista
        </h1>
        <p className="text-sm text-[#8B9A97] mt-2 text-center">
          Preencha seus dados. Após a conferência da equipe, seu acesso é liberado.
        </p>

        {serverError && (
          <div
            role="alert"
            className="mt-5 p-3 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/5 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <p className="text-xs text-[#DC2626] leading-relaxed">{serverError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <div className="space-y-1.5 text-left">
            <label htmlFor="dr-name" className="block text-xs font-medium text-[#F7F9F8]">
              Nome completo <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="dr-name"
              className={inputCls(Boolean(fieldErrors.full_name))}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              aria-invalid={Boolean(fieldErrors.full_name)}
            />
            {fieldErrors.full_name && (
              <p className="text-xs text-[#DC2626]">{fieldErrors.full_name}</p>
            )}
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="dr-cpf" className="block text-xs font-medium text-[#F7F9F8]">
              CPF <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="dr-cpf"
              className={inputCls(Boolean(fieldErrors.cpf))}
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              aria-invalid={Boolean(fieldErrors.cpf)}
            />
            {fieldErrors.cpf && <p className="text-xs text-[#DC2626]">{fieldErrors.cpf}</p>}
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="dr-phone" className="block text-xs font-medium text-[#F7F9F8]">
              Telefone <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="dr-phone"
              className={inputCls(Boolean(fieldErrors.phone))}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(64) 99999-9999"
              inputMode="tel"
              aria-invalid={Boolean(fieldErrors.phone)}
            />
            {fieldErrors.phone && <p className="text-xs text-[#DC2626]">{fieldErrors.phone}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-[#EAB308]/10 hover:bg-[#EAB308]/20 border border-[#EAB308]/30 text-[#EAB308] font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAB308]"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Enviando cadastro...' : 'Enviar cadastro'}
          </button>
        </form>
      </div>
    </div>
  )
}
