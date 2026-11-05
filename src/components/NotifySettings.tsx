import { useEffect, useState } from 'react'

type Service = 'discord' | 'ntfy' | 'gotify' | 'telegram' | 'webhook'

interface Config {
  enabled: boolean
  service: Service
  hour: number
  timeZone: string
  url: string
  topic: string
  token: string
  chatId: string
  lastRun: string
}

const SERVICES: { id: Service; name: string; help: string }[] = [
  { id: 'discord', name: 'Discord', help: 'In Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.' },
  { id: 'ntfy', name: 'ntfy', help: 'Pick a hard-to-guess topic name, then subscribe to the same topic in the ntfy app.' },
  { id: 'gotify', name: 'Gotify', help: 'In Gotify: Apps → Create application, then copy its token.' },
  { id: 'telegram', name: 'Telegram', help: 'Create a bot with @BotFather for the token. Message your bot once, then use your chat ID.' },
  { id: 'webhook', name: 'Webhook', help: 'ScreenGrave sends a JSON POST. Works with Home Assistant, n8n, and similar tools.' },
]

const hourLabel = (h: number) =>
  new Date(2026, 0, 1, h).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/notify${path}`, {
    ...init,
    headers: { 'content-type': 'application/json' },
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Something went wrong (${res.status}).`)
  return body
}

export default function NotifySettings() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    request<Config>('')
      .then(setCfg)
      .catch(() => setNote({ ok: false, text: "Couldn't load notification settings." }))
  }, [])

  if (!cfg) return <p className="px-4 py-3.5 text-xs text-[#8b8392]">{note?.text ?? 'Loading…'}</p>

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg({ ...cfg, [k]: v })
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  async function act(label: string, fn: () => Promise<string>) {
    setBusy(label)
    setNote(null)
    try {
      setNote({ ok: true, text: await fn() })
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy('')
    }
  }

  const save = (enabled = cfg.enabled) =>
    act('save', async () => {
      const next = await request<Config>('', { method: 'PUT', body: JSON.stringify({ ...cfg, enabled, timeZone }) })
      setCfg(next)
      return next.enabled ? `Saved. You'll hear from ScreenGrave around ${hourLabel(next.hour)}.` : 'Saved. Notifications are off.'
    })

  const field = 'mt-1.5 w-full rounded-xl bg-[#16131a] px-3 py-2.5 text-base outline-none placeholder:text-[#6b6473]'
  const label = 'block text-xs text-[#8b8392]'
  const service = SERVICES.find((s) => s.id === cfg.service)!

  return (
    <div className="space-y-4 px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">New episodes and releases</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#8b8392]">
            One message a day for shows you follow and movies on your watchlist.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={cfg.enabled}
          aria-label="Notifications"
          onClick={() => void save(!cfg.enabled)}
          className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
          style={{ background: cfg.enabled ? 'var(--accent)' : '#3a3340' }}
        >
          <span
            className="absolute top-1 h-5 w-5 rounded-full bg-[#efe9df] transition-transform"
            style={{ left: 4, transform: cfg.enabled ? 'translateX(20px)' : 'none' }}
          />
        </button>
      </div>

      <div>
        <span className={label}>Send to</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SERVICES.map((s) => (
            <button
              key={s.id}
              onClick={() => set('service', s.id)}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={
                cfg.service === s.id
                  ? { background: 'var(--accent)', color: '#1a1008' }
                  : { background: '#16131a', color: '#cdc6bd' }
              }
            >
              {s.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#8b8392]">{service.help}</p>
      </div>

      {(cfg.service === 'discord' || cfg.service === 'webhook') && (
        <label className={label}>
          {cfg.service === 'discord' ? 'Webhook URL' : 'URL'}
          <input value={cfg.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" autoComplete="off" className={field} />
        </label>
      )}

      {cfg.service === 'ntfy' && (
        <>
          <label className={label}>
            Topic
            <input value={cfg.topic} onChange={(e) => set('topic', e.target.value)} placeholder="screengrave-jimmy-x7k2" autoComplete="off" className={field} />
          </label>
          <label className={label}>
            Server (leave empty for ntfy.sh)
            <input value={cfg.url} onChange={(e) => set('url', e.target.value)} placeholder="https://ntfy.sh" autoComplete="off" className={field} />
          </label>
          <label className={label}>
            Access token (only for protected topics)
            <input value={cfg.token} onChange={(e) => set('token', e.target.value)} placeholder="Optional" autoComplete="off" className={field} />
          </label>
        </>
      )}

      {cfg.service === 'gotify' && (
        <>
          <label className={label}>
            Server
            <input value={cfg.url} onChange={(e) => set('url', e.target.value)} placeholder="https://gotify.example.com" autoComplete="off" className={field} />
          </label>
          <label className={label}>
            App token
            <input value={cfg.token} onChange={(e) => set('token', e.target.value)} autoComplete="off" className={field} />
          </label>
        </>
      )}

      {cfg.service === 'telegram' && (
        <>
          <label className={label}>
            Bot token
            <input value={cfg.token} onChange={(e) => set('token', e.target.value)} placeholder="123456:ABC…" autoComplete="off" className={field} />
          </label>
          <label className={label}>
            Chat ID
            <input value={cfg.chatId} onChange={(e) => set('chatId', e.target.value)} placeholder="123456789" autoComplete="off" className={field} />
          </label>
        </>
      )}

      <label className={label}>
        Time of day
        <select
          value={cfg.hour}
          onChange={(e) => set('hour', Number(e.target.value))}
          className="mt-1.5 w-full rounded-xl bg-[#16131a] px-3 py-2.5 text-base outline-none"
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-[#6b6473]">Your time zone: {timeZone}</span>
      </label>

      {note && (
        <p className="text-xs leading-relaxed" style={{ color: note.ok ? 'var(--done)' : '#f87171' }}>
          {note.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => void save()}
          disabled={!!busy}
          className="rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#1a1008' }}
        >
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() =>
            void act('test', async () => {
              await request('', { method: 'PUT', body: JSON.stringify({ ...cfg, timeZone }) })
              await request('/test', { method: 'POST' })
              return 'Test sent. Check your app.'
            })
          }
          disabled={!!busy}
          className="rounded-full bg-[#16131a] px-4 py-1.5 text-sm font-medium text-[#cdc6bd] disabled:opacity-50"
        >
          {busy === 'test' ? 'Sending…' : 'Send test'}
        </button>
        {cfg.enabled && (
          <button
            onClick={() =>
              void act('run', async () => {
                const r = await request<{ sent: number; skipped?: string }>('/run', { method: 'POST' })
                return r.skipped ?? (r.sent ? `Sent ${r.sent} release${r.sent === 1 ? '' : 's'} out today.` : 'Nothing new out today.')
              })
            }
            disabled={!!busy}
            className="rounded-full bg-[#16131a] px-4 py-1.5 text-sm font-medium text-[#cdc6bd] disabled:opacity-50"
          >
            {busy === 'run' ? 'Checking…' : 'Check today now'}
          </button>
        )}
      </div>
    </div>
  )
}
