import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Cliente Supabase ─────────────────────────────────────────────────────────
// Degrada graciosamente quando as variáveis não estão configuradas.
// Nesse caso, o app funciona em modo local (localStorage only).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

/** Retorna true se o Supabase está configurado e disponível */
export const isSupabaseEnabled = !!supabase

if (!isSupabaseEnabled && typeof window !== 'undefined') {
  console.warn(
    '[QuizDida] Supabase não configurado — executando em modo local (sem ranking compartilhado).\n' +
    'Configure as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local',
  )
}
