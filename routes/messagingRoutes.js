const express = require('express');
const {
    forwardToUnifiedApi,
    saveSettings
} = require('../controllers/messagingController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// Settings route
router.post('/settings', authMiddleware, roleMiddleware(['Owner', 'SuperAdmin']), saveSettings);

// Proxy routes to unified API
// Apply authMiddleware to ensure only logged in users can access these
router.all('/*', authMiddleware, forwardToUnifiedApi);

module.exports = router;
