// Search-box motion presets. Matching is by fingerprint, so lookups stay cheap.

function fingerprint(str: string, seed = 1977): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const PRESETS: Record<string, string> = {
  '14is0lrvee6': 'reel',
  '101260pxda3': 'scan',
  '1q52t4n7jj4': 'rain',
  '29osgyha6kl': 'dust',
  '1nshabd4owq': 'sprout',
  '1k60q1f5aca': 'sweep',
  phbrda86xp: 'bow',
  o4d47n2ydo: 'bow',
  '22b0za3nn2m': 'dawn',
  '1c7ni6j69z0': 'light',
  '2co4vrzwfea': 'off',
  '1ckjzajw2ig': 'bloom',
  '4gdow3s00s': 'beat',
  '1ygpqk6nzcn': 'beat',
  g60guycqsn: 'flip',
}

// letters and digits only, so capitals, spaces and punctuation don't matter
export const normalize = (q: string) => q.toLowerCase().replace(/[^a-z0-9]/g, '')

export function presetFor(q: string): string | null {
  const n = normalize(q)
  return n.length >= 3 ? (PRESETS[fingerprint(n)] ?? null) : null
}
