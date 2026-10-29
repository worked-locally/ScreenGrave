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
`)

console.log(`[screengrave] database: ${FILE}`)