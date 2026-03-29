/**
 * routes/bookings.js
 */
const router = require('express').Router();
const { createBooking, myBookings, getBooking, toggleLock } = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate); // All booking routes require auth

router.get('/',        myBookings);
router.get('/:id',     getBooking);
router.post('/',       createBooking);
router.post('/lock',   toggleLock);

module.exports = router;
