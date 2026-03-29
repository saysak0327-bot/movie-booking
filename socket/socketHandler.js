/**
 * socket/socketHandler.js — Real-Time Group Booking Engine
 *
 * Events (client → server):
 *   join_session   { sessionCode, userId, userName }
 *   select_seat    { sessionCode, seatLabel, userId, userName, action: 'lock'|'unlock' }
 *   confirm_booking { sessionCode, userId }
 *   leave_session  { sessionCode, userId }
 *
 * Events (server → client):
 *   session_state   { members, seats }          — emitted to new joiner
 *   seat_updated    { seatLabel, status, userId, userName, color }
 *   member_joined   { userId, userName, color }
 *   member_left     { userId, userName }
 *   booking_confirmed { bookingCode }
 *   error           { message }
 */

const { lockSeat, unlockSeat, releaseUserSeats } = require('../services/seatService');
const { getDB } = require('../config/db');

// In-memory store: sessionCode → { members: Map<userId, {name, color, socketId}> }
const sessions = new Map();

// Color palette for group members (up to 8 users)
const COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];

function getOrCreateSession(code) {
  if (!sessions.has(code)) sessions.set(code, { members: new Map() });
  return sessions.get(code);
}

function assignColor(sessionData, userId) {
  // Keep consistent color for same user
  if (sessionData.members.has(userId)) return sessionData.members.get(userId).color;
  const usedColors = new Set([...sessionData.members.values()].map(m => m.color));
  return COLORS.find(c => !usedColors.has(c)) || COLORS[0];
}

function initSocket(io) {
  io.on('connection', (socket) => {

    // ── JOIN SESSION ────────────────────────────────────────────────────────
    socket.on('join_session', ({ sessionCode, userId, userName }) => {
      const db = getDB();
      const session = db.prepare('SELECT * FROM group_sessions WHERE session_code = ?').get(sessionCode);
      if (!session || session.status !== 'open') {
        socket.emit('error', { message: 'Session not found or already closed' });
        return;
      }

      socket.join(sessionCode);
      const sessionData = getOrCreateSession(sessionCode);
      const color = assignColor(sessionData, userId);

      sessionData.members.set(String(userId), { name: userName, color, socketId: socket.id });

      // Get current seat state for this show
      const seats = db.prepare(`
        SELECT seat_label, status, locked_by, group_session_id
        FROM seats WHERE show_id = ?
      `).all(session.show_id);

      // Send current state to the joiner
      socket.emit('session_state', {
        members: [...sessionData.members.entries()].map(([id, m]) => ({ userId: id, ...m })),
        seats,
        yourColor: color
      });

      // Notify others
      socket.to(sessionCode).emit('member_joined', { userId, userName, color });

      console.log(`👥  ${userName} joined group session ${sessionCode}`);
    });

    // ── SEAT SELECTION / DESELECTION ────────────────────────────────────────
    socket.on('select_seat', ({ sessionCode, seatLabel, userId, userName, action }) => {
      const db = getDB();
      const session = db.prepare('SELECT * FROM group_sessions WHERE session_code = ?').get(sessionCode);
      if (!session) return socket.emit('error', { message: 'Invalid session' });

      const sessionData = sessions.get(sessionCode);
      const color = sessionData?.members.get(String(userId))?.color || COLORS[0];

      let result;
      if (action === 'lock') {
        result = lockSeat(session.show_id, seatLabel, userId, sessionCode);
      } else {
        result = unlockSeat(session.show_id, seatLabel, userId);
      }

      if (!result.ok) {
        socket.emit('seat_conflict', { seatLabel, message: result.error });
        return;
      }

      // Broadcast seat update to ALL members in the session (including sender)
      io.to(sessionCode).emit('seat_updated', {
        seatLabel,
        status:   action === 'lock' ? 'locked' : 'available',
        userId:   String(userId),
        userName,
        color
      });
    });

    // ── LEAVE SESSION ───────────────────────────────────────────────────────
    socket.on('leave_session', ({ sessionCode, userId, showId }) => {
      const sessionData = sessions.get(sessionCode);
      if (!sessionData) return;

      const member = sessionData.members.get(String(userId));
      sessionData.members.delete(String(userId));

      // Release all seats held by this user in this show
      if (showId) releaseUserSeats(showId, userId);

      socket.to(sessionCode).emit('member_left', {
        userId,
        userName: member?.name || 'Someone'
      });

      // Broadcast released seats
      const db = getDB();
      const seats = db.prepare(
        'SELECT seat_label, status FROM seats WHERE show_id = ? AND locked_by IS NULL'
      ).all(showId);

      io.to(sessionCode).emit('seats_released', { userId, seats });
      socket.leave(sessionCode);
    });

    // ── DISCONNECT ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Find and clean up any sessions this socket was part of
      for (const [code, sessionData] of sessions) {
        for (const [uid, member] of sessionData.members) {
          if (member.socketId === socket.id) {
            sessionData.members.delete(uid);
            io.to(code).emit('member_left', { userId: uid, userName: member.name });
            break;
          }
        }
      }
    });
  });
}

module.exports = { initSocket };
