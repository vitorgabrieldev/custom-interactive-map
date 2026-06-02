import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY_ANON as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface AuthResult {
  username: string
  userId: string
  isNew: boolean
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('invalid login credentials') || msg.includes('invalid email or password'))
      throw new Error('SENHA_INCORRETA')
    if (msg.includes('email not confirmed'))
      throw new Error('CONFIRME_EMAIL')
    throw new Error(error.message)
  }

  if (!data.session) throw new Error('CONFIRME_EMAIL')

  const username =
    (data.user.user_metadata?.username as string | undefined) ||
    data.user.email?.split('@')[0] ||
    'Sobrevivente'

  return { username, userId: data.user.id, isNew: false }
}

export async function register(username: string, email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('user already') || msg.includes('email_exists'))
      throw new Error('EMAIL_JA_CADASTRADO')
    throw new Error(error.message)
  }

  if (!data.session) throw new Error('CONFIRME_EMAIL')

  return { username, userId: data.user!.id, isNew: true }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getStoredSession(): Promise<AuthResult | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const username =
    (session.user.user_metadata?.username as string | undefined) ||
    session.user.email?.split('@')[0] ||
    'Sobrevivente'

  return { username, userId: session.user.id, isNew: false }
}
