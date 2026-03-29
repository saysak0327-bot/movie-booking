/**
 * server.js — Main Entry Point
 * Starts Express + Socket.IO server
 */

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const path     = require('path');

const { initDB }        = require('./models/schema');
const authRoutes        = require('./routes/auth');
const movieRoutes       = require('./routes/movies');
const bookingRoutes     = require('./routes/bookings');
const groupRoutes       = require('./routes/groups');
const { initSocket }    = require('./socket/socketHandler');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend

// ── REST API Routes ───────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/movies',   movieRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/groups',   groupRoutes);

// ── Catch-all: SPA fallback ───────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── WebSocket Init ────────────────────────────────────────────────────────────
initSocket(io);

// ── DB Init + Start ───────────────────────────────────────────────────────────
initDB();
server.listen(PORT, () => {
  console.log(`\n🎬  Movie Booking Server running at http://localhost:${PORT}`);
  console.log(`📡  WebSocket ready`);
  console.log(`\n   Run "node seed.js" first to load sample data!\n`);
});

// ── Global error handler (catches unhandled errors in async routes) ─────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
