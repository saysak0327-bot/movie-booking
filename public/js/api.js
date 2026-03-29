/**
 * js/api.js — Centralized API Client
 * All backend communication goes through here
 */

const API_BASE = window.location.origin + '/api';

// ── Token Storage ─────────────────────────────────────────────
const Auth = {
  setToken: (t) => localStorage.setItem('cinema_token', t),
  getToken: ()  => localStorage.getItem('cinema_token'),
  setUser:  (u) => localStorage.setItem('cinema_user', JSON.stringify(u)),
  getUser:  ()  => { try { return JSON.parse(localStorage.getItem('cinema_user')); } catch { return null; } },
  clear:    ()  => { localStorage.removeItem('cinema_token'); localStorage.removeItem('cinema_user'); },
  isLoggedIn: () => !!localStorage.getItem('cinema_token')
};

// ── Core Fetch Wrapper ────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Auth API ──────────────────────────────────────────────────
const AuthAPI = {
  register: (body) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body) => apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  me:       ()     => apiFetch('/auth/me')
};

// ── Movies API ─────────────────────────────────────────────────
const MoviesAPI = {
  list:      ()       => apiFetch('/movies'),
  get:       (id)     => apiFetch(`/movies/${id}`),
  shows:     (id)     => apiFetch(`/movies/${id}/shows`),
  seats:     (showId) => apiFetch(`/movies/shows/${showId}/seats`)
};

const AdminMoviesAPI = {
  add:    (body) => apiFetch('/movies', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => apiFetch(`/movies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id)   => apiFetch(`/movies/${id}`, { method: 'DELETE' })
};

// ── Bookings API ───────────────────────────────────────────────
const BookingsAPI = {
  create:   (body)   => apiFetch('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  mine:     ()       => apiFetch('/bookings'),
  get:      (id)     => apiFetch(`/bookings/${id}`),
  lock:     (body)   => apiFetch('/bookings/lock', { method: 'POST', body: JSON.stringify(body) })
};

// ── Groups API ─────────────────────────────────────────────────
const GroupsAPI = {
  create:  (showId)  => apiFetch('/groups/create',  { method: 'POST', body: JSON.stringify({ showId }) }),
  join:    (code)    => apiFetch('/groups/join',     { method: 'POST', body: JSON.stringify({ session_code: code }) }),
  get:     (code)    => apiFetch(`/groups/${code}`),
  confirm: (code)    => apiFetch('/groups/confirm',  { method: 'POST', body: JSON.stringify({ session_code: code }) })
};

// ── Toast Notifications ───────────────────────────────────────
function toast(msg, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '❌', info: '💡', warning: '⚠️' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Navigation Guard ───────────────────────────────────────────
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// ── Redirect if already logged in ─────────────────────────────
function redirectIfLoggedIn() {
  if (Auth.isLoggedIn()) window.location.href = '/movies.html';
}

// ── Render Navbar ─────────────────────────────────────────────
function renderNavbar(activePage = '') {
  const user = Auth.getUser();
  const navEl = document.getElementById('navbar');
  if (!navEl) return;

  const initials = user ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : '';

  navEl.innerHTML = `
    <div class="navbar-inner">
      <a href="/movies.html" class="navbar-brand">CINEMA<span>BOOK</span></a>
      <a href="/movies.html"  class="nav-link ${activePage==='movies'?'active':''}">Movies</a>
      <a href="/history.html" class="nav-link ${activePage==='history'?'active':''}">My Tickets</a>
      ${user?.role==='admin' ? `<a href="/admin.html" class="nav-link ${activePage==='admin'?'active':''}">Admin</a>` : ''}
      <div class="nav-user">
        <div class="nav-avatar">${initials}</div>
        <span class="text-muted" style="font-size:0.85rem">${user?.name || ''}</span>
        <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>
      </div>
    </div>
  `;
}

function logout() {
  Auth.clear();
  window.location.href = '/index.html';
}

// ── Format Helpers ────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
}

function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function starRating(rating) {
  const filled = Math.round(rating / 2);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}
