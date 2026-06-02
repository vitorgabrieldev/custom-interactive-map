import { useState, type FormEvent } from 'react'
import { login, register, type AuthResult } from '../../lib/supabase'
import './AuthScreen.css'

interface Props {
  onAuth: (result: AuthResult) => void
}

const USERNAME_RE = /^[a-zA-Z0-9]{1,12}$/
const PASSWORD_RE = /^\d{6,8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateLogin(email: string, password: string): string | null {
  if (!email) return 'INFORME SEU E-MAIL'
  if (!EMAIL_RE.test(email)) return 'E-MAIL INVÁLIDO'
  if (!password) return 'INFORME SEU CÓDIGO DE ACESSO'
  if (!PASSWORD_RE.test(password)) return 'CÓDIGO: SOMENTE DÍGITOS — 6 A 8 NÚMEROS'
  return null
}

function validateRegister(username: string, email: string, password: string): string | null {
  if (!username) return 'INFORME SEU NOME DE SOBREVIVENTE'
  if (!USERNAME_RE.test(username)) return 'NOME: SOMENTE LETRAS E NÚMEROS — MÁX. 12 CARACTERES'
  if (!email) return 'INFORME SEU E-MAIL'
  if (!EMAIL_RE.test(email)) return 'E-MAIL INVÁLIDO'
  if (!password) return 'INFORME SEU CÓDIGO DE ACESSO'
  if (!PASSWORD_RE.test(password)) return 'CÓDIGO: SOMENTE DÍGITOS — 6 A 8 NÚMEROS'
  return null
}

function friendlyError(raw: string): string {
  const r = raw.toLowerCase()
  if (r === 'senha_incorreta')
    return 'CÓDIGO DE ACESSO INCORRETO — IDENTIDADE NÃO CONFIRMADA'
  if (r === 'confirme_email')
    return 'VERIFIQUE SEU E-MAIL — CONFIRMAÇÃO NECESSÁRIA PARA ENTRAR NA ZONA'
  if (r === 'email_ja_cadastrado')
    return 'ESTE E-MAIL JÁ PERTENCE A OUTRO SOBREVIVENTE'
  if (r.includes('invalid email') || r.includes('email address'))
    return 'E-MAIL INVÁLIDO — FORNEÇA UM ENDEREÇO REAL PARA COMUNICAÇÃO'
  if (r.includes('weak password') || r.includes('password'))
    return 'CÓDIGO DE ACESSO MUITO FRACO — USE 6 A 8 DÍGITOS'
  if (r.includes('network') || r.includes('fetch'))
    return 'FALHA NA CONEXÃO COM O SERVIDOR — TENTE NOVAMENTE'
  return 'ACESSO NEGADO — ' + raw.toUpperCase()
}

export function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError =
      mode === 'login'
        ? validateLogin(email, password)
        : validateRegister(username, email, password)

    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const result =
        mode === 'login'
          ? await login(email, password)
          : await register(username, email, password)
      onAuth(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ERRO_DESCONHECIDO'
      setError(friendlyError(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__scanlines" />

      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__coords">
            23°33&apos;S 46°38&apos;W &nbsp;·&nbsp; <span className="auth-card__coords--danger">ZONA VERMELHA ATIVA</span>
          </div>
          <h1 className="auth-card__title">SEJA BEM VINDO</h1>
          <p className="auth-card__subtitle">
            PARA ACESSAR O MAPA, INFORME SEU NOME DE SOBREVIVENTE E CÓDIGO DE ACESSO
          </p>
        </div>

        {/* Mode tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('login')}
          >
            ACESSAR
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('register')}
          >
            CADASTRAR
          </button>
        </div>

        <form className="auth-card__form" onSubmit={handleSubmit} noValidate autoComplete="off">
          {mode === 'register' && (
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="auth-username">
                SOBREVIVENTE
              </label>
              <input
                id="auth-username"
                className="auth-field__input"
                type="text"
                autoComplete="new-password"
                placeholder="até 12 caracteres"
                maxLength={12}
                value={username}
                onChange={(e) => {
                  setError(null)
                  setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))
                }}
                disabled={loading}
                spellCheck={false}
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="auth-email">
              E-MAIL
            </label>
            <input
              id="auth-email"
              className="auth-field__input"
              type="email"
              autoComplete="new-password"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => {
                setError(null)
                setEmail(e.target.value.trim())
              }}
              disabled={loading}
              spellCheck={false}
            />
          </div>

          <div className="auth-field">
            <label className="auth-field__label" htmlFor="auth-password">
              CÓDIGO DE ACESSO
            </label>
            <input
              id="auth-password"
              className="auth-field__input"
              type="password"
              autoComplete="new-password"
              placeholder="6–8 dígitos numéricos"
              maxLength={8}
              inputMode="numeric"
              value={password}
              onChange={(e) => {
                setError(null)
                setPassword(e.target.value.replace(/\D/g, ''))
              }}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-submit__loading">
                <span className="auth-submit__spinner" />
                VERIFICANDO...
              </span>
            ) : (
              mode === 'login' ? 'ACESSAR' : 'CADASTRAR'
            )}
          </button>
        </form>

        <div className="auth-card__footer">
          SOBREVIVÊNCIA COLABORATIVA &nbsp;·&nbsp; VERSÃO 0.1
        </div>
      </div>
    </div>
  )
}
