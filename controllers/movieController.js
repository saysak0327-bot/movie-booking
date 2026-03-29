/**
 * controllers/movieController.js
 * Handles movies, theaters, and shows
 */

const { getDB } = require('../config/db');

// ── GET /api/movies ───────────────────────────────────────────────────────────
function listMovies(req, res) {
  const db     = getDB();
  const movies = db.prepare('SELECT * FROM movies WHERE is_active = 1 ORDER BY id DESC').all();
  res.json(movies);
}

// ── GET /api/movies/:id ───────────────────────────────────────────────────────
function getMovie(req, res) {
  const db    = getDB();
  const movie = db.prepare('SELECT * FROM movies WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });
  res.json(movie);
}

// ── GET /api/movies/:id/shows ─────────────────────────────────────────────────
// Returns upcoming shows for a movie (next 7 days)
function getMovieShows(req, res) {
  const db = getDB();
  const shows = db.prepare(`
    SELECT
      s.*,
      t.name        AS theater_name,
      t.location    AS theater_location,
      t.rows,
      t.cols,
      m.title       AS movie_title
    FROM shows s
    JOIN theaters t ON t.id = s.theater_id
    JOIN movies   m ON m.id = s.movie_id
    WHERE s.movie_id = ?
      AND s.is_active = 1
      AND s.show_date >= date('now')
    ORDER BY s.show_date, s.show_time
  `).all(req.params.id);

  res.json(shows);
}

// ── GET /api/shows/:showId/seats ──────────────────────────────────────────────
// Returns seat map for a show (auto-generates if not yet created)
function getShowSeats(req, res) {
  const db     = getDB();
  const showId = req.params.showId;

  const show = db.prepare(`
    SELECT s.*, t.rows, t.cols
    FROM shows s JOIN theaters t ON t.id = s.theater_id
    WHERE s.id = ?
  `).get(showId);

  if (!show) return res.status(404).json({ error: 'Show not found' });

  // Check if seats exist; if not, auto-generate them
  const count = db.prepare('SELECT COUNT(*) AS c FROM seats WHERE show_id = ?').get(showId).c;

  if (count === 0) {
    const rows = 'ABCDEFGH'.slice(0, show.rows).split('');
    const insertSeat = db.prepare(
      'INSERT OR IGNORE INTO seats (show_id, row_label, col_num, seat_label) VALUES (?, ?, ?, ?)'
    );
    const insertMany = db.transaction(() => {
      for (const row of rows) {
        for (let col = 1; col <= show.cols; col++) {
          insertSeat.run(showId, row, col, `${row}${col}`);
        }
      }
    });
    insertMany();
  }

  // Expire stale locks older than 5 minutes
  db.prepare(`
    UPDATE seats
    SET status = 'available', locked_by = NULL, locked_at = NULL, group_session_id = NULL
    WHERE show_id = ?
      AND status = 'locked'
      AND locked_at < datetime('now', '-5 minutes')
  `).run(showId);

  const seats = db.prepare('SELECT * FROM seats WHERE show_id = ? ORDER BY row_label, col_num').all(showId);

  res.json({ show, seats });
}

// ── GET /api/theaters ─────────────────────────────────────────────────────────
function listTheaters(req, res) {
  const db = getDB();
  res.json(db.prepare('SELECT * FROM theaters').all());
}

// ── POST /api/movies ─────────────────────────────────────────── (admin only) ─
function addMovie(req, res) {
  const { title, description, genre, language, duration, rating, poster, trailer_url } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO movies (title, description, genre, language, duration, rating, poster, trailer_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description || '',
    genre       || '',
    language    || 'English',
    Number(duration) || 0,
    Number(rating)   || 0,
    poster      || '',
    trailer_url || ''
  );

  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json(movie);
}

// ── PUT /api/movies/:id ──────────────────────────────────────── (admin only) ─
function updateMovie(req, res) {
  const db    = getDB();
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  const { title, description, genre, language, duration, rating, poster, trailer_url, is_active } = req.body;

  db.prepare(`
    UPDATE movies
    SET title       = ?,
        description = ?,
        genre       = ?,
        language    = ?,
        duration    = ?,
        rating      = ?,
        poster      = ?,
        trailer_url = ?,
        is_active   = ?
    WHERE id = ?
  `).run(
    title       ?? movie.title,
    description ?? movie.description,
    genre       ?? movie.genre,
    language    ?? movie.language,
    duration    !== undefined ? Number(duration) : movie.duration,
    rating      !== undefined ? Number(rating)   : movie.rating,
    poster      ?? movie.poster,
    trailer_url ?? movie.trailer_url,
    is_active   !== undefined ? Number(is_active) : movie.is_active,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id));
}

// ── DELETE /api/movies/:id ───────────────────────────────────── (admin only) ─
function deleteMovie(req, res) {
  const db    = getDB();
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  // Soft-delete: mark inactive so existing bookings remain intact
  db.prepare('UPDATE movies SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true, message: 'Movie removed from listings' });
}

module.exports = { listMovies, getMovie, getMovieShows, getShowSeats, listTheaters, addMovie, updateMovie, deleteMovie };
