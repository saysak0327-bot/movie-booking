/**
 * config/db.js — SQLite Database Connection
 * Uses better-sqlite3 (synchronous, no callback hell)
 * Requires Node v20 LTS — prebuilt binaries available, no compilation needed
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'movie_booking.db');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Better concurrent read performance
    db.pragma('foreign_keys = ON');  // Enforce relationships
  }
  return db;
}

module.exports = { getDB };
