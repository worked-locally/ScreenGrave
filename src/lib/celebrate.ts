// ask for a little party: a burst from where you tapped and a short message at the top
export const CELEBRATE_EVENT = 'screengrave:celebrate'

export function celebrate(text: string, from?: { x: number; y: number }) {
  window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { text, from } }))
}
