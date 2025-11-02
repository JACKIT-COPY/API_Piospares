const express = require('express');
const { handleCallback } = require('../controllers/mpesaController');
const router = express.Router();

router.post('/callback', handleCallback);

module.exports = router;