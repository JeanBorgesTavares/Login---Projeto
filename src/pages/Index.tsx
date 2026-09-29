import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Fuel, AlertCircle, X, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'

export default function Index() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signIn, resendSignUpEmail, loading: authLoading } = useAuth()

  // Form inputs
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [shake, setShake] = useState(false)

  // Validation & Error states
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)
  const [isUnconfirmedEmail, setIsUnconfirmedEmail] = useState(false)

  // Success message passed via navigation state (e.g. from signup)
  const stateSuccessMessage = (location.state as { message?: string } | null)?.message

  // If already logged in, redirect away automatically
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

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
    setPasswordError(null)
    return true
  }

  const triggerShake = () => {
    setShake(false)
    // Small timeout to allow re-triggering the CSS animation
    setTimeout(() => setShake(true), 10)
    setTimeout(() => setShake(false), 400)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAuthErrorMessage(null)
    setIsUnconfirmedEmail(false)

    const isEmailValid = validateEmail(email)
    const isPasswordValid = validatePassword(password)

    if (!isEmailValid || !isPasswordValid) {
      triggerShake()
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await signIn(email, password)

      if (error) {
        triggerShake()
        const rawMsg = error.message.toLowerCase()

        if (
          rawMsg.includes('email not confirmed') ||
          rawMsg.includes('not confirmed') ||
          rawMsg.includes('unconfirmed')
        ) {
          setIsUnconfirmedEmail(true)
          setAuthErrorMessage('E-mail não confirmado. Verifique sua caixa de entrada.')
        } else if (
          rawMsg.includes('invalid login credentials') ||
          rawMsg.includes('invalid credentials') ||
          rawMsg.includes('invalid_grant')
        ) {
          setAuthErrorMessage('E-mail ou senha incorretos. Verifique suas credenciais.')
        } else if (rawMsg.includes('rate limit') || rawMsg.includes('too many requests')) {
          setAuthErrorMessage('Muitas tentativas. Aguarde alguns instantes e tente novamente.')
        } else {
          setAuthErrorMessage(
            error.message || 'Falha ao autenticar. Verifique sua conexão e tente novamente.',
          )
        }
      } else {
        toast({
          title: 'Login efetuado com sucesso!',
          description: 'Seja bem-vindo ao sistema do Posto Comboio.',
        })
        navigate('/dashboard', { replace: true })
      }
    } catch {
      triggerShake()
      setAuthErrorMessage('Ocorreu um erro inesperado ao conectar ao servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setEmailError('Informe seu e-mail para reenviar a confirmação.')
      return
    }
    setIsResending(true)
    try {
      const { error } = await resendSignUpEmail(email)
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível reenviar',
          description: error.message || 'Tente novamente em instantes.',
        })
      } else {
        toast({
          title: 'E-mail reenviado!',
          description: `Enviamos um novo link de confirmação para ${email.trim()}.`,
        })
      }
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="w-full flex justify-center">
      <div
        className={`w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/75 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all animate-card-fade-in ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* 1. Decor: Fuel pump / fuel drop icon set & gauge at top of card */}
        <div className="flex flex-col items-center gap-2 mb-6" aria-hidden="true">
          <div className="flex items-center justify-center gap-2 text-[#16A34A]">
            <Fuel className="w-4 h-4 text-[#8B9A97]" />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#16A34A]/10 border border-[#16A34A]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span className="text-[11px] font-semibold tracking-wider text-[#16A34A] uppercase">
                Acesso Seguro
              </span>
            </div>
            <Fuel className="w-4 h-4 text-[#8B9A97]" />
          </div>

          {/* Decorative fuel gauge meter indicator */}
          <div className="w-36 h-1 rounded-full bg-white/[0.08] overflow-hidden flex">
            <div className="h-full w-full bg-gradient-to-r from-[#0B3D2E] via-[#16A34A] to-[#22C55E]" />
          </div>
        </div>

        {/* 2. Title: "Acesse sua conta" (bold, grande) */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F9F8] tracking-tight">
            Acesse sua conta
          </h1>
          <p className="text-sm text-[#8B9A97] mt-1.5">
            Gerencie abastecimentos, cadastros e frotas
          </p>
        </div>

        {/* Optional Success Banner passed from secondary pages */}
        {stateSuccessMessage && !authErrorMessage && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-3.5 text-xs text-[#22C55E] animate-banner-slide-up">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{stateSuccessMessage}</span>
          </div>
        )}

        {/* Dynamic Error Message Area: Red banner (#DC2626) with white text and close icon */}
        {authErrorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-xl bg-[#DC2626] text-white p-3.5 shadow-lg shadow-[#DC2626]/20 animate-banner-slide-up"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-white" aria-hidden="true" />
                <div className="text-sm font-medium leading-snug">
                  <p>{authErrorMessage}</p>
                  {isUnconfirmedEmail && (
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={isResending}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4 hover:text-white/90 disabled:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1"
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Reenviando...
                        </>
                      ) : (
                        'Reenviar e-mail de confirmação'
                      )}
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuthErrorMessage(null)}
                aria-label="Fechar mensagem de erro"
                className="text-white/80 hover:text-white rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* 3. Field: "E-mail" */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="email-input" className="block text-sm font-medium text-[#F7F9F8]">
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
                id="email-input"
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
                aria-describedby={emailError ? 'email-error' : undefined}
                className={`w-full h-12 rounded-xl bg-[#0A0A0A]/80 border pl-11 pr-4 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-200 focus:outline-none focus:ring-[3px] focus:ring-[#16A34A]/30 focus:border-[#16A34A] ${
                  emailError
                    ? 'border-[#DC2626] ring-1 ring-[#DC2626]/40'
                    : 'border-white/[0.1] hover:border-white/[0.2]'
                }`}
              />
            </div>
            {emailError && (
              <p id="email-error" className="text-xs text-[#DC2626] pl-1 pt-0.5">
                {emailError}
              </p>
            )}
          </div>

          {/* 4. Field: "Senha" with toggle */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="password-input" className="block text-sm font-medium text-[#F7F9F8]">
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
                id="password-input"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) validatePassword(e.target.value)
                }}
                onBlur={() => validatePassword(password)}
                placeholder="Digite sua senha"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'password-error' : undefined}
                className={`w-full h-12 rounded-xl bg-[#0A0A0A]/80 border pl-11 pr-12 text-sm text-[#F7F9F8] placeholder:text-[#8B9A97] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-200 focus:outline-none focus:ring-[3px] focus:ring-[#16A34A]/30 focus:border-[#16A34A] ${
                  passwordError
                    ? 'border-[#DC2626] ring-1 ring-[#DC2626]/40'
                    : 'border-white/[0.1] hover:border-white/[0.2]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#8B9A97] hover:text-[#F7F9F8] transition-colors focus-visible:outline-none focus-visible:text-[#16A34A]"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 transition-transform duration-150 hover:scale-110" />
                ) : (
                  <Eye className="w-5 h-5 transition-transform duration-150 hover:scale-110" />
                )}
              </button>
            </div>
            {passwordError && (
              <p id="password-error" className="text-xs text-[#DC2626] pl-1 pt-0.5">
                {passwordError}
              </p>
            )}
          </div>

          {/* 5. Link: "Esqueci minha senha" alinhado à direita */}
          <div className="flex justify-end pt-0.5">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-[#16A34A] hover:text-[#22C55E] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded px-1 py-0.5 transition-colors"
            >
              Esqueci minha senha
            </Link>
          </div>

          {/* 6. Primary Button: "Entrar" with fuel-drop icon and spinner */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative w-full h-[52px] mt-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:translate-y-0 hover:-translate-y-[1px] text-[#F7F9F8] font-semibold text-base shadow-[0_10px_25px_rgba(22,163,74,0.35)] hover:shadow-[0_12px_28px_rgba(22,163,74,0.45)] transition-all duration-150 disabled:opacity-75 disabled:pointer-events-none flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#16A34A]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span>Entrando...</span>
              </>
            ) : (
              <>
                {/* Fuel drop SVG icon */}
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5 text-white transition-transform group-hover:scale-110"
                  aria-hidden="true"
                >
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
                <span>Entrar</span>
              </>
            )}
          </button>
        </form>

        {/* 7. Divider: "ou" centralizado */}
        <div className="relative my-6" aria-hidden="true">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/[0.08]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0e1612] px-3 text-[#8B9A97] tracking-wider font-medium rounded-full">
              ou
            </span>
          </div>
        </div>

        {/* 8. Secondary Button: "Criar conta grátis" outlined */}
        <Link
          to="/signup"
          className="inline-flex w-full h-12 items-center justify-center rounded-xl border border-[#16A34A]/40 bg-transparent hover:bg-[#16A34A]/10 hover:border-[#16A34A] text-[#F7F9F8] hover:text-white font-medium text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
        >
          Criar conta grátis
        </Link>
      </div>
    </div>
  )
}
