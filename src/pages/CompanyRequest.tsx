// F1-007 · SPEC-F1-02 · CA-F1-02-01 · S201
// Formulário de solicitação de empresa: visível para perfil company/pending
// SEM empresa vinculada. Chama a RPC transacional idempotente
// request_company_registration — o pedido NÃO concede acesso (F1-008 aprova).

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Building2, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

type FieldErrors = Partial<Record<'legal_name' | 'cnpj' | 'contact_name' | 'contact_email', string>>

const onlyDigits = (v: string) => v.replace(/\D+/g, '')

export default function CompanyRequest() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [legalName, setLegalName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [address, setAddress] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    if (legalName.trim().length < 2) errs.legal_name = 'Informe a razão social.'
    if (onlyDigits(cnpj).length !== 14) errs.cnpj = 'CNPJ deve ter 14 dígitos.'
    if (contactName.trim().length < 2) errs.contact_name = 'Informe o nome do contato.'
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()))
      errs.contact_email = 'E-mail de contato inválido.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!validate()) return

    setSubmitting(true)
    const { data, error } = await supabase.rpc('request_company_registration', {
      p_legal_name: legalName,
      p_trade_name: tradeName,
      p_cnpj: cnpj,
      p_address: address,
      p_contact_name: contactName,
      p_contact_email: contactEmail,
      p_contact_phone: contactPhone,
    })
    setSubmitting(false)

    if (error) {
      // Mensagem do servidor já é segura (não revela terceiros).
      setServerError(error.message)
      return
    }
    setDone(Boolean(data?.ok))
  }

  const inputCls = (hasError: boolean) =>
    `w-full h-11 rounded-xl bg-white/[0.03] border px-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97]/60 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 ${
      hasError ? 'border-[#DC2626]' : 'border-white/[0.08]'
    }`

  if (done) {
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[480px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#16A34A]/10 border border-[#16A34A]/30 flex items-center justify-center text-[#16A34A] mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#F7F9F8]">Solicitação enviada</h1>
          <p className="text-sm text-[#8B9A97] mt-3 leading-relaxed">
            O cadastro da sua empresa ficou{' '}
            <strong className="text-[#F7F9F8]">pendente de aprovação</strong>. Nossa equipe vai
            conferir os dados e liberar o acesso. Você receberá a liberação no próximo login.
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
      <div className="w-full max-w-[520px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6] mb-4">
          <Building2 className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#F7F9F8] text-center">
          Cadastro da sua empresa
        </h1>
        <p className="text-sm text-[#8B9A97] mt-2 text-center">
          Preencha os dados da empresa. Após o envio, o pedido fica pendente de aprovação.
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
            <label htmlFor="cr-legal" className="block text-xs font-medium text-[#F7F9F8]">
              Razão social <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="cr-legal"
              className={inputCls(Boolean(fieldErrors.legal_name))}
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Transportadora Exemplo Ltda"
              aria-invalid={Boolean(fieldErrors.legal_name)}
            />
            {fieldErrors.legal_name && (
              <p className="text-xs text-[#DC2626]">{fieldErrors.legal_name}</p>
            )}
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="cr-trade" className="block text-xs font-medium text-[#F7F9F8]">
              Nome fantasia
            </label>
            <input
              id="cr-trade"
              className={inputCls(false)}
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder="Exemplo Log"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="cr-cnpj" className="block text-xs font-medium text-[#F7F9F8]">
              CNPJ <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="cr-cnpj"
              className={inputCls(Boolean(fieldErrors.cnpj))}
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              aria-invalid={Boolean(fieldErrors.cnpj)}
            />
            {fieldErrors.cnpj && <p className="text-xs text-[#DC2626]">{fieldErrors.cnpj}</p>}
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="cr-address" className="block text-xs font-medium text-[#F7F9F8]">
              Endereço
            </label>
            <input
              id="cr-address"
              className={inputCls(false)}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, cidade"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="cr-contact" className="block text-xs font-medium text-[#F7F9F8]">
              Nome do contato <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="cr-contact"
              className={inputCls(Boolean(fieldErrors.contact_name))}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Quem a gente fala"
              aria-invalid={Boolean(fieldErrors.contact_name)}
            />
            {fieldErrors.contact_name && (
              <p className="text-xs text-[#DC2626]">{fieldErrors.contact_name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 text-left">
              <label htmlFor="cr-email" className="block text-xs font-medium text-[#F7F9F8]">
                E-mail do contato
              </label>
              <input
                id="cr-email"
                type="email"
                className={inputCls(Boolean(fieldErrors.contact_email))}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                aria-invalid={Boolean(fieldErrors.contact_email)}
              />
              {fieldErrors.contact_email && (
                <p className="text-xs text-[#DC2626]">{fieldErrors.contact_email}</p>
              )}
            </div>
            <div className="space-y-1.5 text-left">
              <label htmlFor="cr-phone" className="block text-xs font-medium text-[#F7F9F8]">
                Telefone
              </label>
              <input
                id="cr-phone"
                className={inputCls(false)}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(64) 99999-9999"
                inputMode="tel"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#8B5CF6] font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Enviando solicitação...' : 'Enviar solicitação'}
          </button>
        </form>
      </div>
    </div>
  )
}
