import { readFileSync } from 'node:fs'

// filled in by the production build; while developing, it's read from package.json
declare const __SERVER_VERSION__: string | undefined

export const VERSION: string =
  typeof __SERVER_VERSION__ === 'string'
    ? __SERVER_VERSION__
    : (() => {
        try {
          return (JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }).version ?? 'dev'
        } catch {
          return 'dev'
        }
      })()
