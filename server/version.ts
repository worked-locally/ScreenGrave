import { readFileSync } from 'node:fs'

// the single source of truth for the version is package.json
export const VERSION: string = (() => {
  try {
    return (JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }).version ?? 'dev'
  } catch {
    return 'dev'
  }
})()
