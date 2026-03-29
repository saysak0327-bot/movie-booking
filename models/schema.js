/**
 * models/schema.js — Database Schema
 * Creates all tables on first run (idempotent)
 *
 * Tables:
 *   users, movies, theaters, shows, seats, bookings, group_sessions
 */

const { getDB } = require('../config/db');

function initDB() {
  const db = getDB();

  // ── Users ────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      email        TEXT    NOT NULL UNIQUE,
      password     TEXT    NOT NULL,
      role         TEXT    NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Movies ───────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      description  TEXT,
      genre        TEXT,
      language     TEXT    DEFAULT 'English',
      duration     INTEGER,                           -- minutes
      rating       REAL    DEFAULT 0,                 -- 0–10
      poster       TEXT,                              -- URL or filename
      trailer_url  TEXT,
      is_active    INTEGER DEFAULT 1
    )
  `);

  // ── Theaters ─────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS theaters (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      location     TEXT    NOT NULL,
      rows         INTEGER NOT NULL DEFAULT 8,
      cols         INTEGER NOT NULL DEFAULT 10
    )
  `);

  // ── Shows ────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS shows (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id     INTEGER NOT NULL REFERENCES movies(id),
      theater_id   INTEGER NOT NULL REFERENCES theaters(id),
      show_date    TEXT    NOT NULL,                  -- YYYY-MM-DD
      show_time    TEXT    NOT NULL,                  -- HH:MM
      price        REAL    NOT NULL DEFAULT 250,
      is_active    INTEGER DEFAULT 1
    )
  `);

  // ── Seats ────────────────────────────────────────────────────────────────────
  // Generated dynamically per show — row (A-H), col (1-10)
  db.exec(`
    CREATE TABLE IF NOT EXISTS seats (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id      INTEGER NOT NULL REFERENCES shows(id),
      row_label    TEXT    NOT NULL,                  -- A, B, C …
      col_num      INTEGER NOT NULL,                  -- 1, 2, 3 …
      seat_label   TEXT    NOT NULL,                  -- A1, B3 …
      status       TEXT    NOT NULL DEFAULT 'available',  -- available | locked | booked
      locked_by    INTEGER REFERENCES users(id),      -- user holding the lock
      locked_at    TEXT,                              -- ISO timestamp of lock
      group_session_id TEXT,                          -- which group session locked it
      UNIQUE(show_id, seat_label)
    )
  `);

  // ── Bookings ─────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      show_id       INTEGER NOT NULL REFERENCES shows(id),
      seats_json    TEXT    NOT NULL,                 -- JSON array of seat labels
      total_price   REAL    NOT NULL,
      booking_code  TEXT    NOT NULL UNIQUE,          -- e.g. BK-A3F9X2
      status        TEXT    NOT NULL DEFAULT 'confirmed',
      qr_data       TEXT,                             -- base64 QR image
      group_session_id TEXT,                          -- populated for group bookings
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Group Sessions ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_code  TEXT    NOT NULL UNIQUE,          -- shared 6-char code
      show_id       INTEGER NOT NULL REFERENCES shows(id),
      creator_id    INTEGER NOT NULL REFERENCES users(id),
      status        TEXT    NOT NULL DEFAULT 'open',  -- open | confirmed | expired
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  console.log('✅  Database initialized');
}

module.exports = { initDB };
