/**
 * services/seatService.js — Seat Management Logic
 *
 * Handles:
 *   - Locking seats temporarily during selection
 *   - Releasing locks
 *   - Confirming / marking seats as booked
 *   - Conflict detection
 */

const { getDB } = require('../config/db');

const LOCK_DURATION_MINUTES = 5; // Seats held for 5 minutes

// ── Lock a seat for a user ────────────────────────────────────────────────────
function lockSeat(showId, seatLabel, userId, groupSessionId = null) {
  const db   = getDB();
  const seat = db.prepare(
    'SELECT * FROM seats WHERE show_id = ? AND seat_label = ?'
  ).get(showId, seatLabel);

  if (!seat) return { ok: false, error: 'Seat not found' };

  // Allow re-lock by same user
  if (seat.status === 'locked' && seat.locked_by !== userId)
    return { ok: false, error: 'Seat already selected by another user' };

  if (seat.status === 'booked')
    return { ok: false, error: 'Seat already booked' };

  db.prepare(`
    UPDATE seats
    SET status = 'locked',
        locked_by = ?,
        locked_at = datetime('now'),
        group_session_id = ?
    WHERE id = ?
  `).run(userId, groupSessionId, seat.id);

  return { ok: true, seat: { ...seat, status: 'locked', locked_by: userId } };
}

// ── Unlock a seat (user deselects) ────────────────────────────────────────────
function unlockSeat(showId, seatLabel, userId) {
  const db   = getDB();
  const seat = db.prepare(
    'SELECT * FROM seats WHERE show_id = ? AND seat_label = ?'
  ).get(showId, seatLabel);

  if (!seat) return { ok: false, error: 'Seat not found' };
  if (seat.locked_by !== userId) return { ok: false, error: 'Cannot release seat you did not lock' };

  db.prepare(`
    UPDATE seats
    SET status = 'available', locked_by = NULL, locked_at = NULL, group_session_id = NULL
    WHERE id = ?
  `).run(seat.id);

  return { ok: true };
}

// ── Release ALL seats locked by a user for a show ────────────────────────────
function releaseUserSeats(showId, userId) {
  const db = getDB();
  db.prepare(`
    UPDATE seats
    SET status = 'available', locked_by = NULL, locked_at = NULL, group_session_id = NULL
    WHERE show_id = ? AND locked_by = ? AND status = 'locked'
  `).run(showId, userId);
}

// ── Mark seats as booked (final confirmation) ─────────────────────────────────
function bookSeats(showId, seatLabels, userId, groupSessionId = null) {
  const db = getDB();
  const placeholders = seatLabels.map(() => '?').join(',');

  // Verify all are locked by this user (or same group)
  const seats = db.prepare(
    `SELECT * FROM seats WHERE show_id = ? AND seat_label IN (${placeholders})`
  ).all(showId, ...seatLabels);

  const conflicts = seats.filter(s => {
    if (s.status === 'booked') return true;
    if (s.status === 'locked') {
      // Seat is locked by this user — no conflict
      if (s.locked_by === userId) return false;
      // Seat is locked by another member of the same group session — allowed
      if (groupSessionId && s.group_session_id === groupSessionId) return false;
      // Locked by someone else entirely — conflict
      return true;
    }
    return false;
  });
  if (conflicts.length) {
    return { ok: false, error: `Conflict on seats: ${conflicts.map(s => s.seat_label).join(', ')}` };
  }

  db.prepare(
    `UPDATE seats SET status = 'booked', locked_by = NULL, locked_at = NULL
     WHERE show_id = ? AND seat_label IN (${placeholders})`
  ).run(showId, ...seatLabels);

  return { ok: true };
}

// ── Get seats locked by a group session ──────────────────────────────────────
function getGroupSeats(showId, groupSessionId) {
  const db = getDB();
  return db.prepare(
    "SELECT * FROM seats WHERE show_id = ? AND group_session_id = ? AND status = 'locked'"
  ).all(showId, groupSessionId);
}

module.exports = { lockSeat, unlockSeat, releaseUserSeats, bookSeats, getGroupSeats };
