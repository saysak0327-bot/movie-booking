/**
 * controllers/authController.js
 * Handles user registration and login
 */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { getDB }      = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

// ── POST /api/auth/register ───────────────────────────────────────────────────
async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const db = getDB();

  // Check if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing)
    return res.status(409).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);

  const result = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, hashed, 'user');

  const newId = Number(result.lastInsertRowid);
  const token = jwt.sign(
    { id: newId, email, name, role: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({ token, user: { id: newId, name, email, role: 'user' } });
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const db   = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user)
    return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
function me(req, res) {
  const db   = getDB();
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
                 .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}

module.exports = { register, login, me };
