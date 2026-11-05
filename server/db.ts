import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const FILE = process.env.DB_PATH ?? 'data/screengrave.db'
mkdirSync(dirname(FILE), { recursive: true })

export const db = new DatabaseSync(FILE)

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS library (
    key      TEXT PRIMARY KEY,
    title    TEXT NOT NULL,
    list     TEXT NOT NULL,
    added_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS episodes (
    show TEXT NOT NULL,
    ep   TEXT NOT NULL,
    PRIMARY KEY (show, ep)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );

  -- titles you removed, so a Trakt sync doesn't bring them back
  CREATE TABLE IF NOT EXISTS removed (
    key        TEXT PRIMARY KEY,
    removed_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

console.log(`[screengrave] database: ${FILE}`)