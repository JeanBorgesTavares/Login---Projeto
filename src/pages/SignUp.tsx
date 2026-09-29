import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle, X, Loader2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'

export default function SignUp() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shake, setShake] = useState(false)

  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)

  const validateEmail = (val: string): boolean => {
    const trimmed = val.trim()
    if (!trimmed) {
      setEmailError('O e-mail é obrigatório.')
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      setEmailError('Informe um e-mail válido.')
      return false
    }
    setEmailError(null)
    return true
  }

  const validatePassword = (val: string): boolean => {
    if (!val) {
      setPasswordError('A senha é obrigatória.')
      return false
    }
    if (val.length < 6) {
      setPasswordError('A senha deve ter no mínimo 6 caracteres.')
      return false
    }
    setPasswordError(null)
    return true
  }

  const validateConfirmPassword = (val: string): boolean => {
    if (!val) {
      setConfirmError('Confirme sua senha.')
      return false
    }
    if (val !== password) {
      setConfirmError('As senhas não coincidem.')
      return false
    }
    setConfirmError(null)
    return true
  }

  const triggerShake = () => {
    setShake(false)
    setTimeout(() => setShake(true), 10)
    setTimeout(() => setShake(false), 400)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAuthErrorMessage(null)

    const isEmailValid = validateEmail(email)
    const isPasswordValid = validatePassword(password)
    const isConfirmValid = validateConfirmPassword(confirmPassword)

    if (!isEmailValid || !isPasswordValid || !isConfirmValid) {
      triggerShake()
      return
    }

    setIsSubmitting(true)
    try {
      const { error, needsEmailConfirmation } = await signUp(email, password)

      if (error) {
        triggerShake()
        const rawMsg = error.message.toLowerCase()
        if (rawMsg.includes('user already registered') || rawMsg.includes('already exists')) {
          setAuthErrorMessage('Este e-mail já está cadastrado. Faça login ou recupere sua senha.')
        } else {
          setAuthErrorMessage(error.message || 'Erro ao criar conta. Tente novamente.')
        }
      } else {
        const msg = needsEmailConfirmation
          ? 'Conta criada! Enviamos um link de confirmação para o seu e-mail.'
          : 'Conta criada com sucesso! Faça login para continuar.'

        toast({
          title: 'Cadastro realizado!',
          description: msg,
        })

        navigate('/', {
          state: { message: msg },
        })
      }
    } catch {
      triggerShake()
      setAuthErrorMessage('Erro de conexão ao criar conta. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full flex justify-center">
      <div
        className={`w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/75 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all animate-card-fade-in ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* Back button */}
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B9A97] hover:text-[#F7F9F8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded px-1 py-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </Link>
        </div>

        {/* Top Icon */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/30 flex items-center justify-center text-[#16A34A]">
            <UserPlus className="w-6 h-6" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F9F8] tracking-tight">
            Criar conta grátis
          </h1>
          <p className="text-sm text-[#8B9A97] mt-1.5">
            Cadastre-se para ter acesso ao sistema Posto Comboio
          </p>
        </div>

        {/* Error Banner */}
        {authErrorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-xl bg-[#DC2626] text-white p-3.5 shadow-lg shadow-[#DC2626]/20 animate-banner-slide-up flex items-start justify-between gap-2"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-white" aria-hidden="true" />
              <p className="text-sm font-medium leading-snug">{authErrorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setAuthErrorMessage(null)}
              aria-label="Fechar mensagem de erro"
              className="text-white/80 hover:text-white rounded-md p-0.5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* E-mail */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-email" className="block text-sm font-medium text-[#F7F9F8]">
              E-mail
            </label>
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8B9A97]"
                aria-hidden="true"
              >
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="signup-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) validateEmail(e.target.value)
                }}
                onBlur={() => validateEmail(email)}
                placeholder="seu.email@exemplo.com.br"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'signup-email-error' : undefined}
                className={`w-full h-12 rounded-xl bg-[#0A0A0A]/80 border pl-11 pr-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-200 focus:outline-none focus:ring-[3px] focus:ring-[#16A34A]/30 focus:border-[#16A34A] ${
                  emailError ? 'border-[#DC2626]' : 'border-white/[0.1] hover:border-white/[0.2]'
                }`}
              />
            </div>
            {emailError && (
              <p id="signup-email-error" className="text-xs text-[#DC2626] pl-1 pt-0.5">
                {emailError}
              </p>
            )}
          </div>

          {/* Senha */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-password" className="block text-sm font-medium text-[#F7F9F8]">
              Senha
            </label>
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8B9A97]"
                aria-hidden="true"
              >
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="signup-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) validatePassword(e.target.value)
                }}
                onBlur={() => validatePassword(password)}
                placeholder="Crie uma senha forte (mín. 6 dígitos)"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'signup-password-error' : undefined}
                className={`w-full h-12 rounded-xl bg-[#0A0A0A]/80 border pl-11 pr-12 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-200 focus:outline-none focus:ring-[3px] focus:ring-[#16A34A]/30 focus:border-[#16A34A] ${
                  passwordError ? 'border-[#DC2626]' : 'border-white/[0.1] hover:border-white/[0.2]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#8B9A97] hover:text-[#F7F9F8] transition-colors focus-visible:outline-none focus-visible:text-[#16A34A]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordError && (
              <p id="signup-password-error" className="text-xs text-[#DC2626] pl-1 pt-0.5">
                {passwordError}
              </p>
            )}
          </div>

          {/* Confirmar Senha */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="confirm-password" className="block text-sm font-medium text-[#F7F9F8]">
              Confirmar Senha
            </label>
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#8B9A97]"
                aria-hidden="true"
              >
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (confirmError) validateConfirmPassword(e.target.value)
                }}
                onBlur={() => validateConfirmPassword(confirmPassword)}
                placeholder="Repita sua senha"
                aria-invalid={Boolean(confirmError)}
                aria-describedby={confirmError ? 'confirm-password-error' : undefined}
                className={`w-full h-12 rounded-xl bg-[#0A0A0A]/80 border pl-11 pr-12 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-200 focus:outline-none focus:ring-[3px] focus:ring-[#16A34A]/30 focus:border-[#16A34A] ${
                  confirmError ? 'border-[#DC2626]' : 'border-white/[0.1] hover:border-white/[0.2]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? 'Ocultar confirmação de senha'
                    : 'Exibir confirmação de senha'
                }
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#8B9A97] hover:text-[#F7F9F8] transition-colors focus-visible:outline-none focus-visible:text-[#16A34A]"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmError && (
              <p id="confirm-password-error" className="text-xs text-[#DC2626] pl-1 pt-0.5">
                {confirmError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-[52px] mt-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:translate-y-0 hover:-translate-y-[1px] text-[#F7F9F8] font-semibold text-base shadow-[0_10px_25px_rgba(22,163,74,0.35)] transition-all duration-150 disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#16A34A]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span>Cadastrando...</span>
              </>
            ) : (
              <span>Cadastrar</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[#8B9A97]">
            Já tem uma conta?{' '}
            <Link
              to="/"
              className="text-[#16A34A] hover:text-[#22C55E] font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded px-1"
            >
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
