// loads .env.local before anything else reads settings; in Docker the variables come from the container
try {
  process.loadEnvFile('.env.local')
} catch {
  // no .env.local, which is fine
}