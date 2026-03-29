/**
 * routes/movies.js
 */
const router = require('express').Router();
const { listMovies, getMovie, getMovieShows, getShowSeats, listTheaters,
        addMovie, updateMovie, deleteMovie } = require('../controllers/movieController');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/',                      listMovies);
router.get('/theaters',              listTheaters);
router.get('/:id',                   getMovie);
router.get('/:id/shows',             getMovieShows);
router.get('/shows/:showId/seats',   authenticate, getShowSeats);

// Admin-only movie management
router.post('/',       authenticate, adminOnly, addMovie);
router.put('/:id',     authenticate, adminOnly, updateMovie);
router.delete('/:id',  authenticate, adminOnly, deleteMovie);

module.exports = router;
