/**
 * controllers/groupController.js
 * Manages Group Booking Sessions
 *
 * Flow:
 *   1. Creator calls POST /api/groups/create → gets session_code
 *   2. Friends call POST /api/groups/join   → join via code
 *   3. Everyone selects seats (real-time via WebSocket)
 *   4. Creator calls POST /api/groups/confirm → finalizes booking
 */

const { getDB }         = require('../config/db');
const { getGroupSeats } = require('../services/seatService');

// ── Generate 6-char alphanumeric code ────────────────────────────────────────
function genSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── POST /api/groups/create ───────────────────────────────────────────────────
async function createSession(req, res, next) {
  try {
    const { showId } = req.body;
    if (!showId) return res.status(400).json({ error: 'showId required' });

    const db   = getDB();
    const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
    if (!show) return res.status(404).json({ error: 'Show not found' });

    const code = genSessionCode();

    db.prepare(
      'INSERT INTO group_sessions (session_code, show_id, creator_id) VALUES (?, ?, ?)'
    ).run(code, showId, req.user.id);

    res.status(201).json({ session_code: code, show_id: showId, creator_id: req.user.id });
  } catch (err) {
    console.error('createSession error:', err.message);
    next(err);
  }
}

// ── POST /api/groups/join ─────────────────────────────────────────────────────
async function joinSession(req, res, next) {
  try {
    const { session_code } = req.body;
    if (!session_code) return res.status(400).json({ error: 'session_code required' });

    // Normalise to uppercase — codes are generated uppercase but users may type lowercase
    const code = session_code.trim().toUpperCase();

    const db      = getDB();
    const session = db.prepare('SELECT * FROM group_sessions WHERE session_code = ?').get(code);

    if (!session)                  return res.status(404).json({ error: 'Session not found — check the code and try again' });
    if (session.status !== 'open') return res.status(400).json({ error: 'Session is no longer open' });

    // Return session info + current seats state
    const show = db.prepare(`
      SELECT s.*, m.title AS movie_title, t.name AS theater_name, t.location AS theater_location
      FROM shows s JOIN movies m ON m.id=s.movie_id JOIN theaters t ON t.id=s.theater_id
      WHERE s.id = ?
    `).get(session.show_id);

    const seats = getGroupSeats(session.show_id, code);

    res.json({ session, show, lockedSeats: seats });
  } catch (err) {
    console.error('joinSession error:', err.message);
    next(err);
  }
}

// ── GET /api/groups/:code ─────────────────────────────────────────────────────
async function getSession(req, res, next) {
  try {
    const code    = req.params.code.trim().toUpperCase();
    const db      = getDB();
    const session = db.prepare('SELECT * FROM group_sessions WHERE session_code = ?').get(code);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const seats = getGroupSeats(session.show_id, code);
    res.json({ session, lockedSeats: seats });
  } catch (err) {
    console.error('getSession error:', err.message);
    next(err);
  }
}

// ── POST /api/groups/confirm ──────────────────────────────────────────────────
// Only the session creator can confirm
async function confirmSession(req, res, next) {
  try {
    const { session_code } = req.body;
    const db = getDB();

    const session = db.prepare('SELECT * FROM group_sessions WHERE session_code = ?').get(session_code);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.creator_id !== req.user.id) return res.status(403).json({ error: 'Only the session creator can confirm' });
    if (session.status !== 'open') return res.status(400).json({ error: 'Session already closed' });

    // Delegate to booking controller logic
    const lockedSeats = getGroupSeats(session.show_id, session_code);
    if (!lockedSeats.length)
      return res.status(400).json({ error: 'No seats selected in this session' });

    req.body = {
      showId:         session.show_id,
      seats:          lockedSeats.map(s => s.seat_label),
      groupSessionId: session_code
    };

    const { createBooking } = require('./bookingController');
    return createBooking(req, res, next);
  } catch (err) {
    next(err);
  }
}

module.exports = { createSession, joinSession, getSession, confirmSession };
