/**
 * controllers/bookingController.js
 * Handles ticket booking and booking history
 */

const qrcode  = require('qrcode');
const { getDB }          = require('../config/db');
const { lockSeat, bookSeats } = require('../services/seatService');

// ── Generate a unique booking code ───────────────────────────────────────────
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BK-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── POST /api/bookings ────────────────────────────────────────────────────────
// Body: { showId, seats: ['A1','A2'], groupSessionId? }
async function createBooking(req, res, next) {
  try {
  const { showId, seats, groupSessionId } = req.body;
  const userId = req.user.id;

  if (!showId || !seats?.length)
    return res.status(400).json({ error: 'showId and seats required' });

  const db   = getDB();
  const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
  if (!show) return res.status(404).json({ error: 'Show not found' });

  // Mark seats as booked (pass groupSessionId so group members' locks are accepted)
  const result = bookSeats(showId, seats, userId, groupSessionId || null);
  if (!result.ok) return res.status(409).json({ error: result.error });

  const totalPrice  = show.price * seats.length;
  const bookingCode = genCode();

  // Generate QR code (contains booking summary as JSON)
  const qrPayload = JSON.stringify({ bookingCode, showId, seats, userId });
  const qrData    = await qrcode.toDataURL(qrPayload);

  const bookingId = Number(db.prepare(`
    INSERT INTO bookings (user_id, show_id, seats_json, total_price, booking_code, qr_data, group_session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, showId, JSON.stringify(seats), totalPrice, bookingCode, qrData, groupSessionId || null)
    .lastInsertRowid);

  // If group session, close it
  if (groupSessionId) {
    db.prepare("UPDATE group_sessions SET status = 'confirmed' WHERE session_code = ?")
      .run(groupSessionId);
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  res.status(201).json({ ...booking, seats_json: JSON.parse(booking.seats_json) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/bookings ─────────────────────────────────────────────────────────
function myBookings(req, res) {
  const db = getDB();
  const bookings = db.prepare(`
    SELECT
      b.*,
      m.title      AS movie_title,
      m.poster     AS movie_poster,
      t.name       AS theater_name,
      t.location   AS theater_location,
      s.show_date,
      s.show_time,
      s.price
    FROM bookings b
    JOIN shows    s ON s.id = b.show_id
    JOIN movies   m ON m.id = s.movie_id
    JOIN theaters t ON t.id = s.theater_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user.id);

  const parsed = bookings.map(b => ({ ...b, seats_json: JSON.parse(b.seats_json) }));
  res.json(parsed);
}

// ── GET /api/bookings/:id ─────────────────────────────────────────────────────
function getBooking(req, res) {
  const db = getDB();
  const booking = db.prepare(`
    SELECT b.*, m.title AS movie_title, m.poster AS movie_poster,
           t.name AS theater_name, t.location AS theater_location,
           s.show_date, s.show_time, s.price
    FROM bookings b
    JOIN shows s ON s.id = b.show_id
    JOIN movies m ON m.id = s.movie_id
    JOIN theaters t ON t.id = s.theater_id
    WHERE b.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json({ ...booking, seats_json: JSON.parse(booking.seats_json) });
}

// ── POST /api/bookings/lock ───────────────────────────────────────────────────
// Body: { showId, seatLabel, action: 'lock'|'unlock', groupSessionId? }
function toggleLock(req, res) {
  const { showId, seatLabel, action, groupSessionId } = req.body;
  const { lockSeat, unlockSeat } = require('../services/seatService');

  if (action === 'lock') {
    const result = lockSeat(showId, seatLabel, req.user.id, groupSessionId || null);
    return res.json(result);
  }
  if (action === 'unlock') {
    const result = unlockSeat(showId, seatLabel, req.user.id);
    return res.json(result);
  }
  res.status(400).json({ error: 'action must be lock or unlock' });
}

module.exports = { createBooking, myBookings, getBooking, toggleLock };
