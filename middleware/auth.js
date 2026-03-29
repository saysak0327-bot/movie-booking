/**
 * middleware/auth.js — JWT Authentication Guard
 * Attach to any route that requires a logged-in user
 */

const jwt      = require('jsonwebtoken');
const { getDB } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'cinema_secret_2024_dev';

function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Confirm the user still exists in the DB (guards against stale tokens
    // after a re-seed or user deletion — avoids FK constraint 500s downstream)
    const db   = getDB();
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists — please log in again' });
    }

    req.user = user;   // use live DB values, not stale JWT payload
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err); // unexpected errors → global handler
  }
}

// Restrict to admin role
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, adminOnly, JWT_SECRET };
