import { useState, type FormEvent } from 'react'
import { SecretInput } from '../components/SignInChoice'
import { login, type Method } from '../lib/auth'

interface Props {
  username: string
  method: Method
  onSuccess: () => void
}

export default function Login({ username, method, onSuccess }: Props) {
  const word = method === 'pin' ? 'PIN' : 'password'
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setMessage('')
    const result = await login(password)
    setBusy(false)
    if (result === 'ok') {
      onSuccess()
      return
    }
    setPassword('')
    setMessage(
      result === 'wrong'
        ? `Wrong ${word}. Try again.`
        : result === 'locked'
          ? 'Too many attempts. Wait a few minutes and try again.'
          : "Couldn't reach the server.",
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="anim-fade w-full max-w-sm">
        <h1 className="text-center text-3xl font-semibold tracking-tight">
          Screen<span style={{ color: 'var(--accent)' }}>Grave</span>
        </h1>
        <p className="mt-2 text-center text-sm text-[#8b8392]">Welcome back, {username}</p>

        {/* lets password managers and iCloud Keychain remember the login */}
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />

        <SecretInput
          method={method}
          value={password}
          onChange={setPassword}
          placeholder={method === 'pin' ? 'PIN' : 'Password'}
          autoComplete="current-password"
          autoFocus
          className="mt-8 w-full rounded-2xl bg-[#1f1a24] px-4 py-3.5 text-base outline-none placeholder:text-[#8b8392]"
        />

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-3 w-full rounded-2xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#1a1008' }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="mt-3 h-5 text-center text-sm text-red-400">{message}</p>

        <p className="mt-8 text-center text-xs text-[#6b6473]">This ScreenGrave server is private.</p>
      </form>
    </div>
  )
}