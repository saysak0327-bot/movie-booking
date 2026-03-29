/**
 * routes/groups.js
 */
const router = require('express').Router();
const { createSession, joinSession, getSession, confirmSession } = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/create',  createSession);
router.post('/join',    joinSession);
router.post('/confirm', confirmSession);
router.get('/:code',    getSession);

module.exports = router;
