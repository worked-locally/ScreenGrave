// Bundles the server into one plain JavaScript file (dist-server/index.mjs),
// so the Docker image needs no node_modules and no TypeScript loader at runtime.
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

await build({
  entryPoints: ['server/index.ts'],
  outfile: 'dist-server/index.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  minify: true,
  legalComments: 'none',
  define: { __SERVER_VERSION__: JSON.stringify(version) },
  // some dependencies still use require(); this makes it available in the ES module bundle
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
})
console.log(`server bundled: dist-server/index.mjs (v${version})`)
