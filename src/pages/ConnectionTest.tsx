import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PlugZap,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface TestResult {
  ok: boolean
  checkedAt: string
  details: string
  latencyMs: number | null
}

export default function ConnectionTest() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<TestResult | null>(null)

  const runTest = async () => {
    setStatus('loading')
    setResult(null)
    const startedAt = performance.now()

    try {
      // S101: consulta de leitura ao Supabase usando somente a chave publicável (anon).
      // A tabela não precisa existir: o objetivo é provar que o app alcança o serviço
      // REST do projeto Supabase correto com credenciais válidas e sem segredo no browser.
      const { error } = await supabase.from('connection_test').select('*').limit(1)

      const latencyMs = Math.round(performance.now() - startedAt)
      const checkedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

      if (!error) {
        // Leitura aceita (tabela existente e liberada para a chave anon).
        setResult({
          ok: true,
          checkedAt,
          details: 'Consulta de leitura executada com sucesso no banco do projeto.',
          latencyMs,
        })
        setStatus('success')
        return
      }

      // PGRST205 = "schema cache": a requisição chegou ao PostgREST com chave válida,
      // apenas a tabela não existe. Isso PROVA a conexão Skip -> Supabase.
      // Qualquer outro erro (rede, chave inválida, projeto errado) é tratado como falha.
      const code = (error as { code?: string; details?: string | null; hint?: string | null }).code
      if (code === 'PGRST205') {
        setResult({
          ok: true,
          checkedAt,
          details:
            'Conexão estabelecida: o serviço do Supabase respondeu à consulta com a chave publicável (tabela de teste inexistente — resposta PGRST205 do próprio banco).',
          latencyMs,
        })
        setStatus('success')
        return
      }

      setResult({
        ok: false,
        checkedAt,
        details: `Falha na conexão: ${error.message}${code ? ` (código ${code})` : ''}`,
        latencyMs,
      })
      setStatus('error')
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startedAt)
      const checkedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      setResult({
        ok: false,
        checkedAt,
        details: `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs,
      })
      setStatus('error')
    }
  }

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[520px] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-card-fade-in">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#16A34A]/10 border border-[#16A34A]/30 flex items-center justify-center text-[#16A34A] mb-4">
          <PlugZap className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F9F8] text-center tracking-tight">
          Teste de conexão
        </h1>
        <p className="text-sm text-[#8B9A97] mt-2 text-center">
          Verifica a ligação entre o sistema (Skip) e o banco de dados (Supabase) usando apenas a
          chave publicável — nenhum segredo é exposto no navegador.
        </p>

        <div className="my-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2 text-left">
          <div className="flex items-center gap-2 text-xs text-[#8B9A97]">
            <Server className="w-4 h-4 text-[#16A34A]" />
            <span className="font-semibold text-[#F7F9F8]/90">Projeto Supabase</span>
          </div>
          <p className="font-mono text-xs text-[#F7F9F8] break-all">
            Automação Pátio Estacionamento – Comboio
          </p>
          <div className="flex items-center gap-2 pt-1 text-xs text-[#16A34A]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Chave publicável (anon) — sem service_role no frontend</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={runTest}
            disabled={status === 'loading'}
            className="w-full h-12 rounded-xl bg-[#16A34A] hover:bg-[#18B45B] disabled:opacity-70 disabled:cursor-not-allowed text-[#F7F9F8] font-bold text-sm transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testando conexão...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Executar teste de conexão
              </>
            )}
          </button>

          {result && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border p-4 text-left space-y-2 animate-banner-slide-up ${
                result.ok
                  ? 'border-[#22C55E]/30 bg-[#22C55E]/10'
                  : 'border-[#DC2626]/30 bg-[#DC2626]/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {result.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
                )}
                <p
                  className={`font-bold text-sm ${result.ok ? 'text-[#22C55E]' : 'text-[#DC2626]'}`}
                >
                  {result.ok ? 'Conexão OK' : 'Falha na conexão'}
                </p>
              </div>
              <p className="text-xs text-[#F7F9F8]/85 leading-relaxed">{result.details}</p>
              <p className="text-[11px] text-[#8B9A97] font-mono">
                {result.checkedAt}
                {result.latencyMs !== null ? ` · ${result.latencyMs} ms` : ''}
              </p>
            </div>
          )}

          <Link
            to="/dashboard"
            className="text-xs text-[#8B9A97] hover:text-[#F7F9F8] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded"
          >
            <ArrowLeft className="inline w-3 h-3 mr-1" />
            Voltar para o painel
          </Link>
        </div>
      </div>
    </div>
  )
}
