import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/30 flex items-center justify-center text-[#DC2626] mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#F7F9F8]">404</h1>
        <p className="text-base font-semibold text-[#F7F9F8] mt-1">Página não encontrada</p>
        <p className="text-xs text-[#8B9A97] mt-2">
          O endereço informado não existe ou foi movido.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex w-full h-12 items-center justify-center rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-[#F7F9F8] font-medium text-sm transition-colors gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
