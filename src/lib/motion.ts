// Short full-screen motion presets for the search box. Loaded only when one is needed.

type Cleanup = () => void

let current: Cleanup | null = null
let timer = 0

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const stage = () => document.querySelector<HTMLElement>('[data-stage]')

function layer(css = ''): HTMLDivElement {
  const d = document.createElement('div')
  d.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden;${css}`
  document.body.appendChild(d)
  return d
}

function piece(parent: HTMLElement, css: string): HTMLDivElement {
  const d = document.createElement('div')
  d.style.cssText = `position:absolute;${css}`
  parent.appendChild(d)
  return d
}

// posters and carousel cases currently on screen
function onScreen(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-poster], [data-card]'))
    .filter((el) => {
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
    })
    .slice(0, 40)
}

function centerOf(el: HTMLElement | null) {
  const r = el?.getBoundingClientRect()
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, r } : { x: innerWidth / 2, y: innerHeight / 3, r: null }
}

const fadeOut = (el: HTMLElement, ms = 400) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' })

// ---------- the presets ----------

function reel(): [Cleanup, number] {
  const st = stage()
  const prev = st?.style.filter ?? ''
  if (st) {
    st.style.transition = 'filter 300ms'
    st.style.filter = 'sepia(0.75) contrast(1.15) brightness(0.92)'
  }
  const l = layer('box-shadow: inset 0 0 140px rgba(0,0,0,0.85); background: rgba(70,45,20,0.12)')
  l.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 0.95 }, { opacity: 0.7 }, { opacity: 1 }], {
    duration: 220,
    iterations: Infinity,
  })
  for (let i = 0; i < 3; i++) {
    const s = piece(l, `top:0;bottom:0;width:1px;left:${rand(10, 90)}%;background:rgba(255,245,220,0.45)`)
    s.animate(
      [{ left: `${rand(5, 95)}%` }, { left: `${rand(5, 95)}%` }, { left: `${rand(5, 95)}%` }],
      { duration: rand(400, 900), iterations: Infinity, easing: 'steps(3)' },
    )
  }
  for (let i = 0; i < 40; i++) {
    const g = piece(l, `width:2px;height:2px;border-radius:9999px;background:rgba(255,250,235,0.5);left:${rand(0, 100)}%;top:${rand(0, 100)}%`)
    g.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: rand(80, 200), iterations: Infinity, delay: rand(0, 300) })
  }
  return [
    () => {
      if (st) st.style.filter = prev
      l.remove()
    },
    3200,
  ]
}

function scan(anchor: HTMLElement | null): [Cleanup, number] {
  const l = layer('background: rgba(255,30,30,0.10)')
  l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 })
  const line = piece(l, 'left:0;right:0;height:2px;top:0;background:rgba(255,70,70,0.95);box-shadow:0 0 14px 3px rgba(255,40,40,0.7)')
  line.animate([{ top: '0%' }, { top: '100%' }], { duration: 1300, iterations: 2, easing: 'ease-in-out' })
  const { r } = centerOf(anchor)
  if (r) {
    const corners: [string, string][] = [
      ['left', 'top'],
      ['right', 'top'],
      ['left', 'bottom'],
      ['right', 'bottom'],
    ]
    for (const [h, v] of corners) {
      const x = h === 'left' ? r.left - 6 : r.right - 14
      const y = v === 'top' ? r.top - 6 : r.bottom - 14
      const c = piece(
        l,
        `width:20px;height:20px;left:${x}px;top:${y}px;border-${h}:2px solid #ff4a4a;border-${v}:2px solid #ff4a4a`,
      )
      const dx = h === 'left' ? -40 : 40
      const dy = v === 'top' ? -40 : 40
      c.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
          { transform: 'translate(0, 0)', opacity: 1, offset: 0.4 },
          { opacity: 0.2, offset: 0.55 },
          { opacity: 1, offset: 0.7 },
          { opacity: 0.2, offset: 0.85 },
          { opacity: 1 },
        ],
        { duration: 1800, fill: 'forwards', easing: 'ease-out' },
      )
    }
  }
  return [() => l.remove(), 2900]
}

function rain(): [Cleanup, number] {
  const l = layer()
  const c = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = innerWidth * dpr
  c.height = innerHeight * dpr
  c.style.cssText = 'width:100%;height:100%'
  l.appendChild(c)
  const ctx = c.getContext('2d')!
  ctx.scale(dpr, dpr)
  const size = 15
  const cols = Math.ceil(innerWidth / size)
  const drops = Array.from({ length: cols }, () => rand(-30, 0))
  const glyphs = 'アカサタナハマヤラワイキシチニヒミリ0123456789'
  ctx.font = `${size}px ui-monospace, monospace`
  let frame = 0
  const draw = () => {
    ctx.fillStyle = 'rgba(8, 10, 8, 0.14)'
    ctx.fillRect(0, 0, innerWidth, innerHeight)
    for (let i = 0; i < cols; i++) {
      const ch = glyphs[Math.floor(Math.random() * glyphs.length)]
      ctx.fillStyle = Math.random() > 0.96 ? '#d8ffe0' : '#3dff7a'
      ctx.fillText(ch, i * size, drops[i] * size)
      if (drops[i] * size > innerHeight && Math.random() > 0.95) drops[i] = 0
      drops[i] += 1
    }
    frame = window.setTimeout(() => requestAnimationFrame(draw), 45)
  }
  draw()
  window.setTimeout(() => fadeOut(l, 600), 3400)
  return [
    () => {
      window.clearTimeout(frame)
      l.remove()
    },
    4000,
  ]
}

function dust(): [Cleanup, number] {
  const items = onScreen()
  const l = layer()
  const anims: Animation[] = []
  items.forEach((el) => {
    const delay = rand(0, 700)
    anims.push(
      el.animate(
        [
          { transform: 'none', filter: 'none', opacity: 1 },
          { transform: `translate(${rand(20, 60)}px, ${rand(-40, -15)}px)`, filter: 'blur(6px)', opacity: 0 },
        ],
        { duration: 900, delay, fill: 'forwards', easing: 'ease-in' },
      ),
    )
    const r = el.getBoundingClientRect()
    for (let i = 0; i < 7; i++) {
      const s = piece(
        l,
        `width:3px;height:3px;border-radius:9999px;background:${i % 2 ? '#8a7560' : '#5e5048'};left:${rand(r.left, r.right)}px;top:${rand(r.top, r.bottom)}px;opacity:0`,
      )
      s.animate(
        [
          { transform: 'translate(0,0)', opacity: 0.9 },
          { transform: `translate(${rand(40, 120)}px, ${rand(-80, -20)}px)`, opacity: 0 },
        ],
        { duration: rand(900, 1500), delay: delay + rand(0, 300), easing: 'ease-out' },
      )
    }
  })
  // ...and back again
  const back = window.setTimeout(() => {
    items.forEach((el, i) => {
      anims[i]?.cancel()
      el.animate([{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'none' }], { duration: 700, easing: 'ease-out' })
    })
  }, 2500)
  return [
    () => {
      window.clearTimeout(back)
      anims.forEach((a) => a.cancel())
      l.remove()
    },
    3300,
  ]
}

function sprout(anchor: HTMLElement | null): [Cleanup, number] {
  const l = layer()
  const { x, r } = centerOf(anchor)
  // sprout from the bottom edge of the search box and drift down over the page
  const baseY = r ? r.bottom - 6 : innerHeight / 3
  const spread = r ? r.width / 2 - 10 : 120
  for (let i = 0; i < 22; i++) {
    const w = rand(10, 16)
    const leaf = piece(
      l,
      `width:${w}px;height:${w * 1.4}px;left:${x + rand(-spread, spread)}px;top:${baseY}px;border-radius:0 100% 0 100%;background:${i % 3 ? '#74c55e' : '#4f9a43'};box-shadow:inset -2px -2px 0 rgba(0,0,0,0.15);opacity:0`,
    )
    const dx = rand(-50, 50)
    leaf.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(0.2)', opacity: 0 },
        { transform: `translate(${dx * 0.3}px, 10px) rotate(${rand(-30, 30)}deg) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${dx}px, ${rand(110, 170)}px) rotate(${rand(-90, 90)}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${-dx * 0.5}px, ${rand(260, 380)}px) rotate(${rand(-200, 200)}deg) scale(0.85)`, opacity: 0 },
      ],
      { duration: rand(2400, 3200), delay: i * 60, easing: 'ease-in-out', fill: 'forwards' },
    )
  }
  return [() => l.remove(), 4400]
}

function sweep(): [Cleanup, number] {
  const l = layer()
  const blade = piece(
    l,
    'left:0;top:42%;width:46vw;height:4px;border-radius:9999px;background:linear-gradient(90deg,transparent,#f2fdff 30%,#f2fdff 70%,transparent);box-shadow:0 0 18px 6px rgba(90,200,255,0.75),0 0 40px 12px rgba(90,200,255,0.35)',
  )
  blade.animate(
    [
      { transform: 'translateX(-60vw) rotate(-8deg)', opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: 'translateX(150vw) rotate(-8deg)', opacity: 1 },
    ],
    { duration: 750, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' },
  )
  const items = onScreen()
  items.forEach((el, i) =>
    el.animate(
      [
        { transform: 'none' },
        { transform: `translateX(${rand(24, 44)}px) rotate(${rand(1, 3)}deg)`, offset: 0.35 },
        { transform: 'none' },
      ],
      { duration: 1300, delay: 250 + i * 12, easing: 'cubic-bezier(.3,.7,.3,1)' },
    ),
  )
  return [() => l.remove(), 1900]
}

function bow(): [Cleanup, number] {
  const st = stage()
  const l = layer()
  if (st) {
    st.style.transformOrigin = '50% 100%'
    st.animate(
      [
        { transform: 'none' },
        { transform: 'perspective(900px) rotateX(5deg) rotate(-2deg) translateY(-10px)', offset: 0.3 },
        { transform: 'perspective(900px) rotateX(5deg) rotate(-1.5deg) translateY(-12px)', offset: 0.75 },
        { transform: 'none' },
      ],
      { duration: 3300, easing: 'ease-in-out' },
    )
  }
  for (let i = 0; i < 22; i++) {
    const s = piece(
      l,
      `right:-30vw;top:${rand(5, 95)}%;width:${rand(70, 170)}px;height:1.5px;border-radius:9999px;background:rgba(235,245,255,${rand(0.2, 0.45)})`,
    )
    s.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-160vw)' }], {
      duration: rand(550, 900),
      delay: rand(0, 2600),
      easing: 'linear',
      fill: 'both',
    })
  }
  return [() => l.remove(), 3500]
}

function dawn(): [Cleanup, number] {
  const st = stage()
  const l = layer()
  const glow = piece(
    l,
    'inset:0;background:radial-gradient(120% 75% at 50% 115%, rgba(255,166,77,0.55), rgba(255,110,60,0.22) 45%, transparent 72%)',
  )
  glow.animate(
    [
      { transform: 'translateY(45%)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1, offset: 0.35 },
      { transform: 'translateY(0)', opacity: 1, offset: 0.8 },
      { transform: 'translateY(10%)', opacity: 0 },
    ],
    { duration: 3800, easing: 'ease-in-out', fill: 'forwards' },
  )
  if (st) {
    st.style.transformOrigin = '50% 100%'
    st.animate([{ transform: 'rotate(-0.8deg)' }, { transform: 'rotate(0.8deg)' }], {
      duration: 900,
      iterations: 4,
      direction: 'alternate',
      easing: 'ease-in-out',
    })
  }
  return [() => l.remove(), 3900]
}

function light(anchor: HTMLElement | null): [Cleanup, number] {
  const { x, y } = centerOf(anchor)
  const l = layer(
    `--x:${x}px;--y:${y}px;background:radial-gradient(circle 140px at var(--x) var(--y), rgba(255,240,200,0.10), transparent 55%, rgba(6,5,9,0.95) 100%)`,
  )
  l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'forwards' })
  const move = (e: PointerEvent) => {
    l.style.setProperty('--x', `${e.clientX}px`)
    l.style.setProperty('--y', `${e.clientY}px`)
  }
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerdown', move, { passive: true })
  return [
    () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      l.remove()
    },
    15000,
  ]
}

function bloom(anchor: HTMLElement | null): [Cleanup, number] {
  const l = layer('background: rgba(4,10,30,0.35)')
  l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: 'forwards' })
  const dot = (x: number, y: number, big = false) => {
    const s = rand(big ? 10 : 6, big ? 18 : 12)
    const d = piece(
      l,
      `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;border-radius:9999px;background:radial-gradient(circle,#b8f7ff,#3cc8ff 45%,transparent 70%);box-shadow:0 0 14px rgba(60,200,255,0.8)`,
    )
    d.animate(
      [
        { transform: 'scale(0.2)', opacity: 1 },
        { transform: 'scale(1.6)', opacity: 0 },
      ],
      { duration: rand(1200, 1800), easing: 'ease-out', fill: 'forwards' },
    ).onfinish = () => d.remove()
  }
  const { x, y } = centerOf(anchor)
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI * 2 * i) / 24
    window.setTimeout(() => dot(x + Math.cos(a) * rand(30, 90), y + Math.sin(a) * rand(30, 90), true), i * 30)
  }
  let last = 0
  const touch = (e: PointerEvent) => {
    const now = performance.now()
    if (e.type === 'pointermove' && now - last < 40) return
    last = now
    dot(e.clientX + rand(-8, 8), e.clientY + rand(-8, 8), e.type === 'pointerdown')
  }
  window.addEventListener('pointermove', touch, { passive: true })
  window.addEventListener('pointerdown', touch, { passive: true })
  const dim = window.setTimeout(() => fadeOut(l, 800), 8200)
  return [
    () => {
      window.clearTimeout(dim)
      window.removeEventListener('pointermove', touch)
      window.removeEventListener('pointerdown', touch)
      l.remove()
    },
    9000,
  ]
}

function beat(): [Cleanup, number] {
  const st = stage()
  if (st) {
    st.style.transformOrigin = '50% 100%'
    st.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-14px) scale(1.01, 0.99)', offset: 0.3 },
        { transform: 'translateY(0) scale(1.02, 0.97)', offset: 0.55 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: 500, iterations: 6, easing: 'ease-out' },
    )
  }
  onScreen().forEach((el, i) =>
    el.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${i % 2 ? 4 : -4}deg)` }, { transform: 'rotate(0)' }], {
      duration: 500,
      iterations: 6,
      delay: 250,
    }),
  )
  return [() => {}, 3400]
}

function flip(): [Cleanup, number] {
  onScreen().forEach((el, i) =>
    el.animate(
      [
        { transform: 'perspective(600px) rotateY(0) scale(1)' },
        { transform: 'perspective(600px) rotateY(90deg) scale(0.88)', offset: 0.35 },
        { transform: 'perspective(600px) rotateY(-90deg) scale(0.88) translateY(8px)', offset: 0.36 },
        { transform: 'perspective(600px) rotateY(0) scale(1.04) translateY(-6px)', offset: 0.75 },
        { transform: 'perspective(600px) rotateY(0) scale(1)' },
      ],
      { duration: 1150, delay: i * 45, easing: 'cubic-bezier(.5,0,.3,1)' },
    ),
  )
  return [() => {}, 1150 + 45 * 40]
}

const RUN: Record<string, (anchor: HTMLElement | null) => [Cleanup, number]> = {
  reel,
  scan,
  rain,
  dust,
  sprout,
  sweep,
  bow,
  dawn,
  light,
  bloom,
  beat,
  flip,
}

function stop() {
  window.clearTimeout(timer)
  current?.()
  current = null
}

export function play(name: string, anchor: HTMLElement | null) {
  if (name === 'off') return stop()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const run = RUN[name]
  if (!run) return
  stop()
  const [cleanup, ms] = run(anchor)
  current = cleanup
  timer = window.setTimeout(stop, ms)
}
