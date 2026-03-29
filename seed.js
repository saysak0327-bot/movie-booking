/**
 * seed.js — Sample Data Seeder
 * Run: node seed.js
 */

const { initDB }   = require('./models/schema');
const { getDB }    = require('./config/db');
const bcrypt       = require('bcryptjs');

async function seed() {
  initDB();
  const db = getDB();

  console.log('🌱  Seeding database...\n');

  // ── Clear existing data ──────────────────────────────────────────────────
  db.exec(`
    DELETE FROM seats; DELETE FROM bookings; DELETE FROM group_sessions;
    DELETE FROM shows; DELETE FROM theaters; DELETE FROM movies; DELETE FROM users;
  `);

  // ── Users ────────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash('password123', 10);
  const adminPw = await bcrypt.hash('admin123', 10);

  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)').run('Admin User',  'admin@cinema.com',  adminPw, 'admin');
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)').run('Arjun Sharma','arjun@example.com', pw,      'user');
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)').run('Priya Patel', 'priya@example.com', pw,      'user');
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)').run('Ravi Kumar',  'ravi@example.com',  pw,      'user');
  console.log('✅  Users created (admin@cinema.com / admin123, arjun@example.com / password123)');

  // ── Movies ───────────────────────────────────────────────────────────────
  const movies = [
    {
      title: 'Kalki 2898 AD',
      description: 'A futuristic sci-fi epic set in the dystopian world of 2898 AD, blending mythology with cutting-edge action.',
      genre: 'Sci-Fi / Action',
      language: 'Telugu',
      duration: 181,
      rating: 8.2,
      poster: 'https://upload.wikimedia.org/wikipedia/en/1/1e/Kalki_2898_AD_poster.jpg',
      trailer_url: 'https://www.youtube.com/embed/7vPE_eGNPFM'
    },
    {
      title: 'Animal',
      description: 'A raw, intense tale of a son\'s obsession with his father set against a backdrop of power and violence.',
      genre: 'Action / Drama',
      language: 'Hindi',
      duration: 201,
      rating: 7.6,
      poster: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/ed/Animal_2023_film_poster.jpg/220px-Animal_2023_film_poster.jpg',
      trailer_url: 'https://www.youtube.com/embed/IBqGhJpggpk'
    },
    {
      title: 'Dunki',
      description: 'Four friends from Punjab dream of reaching London through any means — a heartfelt journey of hope and friendship.',
      genre: 'Drama / Comedy',
      language: 'Hindi',
      duration: 161,
      rating: 7.1,
      poster: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/32/Dunki_film_poster.jpg/220px-Dunki_film_poster.jpg',
      trailer_url: 'https://www.youtube.com/embed/4B-k0Kf4uQM'
    },
    {
      title: 'Leo',
      description: 'A mild-mannered café owner\'s violent past catches up with him in this stylish Tamil action thriller.',
      genre: 'Action / Thriller',
      language: 'Tamil',
      duration: 164,
      rating: 7.4,
      poster: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a1/Leo_2023_film_poster.jpg/220px-Leo_2023_film_poster.jpg',
      trailer_url: 'https://www.youtube.com/embed/r1GNxaGDXiA'
    },
    {
      title: 'Stree 2',
      description: 'The ladies of Chanderi return to face a new supernatural threat in this hilarious horror-comedy sequel.',
      genre: 'Horror / Comedy',
      language: 'Hindi',
      duration: 140,
      rating: 8.5,
      poster: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/ee/Stree_2_poster.jpg/220px-Stree_2_poster.jpg',
      trailer_url: 'https://www.youtube.com/embed/iLbW7cFVmME'
    },
    {
      title: 'Fighter',
      description: 'India\'s Air Force takes on cross-border terrorism in this high-octane aerial action spectacular.',
      genre: 'Action',
      language: 'Hindi',
      duration: 166,
      rating: 6.9,
      poster: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Fighter_2024_film_poster.jpg/220px-Fighter_2024_film_poster.jpg',
      trailer_url: 'https://www.youtube.com/embed/5KDM1cPQHHc'
    }
  ];

  const insertMovie = db.prepare(
    'INSERT INTO movies (title, description, genre, language, duration, rating, poster, trailer_url) VALUES (?,?,?,?,?,?,?,?)'
  );
  const movieIds = movies.map(m => Number(insertMovie.run(m.title, m.description, m.genre, m.language, m.duration, m.rating, m.poster, m.trailer_url).lastInsertRowid));
  console.log(`✅  ${movies.length} movies created`);

  // ── Theaters ─────────────────────────────────────────────────────────────
  const theaters = [
    { name: 'PVR Cinemas - Forum Mall',     location: 'Koramangala, Bangalore', rows: 8, cols: 10 },
    { name: 'INOX - Garuda Mall',           location: 'Magrath Road, Bangalore', rows: 8, cols: 10 },
    { name: 'Cinepolis - Elements Mall',    location: 'Nagawara, Bangalore',     rows: 8, cols: 10 },
    { name: 'INOX - City Centre',           location: 'Kolkata, West Bengal',    rows: 8, cols: 10 },
    { name: 'PVR - Acropolis Mall',         location: 'Dhakuria, Kolkata',       rows: 8, cols: 10 },
  ];

  const insertTheater = db.prepare(
    'INSERT INTO theaters (name, location, rows, cols) VALUES (?,?,?,?)'
  );
  const theaterIds = theaters.map(t => Number(insertTheater.run(t.name, t.location, t.rows, t.cols).lastInsertRowid));
  console.log(`✅  ${theaters.length} theaters created`);

  // ── Shows (next 7 days) ──────────────────────────────────────────────────
  const times = ['10:00', '13:30', '17:00', '20:30'];
  const prices = [250, 300, 350, 400];
  const insertShow = db.prepare(
    'INSERT INTO shows (movie_id, theater_id, show_date, show_time, price) VALUES (?,?,?,?,?)'
  );

  let showCount = 0;
  const today = new Date();
  for (let day = 0; day < 7; day++) {
    const d = new Date(today);
    d.setDate(today.getDate() + day);
    const dateStr = d.toISOString().split('T')[0];

    movieIds.forEach((mid, mi) => {
      const tId = theaterIds[mi % theaterIds.length];
      times.forEach((time, ti) => {
        insertShow.run(mid, tId, dateStr, time, prices[ti]);
        showCount++;
      });
    });
  }
  console.log(`✅  ${showCount} shows scheduled (next 7 days)`);

  console.log('\n🎉  Database seeded successfully!');
  console.log('    Login: admin@cinema.com / admin123');
  console.log('    Login: arjun@example.com / password123\n');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
