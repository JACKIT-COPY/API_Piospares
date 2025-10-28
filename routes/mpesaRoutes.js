const express = require('express');
const { handleCallback } = require('../controllers/mpesaController');

const router = express.Router();

// Public callback (no auth)
router.post('/callback', handleCallback);

// Optional: Internal endpoint for manual STK (e.g., retry)
router.post('/stk-push', (req, res) => {
  // Auth middleware if needed
  // Call initiateSTKPush(...)
});

module.exports = router;