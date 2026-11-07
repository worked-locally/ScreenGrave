import { useState, type FormEvent } from 'react'
import { MethodPicker, SecretInput } from '../components/SignInChoice'
import { secretProblem, setupAccount, type Method } from '../lib/auth'

// First run: your name and how you'd like to sign in. Shown only until it's chosen.

export default function Setup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [method, setMethod] = useState<Method>('pin')
  const [secret, setSecret] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function pick(m: Method) {
    setMethod(m)
    setSecret('')
    setConfirm('')
    setMessage('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (method !== 'none') {
      const problem = secretProblem(method, secret)
      if (problem) return setMessage(problem)
      if (secret !== confirm) return setMessage(method === 'pin' ? "The PINs don't match." : "The passwords don't match.")
    }
    setBusy(true)
    setMessage('')
    const error = await setupAccount(name.trim(), method, method === 'none' ? '' : secret)
    setBusy(false)
    if (error) setMessage(error)
    else onDone()
  }

  const field = 'w-full rounded-2xl bg-[#1f1a24] px-4 py-3.5 text-base outline-none placeholder:text-[#8b8392]'
  const word = method === 'pin' ? 'PIN' : 'password'

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="anim-fade w-full max-w-sm">
        <h1 className="text-center text-3xl font-semibold tracking-tight">
          Screen<span style={{ color: 'var(--accent)' }}>Grave</span>
        </h1>
        <p className="mt-2 text-center text-sm text-[#8b8392]">Welcome. Two quick things and you're in.</p>

        <label htmlFor="setup-name" className="mt-8 block px-1 text-sm font-semibold text-[#8b8392]">
          Your name
        </label>
        <input
          id="setup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={24}
          autoComplete="nickname"
          className={field + ' mt-2'}
        />

        <p className="mt-6 px-1 text-sm font-semibold text-[#8b8392]">How would you like to sign in?</p>
        <div className="mt-2">
          <MethodPicker value={method} onChange={pick} />
        </div>

        {method !== 'none' && (
          <div className="mt-4 space-y-3">
            <SecretInput method={method} value={secret} onChange={setSecret} className={field} />
            <SecretInput
              method={method}
              value={confirm}
              onChange={setConfirm}
              placeholder={`Type the ${word} again`}
              className={field}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={busy || (method !== 'none' && (!secret || !confirm))}
          className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#1a1008' }}
        >
          {busy ? 'Setting up…' : method === 'none' ? 'Continue without sign-in' : 'Create and sign in'}
        </button>

        <p className="mt-3 min-h-5 text-center text-sm text-red-400">{message}</p>
        <p className="mt-4 text-center text-xs leading-relaxed text-[#6b6473]">You can change this later in Settings.</p>
      </form>
    </div>
  )
}
