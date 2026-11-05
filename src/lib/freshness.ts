// The installed iPhone app can keep running an old cached copy after an update.
// On start (and when you come back to the app) this asks the server which build it has,
// and if it's newer, clears the old copy and reloads once.

const FLAG = 'screengrave:refreshed-for'

async function check() {
  if (import.meta.env.DEV) return
  try {
    const res = await fetch(`/build.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const { build } = (await res.json()) as { build?: string }
    if (!build || build === __BUILD_ID__) {
      sessionStorage.removeItem(FLAG)
      return
    }
    if (sessionStorage.getItem(FLAG) === build) return // already tried once; don't loop
    sessionStorage.setItem(FLAG, build)

    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.update().catch(() => {})))
    if ('caches' in window) {
      for (const key of await caches.keys()) await caches.delete(key)
    }
    window.location.reload()
  } catch {
    // offline or storage blocked: keep the current copy
  }
}

export function keepFresh() {
  void check()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
}
