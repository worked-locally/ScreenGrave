// Where the floating up arrow should start showing: just below the nth row of posters
// (anything marked data-poster) inside `el`. Infinity when there are fewer rows than that.
export function pastRow(el: HTMLElement | null, n: number): number {
  const posters = Array.from(el?.querySelectorAll<HTMLElement>('[data-poster]') ?? [])
  if (!posters.length) return Infinity
  const rows = [...new Set(posters.map((p) => Math.round(p.getBoundingClientRect().top + window.scrollY)))].sort(
    (a, b) => a - b,
  )
  if (rows.length < n) return Infinity
  return rows[n - 1] + posters[0].getBoundingClientRect().height
}
