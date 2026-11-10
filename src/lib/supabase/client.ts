// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase/client";

// O types.ts é gerado a partir do schema do banco conectado. Enquanto o projeto
// não tem tabelas expostas, o genérico Database sai vazio e toda chamada
// .from()/.rpc() fica tipada como `never` (30+ erros de TypeScript). O cliente
// é criado sem o genérico até o schema ser gerado novamente com as tabelas.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})
