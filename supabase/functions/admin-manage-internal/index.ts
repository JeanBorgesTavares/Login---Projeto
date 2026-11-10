// F1-004 · SPEC-F1-01 · CA-F1-01-04 · S105
// admin-manage-internal: convite e desativação de internos.
// A chave service_role existe APENAS neste servidor (env do Supabase) —
// nunca é exposta ao navegador ou ao Skip.
// O ator é identificado pelo JWT do próprio chamador (auth.uid()) — sem parâmetro spoofável.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'método não permitido' })
  }

  // 1. Quem chama: JWT enviado pelo próprio usuário.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return json(401, { error: 'não autenticado' })
  }

  // Cliente do servidor para identificar o usuário e gerir auth.users.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: callerData, error: callerErr } = await adminClient.auth.getUser(token)
  if (callerErr || !callerData?.user) {
    return json(401, { error: 'sessão inválida' })
  }
  const caller = callerData.user

  // 2. Só admin ativo opera — validado NO BANCO, não em tela.
  const { data: callerProfile, error: profileErr } = await adminClient
    .from('profiles')
    .select('role, status')
    .eq('user_id', caller.id)
    .maybeSingle()
  if (profileErr) {
    return json(500, { error: 'falha ao verificar o perfil do solicitante' })
  }
  if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.status !== 'active') {
    return json(403, { error: 'somente administradores ativos executam esta ação' })
  }

  // 3. Cliente com o JWT do chamador para as RPCs — o banco identifica o ator via auth.uid().
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return json(400, { error: 'corpo inválido' })
  }
  const action = String('')
  const act = String((body as Record<string, unknown>).action ?? '')

  // ---- convite de interno ----
  if (act === 'invite') {
    const email = String((body as Record<string, unknown>).email ?? '')
      .trim()
      .toLowerCase()
    const fullName = String((body as Record<string, unknown>).full_name ?? '').trim()
    const role = String((body as Record<string, unknown>).role ?? 'operator')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'e-mail inválido' })
    }
    if (!fullName) {
      return json(400, { error: 'nome é obrigatório' })
    }
    // Admin não nasce de convite: procedimento controlado (SPEC-F1-01).
    if (role !== 'operator') {
      return json(400, {
        error: 'convite cria apenas operadores; administrador é criado por procedimento controlado',
      })
    }

    // Passo 1: cria o usuário no Auth.
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createErr || !created?.user) {
      // Idempotência por e-mail: já existe não cria acesso parcial nem duplicata.
      const msg = (createErr?.message ?? '').toLowerCase()
      const code = (createErr as { code?: string } | null)?.code ?? ''
      if (msg.includes('already') || code === 'email_exists') {
        return json(200, {
          ok: true,
          idempotent: true,
          message: 'usuário já existe; nada foi alterado',
        })
      }
      return json(500, { error: 'falha ao criar usuário', detail: createErr?.message ?? '' })
    }
    const newUserId = created.user.id

    // Passo 2: registra perfil + auditoria numa transação (RPC com o JWT do chamador).
    const { error: rpcErr } = await userClient.rpc('admin_register_internal', {
      p_user_id: newUserId,
      p_full_name: fullName,
      p_role: role,
    })

    if (rpcErr) {
      // Ação parcial é REVERTIDA: sem perfil não fica usuário órfão (S105).
      await adminClient.auth.admin.deleteUser(newUserId)
      return json(500, {
        error: 'falha ao registrar perfil; criação revertida',
        detail: rpcErr.message,
      })
    }

    return json(200, { ok: true, user_id: newUserId, status: 'pending', role: 'operator' })
  }

  // ---- ativar/desativar interno ----
  if (act === 'set_status') {
    const userId = String((body as Record<string, unknown>).user_id ?? '')
    const status = String((body as Record<string, unknown>).status ?? '')
    if (!userId) {
      return json(400, { error: 'user_id é obrigatório' })
    }
    if (!['pending', 'active', 'disabled'].includes(status)) {
      return json(400, { error: 'status inválido' })
    }

    const { error: rpcErr } = await userClient.rpc('admin_set_internal_status', {
      p_user_id: userId,
      p_status: status,
    })
    if (rpcErr) {
      return json(500, { error: 'falha ao mudar status', detail: rpcErr.message })
    }

    return json(200, { ok: true, user_id: userId, status })
  }

  return json(400, { error: 'ação desconhecida' })
})
